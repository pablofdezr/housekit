import Table from 'cli-table3';
import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, info, success, warn, quoteName, quoteValue, quoteComment } from '../ui';

async function fetchTables(client: any): Promise<string[]> {
    const result = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
    const parsed = await result.json();
    const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
    if (!Array.isArray(rows)) {
        throw new TypeError('Unexpected response format for SHOW TABLES');
    }
    return rows.map((r: any) => r.name || r);
}

async function fetchTableDefinition(client: any, table: string) {
    // Get column definitions from DESCRIBE TABLE
    const result = await client.query({ query: `DESCRIBE TABLE \`${table}\``, format: 'JSONEachRow' });
    const parsed = await result.json();
    const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
    if (!Array.isArray(rows)) {
        throw new TypeError(`Unexpected response format for DESCRIBE TABLE ${table}`);
    }

    // Also get CREATE TABLE statement to extract defaults
    const createResult = await client.query({ query: `SHOW CREATE TABLE \`${table}\``, format: 'JSONEachRow' });
    const createParsed = await createResult.json();
    const createRows = Array.isArray(createParsed) ? createParsed : (createParsed?.data ?? []);
    const createStatement = Array.isArray(createRows) && createRows.length > 0
        ? (createRows[0] as any)?.statement || ''
        : '';

    // Parse defaults from CREATE TABLE statement
    const defaultsMap = new Map<string, string>();
    if (createStatement && rows.length > 0) {
        // Extract column definitions section (between first opening paren and ENGINE/ORDER BY)
        const createMatch = createStatement.match(/CREATE\s+TABLE[^(]*\(([\s\S]*?)\)\s*(?:ENGINE|ORDER|PARTITION|TTL|PRIMARY)/i);
        if (createMatch) {
            const columnsSection = createMatch[1];

            // Split by commas, but handle nested parentheses and quoted strings
            const columns: string[] = [];
            let current = '';
            let depth = 0;
            let inSingleQuote = false;
            let inDoubleQuote = false;
            let inBacktick = false;

            for (let i = 0; i < columnsSection.length; i++) {
                const char = columnsSection[i];
                const prevChar = i > 0 ? columnsSection[i - 1] : '';

                // Handle quoted strings
                if (char === "'" && prevChar !== '\\' && !inDoubleQuote && !inBacktick) {
                    inSingleQuote = !inSingleQuote;
                } else if (char === '"' && prevChar !== '\\' && !inSingleQuote && !inBacktick) {
                    inDoubleQuote = !inDoubleQuote;
                } else if (char === '`' && prevChar !== '\\' && !inSingleQuote && !inDoubleQuote) {
                    inBacktick = !inBacktick;
                }

                // Only count parentheses when not in quotes
                if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
                    if (char === '(') depth++;
                    else if (char === ')') depth--;
                    else if (char === ',' && depth === 0) {
                        columns.push(current.trim());
                        current = '';
                        continue;
                    }
                }

                current += char;
            }
            if (current.trim()) {
                columns.push(current.trim());
            }

            // Parse each column for DEFAULT clause
            for (const colDef of columns) {
                // Skip if it's not a column definition (e.g., ENGINE, ORDER BY, etc.)
                if (!colDef.match(/^[`]?[a-zA-Z_][a-zA-Z0-9_]*[`]?\s+/)) continue;

                // Extract column name
                const nameMatch = colDef.match(/^[`]?([a-zA-Z_][a-zA-Z0-9_]*)[`]?\s+/);
                if (!nameMatch) continue;

                const columnName = nameMatch[1];

                // Look for DEFAULT clause - find DEFAULT keyword and capture everything after it
                const defaultIndex = colDef.search(/\bDEFAULT\s+/i);
                if (defaultIndex >= 0) {
                    const afterDefault = colDef.substring(defaultIndex + 7); // Skip "DEFAULT"
                    // Find where the default value ends (before MATERIALIZED, ALIAS, CODEC, TTL, COMMENT, or comma/paren)
                    // Capture everything until next keyword or end
                    let defaultValue = '';
                    let i = 0;
                    let depth = 0;
                    let inSingleQuote = false;
                    let inDoubleQuote = false;

                    while (i < afterDefault.length) {
                        const char = afterDefault[i];
                        const prevChar = i > 0 ? afterDefault[i - 1] : '';

                        // Handle quoted strings
                        if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                            inSingleQuote = !inSingleQuote;
                            defaultValue += char;
                        } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                            inDoubleQuote = !inDoubleQuote;
                            defaultValue += char;
                        } else if (!inSingleQuote && !inDoubleQuote) {
                            // Check for keywords that end the default value
                            const remaining = afterDefault.substring(i);
                            if (remaining.match(/^\s*(?:MATERIALIZED|ALIAS|CODEC|TTL|COMMENT|,|\))/i)) {
                                break;
                            }

                            if (char === '(') depth++;
                            else if (char === ')') {
                                depth--;
                                if (depth < 0) break; // End of column definition
                            }

                            defaultValue += char;
                        } else {
                            defaultValue += char;
                        }

                        i++;
                    }

                    defaultValue = defaultValue.trim();
                    // Remove trailing commas/parentheses
                    defaultValue = defaultValue.replace(/[,)\s]+$/, '').trim();
                    if (defaultValue) {
                        defaultsMap.set(columnName.toLowerCase(), defaultValue);
                    }
                }
            }
        }
    }

    // ClickHouse DESCRIBE TABLE returns fields with various names depending on version
    // Map all possible field names to our standard format
    return rows.map((row: any) => {
        const name = row.name || row.column || row.Name || '';
        const defaultFromDescribe = row.default_expression || row.defaultExpression || row['default_expression'] || row['default expression'] || '';
        const defaultFromCreate = defaultsMap.get(name.toLowerCase()) || '';

        return {
            name,
            type: row.type || row.Type || '',
            default_type: row.default_type || row.defaultType || row['default_type'] || row['default type'] || (defaultFromDescribe || defaultFromCreate ? 'DEFAULT' : ''),
            default_expression: defaultFromDescribe || defaultFromCreate,
            comment: row.comment || row.Comment || ''
        };
    }) as Array<{ name: string; type: string; default_type?: string; default_expression?: string; comment?: string }>;
}

function cleanCommentString(comment: string | null) {
    if (!comment) return null;
    let cleaned = comment.trim();
    if (cleaned.includes('\\"')) {
        cleaned = cleaned.replace(/\\"/g, '"');
    }
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned;
}

function extractHousekitMetadata(comment: string | null) {
    if (!comment) return null;
    const cleaned = cleanCommentString(comment);
    if (!cleaned) return null;
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.housekit) return parsed.housekit;
    } catch {
        return null;
    }
    return null;
}

async function fetchTableMetadata(client: any, table: string) {
    const result = await client.query({
        query: `SELECT comment FROM system.tables WHERE name = {table:String} LIMIT 1`,
        query_params: { table },
        format: 'JSONEachRow'
    });
    const parsed = await result.json();
    const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
    const comment = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any)?.comment ?? null : null;
    return {
        comment: comment || null,
        housekit: extractHousekitMetadata(comment)
    };
}

export async function schemaCommand(options: { database?: string; tables?: string[] }) {
    const spinner = createSpinner('Loading schema from database');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName } = resolveDatabase(config, options.database);

        const tables = await fetchTables(client);
        if (tables.length === 0) {
            spinner.warn('No tables found in database.');
            await client.close();
            return;
        }

        spinner.succeed('Schema loaded');
        success(`Database: ${quoteName(dbName)}`);

        const desiredTables = options.tables?.map(t => t.toLowerCase());
        const selectedTables = desiredTables
            ? tables.filter(t => desiredTables.includes(t.toLowerCase()))
            : tables;

        if (desiredTables) {
            const missing = desiredTables.filter(d => !tables.some(t => t.toLowerCase() === d));
            if (selectedTables.length === 0) {
                warn(`Tables not found: ${missing.join(', ')}`);
                await client.close();
                return;
            }
            if (missing.length > 0) {
                warn(`Tables not found: ${missing.join(', ')}`);
            }
        }

        for (const table of selectedTables) {
            console.log(); // Add spacing between tables
            info(`Table: ${quoteName(table)}`);
            const rows = await fetchTableDefinition(client, table);
            const metadata = await fetchTableMetadata(client, table);

            // Format type to be more readable
            const formatType = (type: string): string => {
                // Replace Nullable(Type) with Type? for better readability
                const nullableMatch = type.match(/^Nullable\((.*)\)$/);
                if (nullableMatch) {
                    return `${nullableMatch[1]}?`;
                }
                return type;
            };

            // Check if any rows have default or comment values
            // ClickHouse returns default_type (DEFAULT, MATERIALIZED, ALIAS, or empty) and default_expression
            const hasDefaults = rows.some(row => {
                const hasDefaultType = row.default_type && row.default_type !== '';
                const hasDefaultExpr = row.default_expression && row.default_expression !== '';
                return hasDefaultType || hasDefaultExpr;
            });
            const hasComments = rows.some(row => row.comment);

            // Build table with only columns that have data
            const headers = ['Column', 'Type'];
            if (hasDefaults) headers.push('Default');
            if (hasComments) headers.push('Comment');

            const tableDisplay = new Table({
                head: headers,
                style: {
                    head: ['cyan', 'bold'],
                    border: ['gray'],
                    compact: false
                },
                chars: {
                    'top': '─',
                    'top-mid': '┬',
                    'top-left': '┌',
                    'top-right': '┐',
                    'bottom': '─',
                    'bottom-mid': '┴',
                    'bottom-left': '└',
                    'bottom-right': '┘',
                    'left': '│',
                    'left-mid': '',
                    'mid': '',
                    'mid-mid': '',
                    'right': '│',
                    'right-mid': '',
                    'middle': '│'
                },
                colWidths: hasDefaults || hasComments ? [null, null, hasDefaults ? 25 : null, hasComments ? 20 : null].filter(w => w !== null) : [null, null],
                wordWrap: true
            });

            rows.forEach(row => {
                const rowData: string[] = [
                    quoteName(row.name),
                    formatType(row.type)
                ];
                if (hasDefaults) {
                    const defaultValue = quoteValue(row.default_expression, row.default_type);
                    rowData.push(defaultValue);
                }
                if (hasComments) {
                    rowData.push(quoteComment(row.comment));
                }
                tableDisplay.push(rowData);
            });

            console.log(tableDisplay.toString());

            if (metadata.housekit) {
                const { version, appendOnly } = metadata.housekit as { version?: any; appendOnly?: any };
                info(`  Housekit metadata: version=${version ?? 'unset'}, appendOnly=${appendOnly ?? 'unset'}`);
            } else if (metadata.comment) {
                info(`  Table comment: ${quoteComment(metadata.comment)}`);
            }
        }

        if (selectedTables.length > 0) {
            console.log(); // Add spacing at the end
        }

        await client.close();
    } catch (e) {
        spinner.fail('Failed to load schema');
        error(String(e));
    }
}
