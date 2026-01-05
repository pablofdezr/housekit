import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { getConfigPath, loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, format, info, success, warn, listPrompt, confirmPrompt, inputPrompt, quoteName } from '../ui';


interface ColumnInfo {
    name: string;
    type: string;
    default_expression?: string;
    comment?: string;
}

function sanitizeName(name: string) {
    const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(cleaned)) {
        return `table_${cleaned}`;
    }
    return cleaned;
}

function mapColumnType(column: ColumnInfo): { code: string; type: string } {
    let nullable = false;
    let baseType = column.type;

    const nullableMatch = baseType.match(/^Nullable\((.*)\)$/);
    if (nullableMatch) {
        nullable = true;
        baseType = nullableMatch[1];
    }

    const typeLower = baseType.toLowerCase();

    let builder = 'text';

    // UUID
    if (typeLower.includes('uuid')) {
        builder = 'uuid';
    }
    // Integer types
    else if (typeLower === 'int8' || typeLower === 'tinyint') {
        builder = 'int8';
    }
    else if (typeLower === 'int16' || typeLower === 'smallint') {
        builder = 'int16';
    }
    else if (typeLower === 'int32' || typeLower.startsWith('int')) {
        builder = 'integer';
    }
    else if (typeLower === 'int64' || typeLower === 'bigint') {
        builder = 'int64';
    }
    // Unsigned integer types
    else if (typeLower === 'uint8') {
        builder = 'uint8';
    }
    else if (typeLower === 'uint16') {
        builder = 'uint16';
    }
    else if (typeLower === 'uint32') {
        builder = 'uint32';
    }
    else if (typeLower === 'uint64') {
        builder = 'uint64';
    }
    // Float types
    else if (typeLower === 'float32' || typeLower === 'float64' || typeLower.startsWith('float')) {
        builder = 'float';
    }
    // Decimal
    else if (typeLower.startsWith('decimal')) {
        builder = 'decimal';
    }
    // Date/Time types
    else if (typeLower === 'datetime64') {
        builder = 'datetime64';
    }
    else if (typeLower.includes('datetime') || typeLower === 'timestamp') {
        builder = 'timestamp';
    }
    else if (typeLower === 'date' || typeLower === 'date32') {
        builder = 'date';
    }
    // Boolean
    else if (typeLower === 'bool' || typeLower === 'boolean') {
        builder = 'boolean';
    }
    // Special string types
    else if (typeLower.startsWith('lowcardinality')) {
        builder = 'lowCardinality';
    }
    else if (typeLower.startsWith('fixedstring')) {
        builder = 'text'; // FixedString maps to text
    }
    // IP types
    else if (typeLower === 'ipv4') {
        builder = 'ipv4';
    }
    else if (typeLower === 'ipv6') {
        builder = 'ipv6';
    }
    // JSON
    else if (typeLower === 'json' || typeLower.startsWith('json')) {
        builder = 'json';
    }
    // Array types - parse inner type and generate arrayOf()
    else if (typeLower.startsWith('array')) {
        // Extract inner type from Array(InnerType)
        const innerTypeMatch = baseType.match(/^Array\((.+)\)$/i);
        if (innerTypeMatch) {
            const innerType = innerTypeMatch[1].trim();

            // Map inner type to builder function
            let innerBuilder = 'text';
            let innerColsNullable = false;
            let actualInnerType = innerType;

            const innerNullableMatch = innerType.match(/^Nullable\((.*)\)$/i);
            if (innerNullableMatch) {
                innerColsNullable = true;
                actualInnerType = innerNullableMatch[1].trim();
            }

            const innerTypeLower = actualInnerType.toLowerCase();

            if (innerTypeLower.includes('uuid')) innerBuilder = 'uuid';
            else if (innerTypeLower === 'int8') innerBuilder = 'int8';
            else if (innerTypeLower === 'int16') innerBuilder = 'int16';
            else if (innerTypeLower === 'int32' || innerTypeLower === 'integer' || innerTypeLower.startsWith('int')) innerBuilder = 'int32';
            else if (innerTypeLower === 'int64') innerBuilder = 'int64';
            else if (innerTypeLower === 'uint8') innerBuilder = 'uint8';
            else if (innerTypeLower === 'uint16') innerBuilder = 'uint16';
            else if (innerTypeLower === 'uint32') innerBuilder = 'uint32';
            else if (innerTypeLower === 'uint64') innerBuilder = 'uint64';
            else if (innerTypeLower.startsWith('float')) innerBuilder = 'float';
            else if (innerTypeLower.startsWith('decimal')) innerBuilder = 'decimal';
            else if (innerTypeLower === 'datetime64') innerBuilder = 'datetime64';
            else if (innerTypeLower.includes('datetime')) innerBuilder = 'timestamp';
            else if (innerTypeLower === 'date') innerBuilder = 'date';
            else if (innerTypeLower === 'bool' || innerTypeLower === 'boolean') innerBuilder = 'boolean';

            // Generate t.array(t.innerBuilder('name')[.nullable()])
            const innerCode = `t.${innerBuilder}('${column.name}')${innerColsNullable ? '.nullable()' : ''}`;
            builder = `t.array(${innerCode})`;
            // Return early since array already includes the column name
            return { code: builder, type: 'array' };
        }
        // Fallback if we can't parse
        builder = 'text';
    }

    let builderCall = `t.${builder}('${column.name}')`;

    // Add .nullable() if it's a Nullable type
    if (nullable) {
        builderCall += '.nullable()';
    }

    // Add .default() if there's a default expression
    if (column.default_expression) {
        // Check if it's a SQL expression (like now()) or a literal value
        const trimmed = column.default_expression.trim();
        const isExpression =
            trimmed.includes('(') && trimmed.includes(')') || // Function calls like now()
            trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/); // Function name followed by (

        if (isExpression) {
            // It's a SQL expression - escape single quotes and backslashes for JavaScript/TypeScript string
            const escaped = trimmed.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            builderCall += `.default('${escaped}')`;
        } else {
            // It's a literal value - might be quoted or not
            // Remove surrounding quotes if present
            let defaultValue = trimmed;
            if ((defaultValue.startsWith("'") && defaultValue.endsWith("'")) ||
                (defaultValue.startsWith('"') && defaultValue.endsWith('"'))) {
                defaultValue = defaultValue.slice(1, -1);
                // Unescape SQL-style single quotes ('' -> ')
                defaultValue = defaultValue.replace(/''/g, "'");
            }
            // Escape for JavaScript/TypeScript string
            const escaped = defaultValue.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            builderCall += `.default('${escaped}')`;
        }
    }

    // Add .comment() if there's a comment
    if (column.comment) {
        // Escape backslashes first, then single quotes for JavaScript/TypeScript string
        const escapedComment = column.comment.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        builderCall += `.comment('${escapedComment}')`;
    }

    return { code: builderCall, type: builder };
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

function extractEngineFromCreate(statement: string): string {
    const match = statement.match(/ENGINE\s*=\s*(.+?)(\s+(?:ORDER|PARTITION|PRIMARY|SAMPLE|TTL|SETTINGS|COMMENT)|$)/i);
    return match ? match[1].trim() : 'MergeTree()';
}

function buildTableFile(
    table: string,
    columns: ColumnInfo[],
    engineSQL: string,
    format: 'js' | 'ts' = 'ts',
    metadata?: { version?: string; appendOnly?: boolean; readOnly?: boolean } | null
) {
    // Map columns and collect used types
    const mappedColumns = columns.map(col => ({
        name: col.name,
        comment: col.comment,
        ...mapColumnType(col)
    }));
    const columnLines = mappedColumns.map(col => {
        const jsDocLines: string[] = [];
        if (col.comment) jsDocLines.push(col.comment);
        if (col.name.toLowerCase() === 'id') jsDocLines.push('@primaryKey');

        const jsDoc = jsDocLines.length
            ? `        /**\n         * ${jsDocLines.join('\n         * ')}\n         */\n`
            : '';

        return `${jsDoc}        ${col.name}: ${col.code}`;
    }).join(',\n\n');
    const variableName = sanitizeName(table);

    // Generate timestamp for comment
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    const comment = `// Auto-generated on ${timestamp}\n`;

    // Build options block
    const optionLines: string[] = [];
    const escapedEngine = engineSQL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    optionLines.push(`    customEngine: "${escapedEngine}"`);
    if (metadata?.version) {
        optionLines.push(`    metadataVersion: "${metadata.version}"`);
    } else {
        optionLines.push(`    metadataVersion: "1.2.0"`);
    }
    if (metadata && typeof metadata.appendOnly === 'boolean') {
        optionLines.push(`    appendOnly: ${metadata.appendOnly}`);
    }
    if (metadata && 'readOnly' in metadata && typeof metadata.readOnly === 'boolean') {
        optionLines.push(`    readOnly: ${metadata.readOnly}`);
    }
    const optionsBlock = optionLines.length > 0 ? `, {\n${optionLines.join(',\n')}\n}` : '';

    const exportStatement = `export const ${variableName} = defineTable('${table}', (t) => ({\n${columnLines}\n})${optionsBlock});`;
    const importLine = `import { t, defineTable, Engine } from '@housekit/orm';`;
    const typeAlias = '\n';

    return `${comment}${importLine}

${exportStatement}${typeAlias}
`;
}

function persistLanguagePreference(configPath: string, lang: 'js' | 'ts') {
    try {
        const original = readFileSync(configPath, 'utf-8');
        if (/language\s*:/.test(original)) return; // already set
        const insert = `\n    language: "${lang}",`;
        let updated = original;
        if (/schema:\s*["']/.test(original)) {
            // Insert after schema line, preserving any existing comment
            updated = original.replace(/(schema:\s*["'][^"']*["'])\s*(,?)\s*(\/\/[^\n]*)?\s*\n/, (match, schemaPart, comma, comment) => {
                const schemaLine = `${schemaPart}${comma || ','}${comment ? ' ' + comment : ''}\n`;
                return schemaLine + insert + '\n';
            });
        } else if (/out:\s*["']/.test(original)) {
            updated = original.replace(/(out:\s*["'][^"']*["'],?)\s*\n/, `$1${insert}\n`);
        } else {
            updated = original.replace(/export default\s*\{/, match => `${match}${insert}`);
        }
        writeFileSync(configPath, updated);
    } catch {
        // best effort; if it fails we just skip persisting
    }
}

export async function pullCommand(options: { database?: string }) {
    const spinner = createSpinner('Introspecting database schema');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName, schemaPath } = resolveDatabase(config, options.database);

        if (!schemaPath) {
            spinner.stop();
            console.log(); // Add linebreak
            error('No schema path configured for selected database');
            await client.close();
            return;
        }

        const tablesResult = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
        const parsed = await tablesResult.json() as any;
        const tableRows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
        if (!Array.isArray(tableRows)) {
            throw new TypeError('Unexpected response format for SHOW TABLES');
        }
        const tables = tableRows.map((r: any) => r.name || r);

        if (tables.length === 0) {
            spinner.stop();
            console.log(); // Add linebreak
            warn('No tables found to pull.');
            await client.close();
            return;
        }

        spinner.stop();
        console.log(); // Add linebreak
        success(`Found ${tables.length} tables`);

        // Ask what to generate: schema files or migrations
        const outputType = await listPrompt<'schema' | 'migrations'>(
            'What would you like to generate?',
            [
                { name: 'Schema files (TypeScript/JavaScript)', value: 'schema' },
                { name: 'SQL migrations', value: 'migrations' }
            ],
            'schema'
        );

        if (outputType === 'migrations') {
            // Generate migrations
            const outDir = config.out || './housekit';

            const migrationFolderName = await inputPrompt(
                'Enter migration folder name (within housekit):',
                dbName,
                (input: string) => {
                    if (!input.trim()) {
                        return 'Folder name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                        return 'Folder name can only contain letters, numbers, underscores, and hyphens';
                    }
                    return true;
                }
            );

            const migrationDir = join(process.cwd(), outDir, migrationFolderName);
            if (!existsSync(migrationDir)) mkdirSync(migrationDir, { recursive: true });

            // Ask if user wants to download all tables or confirm one by one
            const downloadMode = await listPrompt<'all' | 'one-by-one'>(
                'How would you like to download the tables?',
                [
                    { name: 'Download all tables', value: 'all' },
                    { name: 'Confirm each table individually', value: 'one-by-one' }
                ],
                'all'
            );

            let downloadedCount = 0;

            for (const tableName of tables) {
                // If one-by-one mode, ask for confirmation
                if (downloadMode === 'one-by-one') {
                    const confirm = await confirmPrompt(`Generate migration for table ${quoteName(tableName)}?`, true);

                    if (!confirm) {
                        info(`Skipped ${quoteName(tableName)}`);
                        continue;
                    }
                }

                const describeSpinner = createSpinner(`Fetching schema for ${tableName}`);
                describeSpinner.start();

                try {
                    // Get CREATE TABLE statement
                    const createResult = await client.query({ query: `SHOW CREATE TABLE \`${tableName}\``, format: 'JSONEachRow' });
                    const createParsed = await createResult.json() as any;
                    const createRows = Array.isArray(createParsed) ? createParsed : (createParsed?.data ?? []);
                    const createStatement = Array.isArray(createRows) && createRows.length > 0
                        ? (createRows[0] as any)?.statement || ''
                        : '';

                    if (!createStatement) {
                        throw new Error(`Could not get CREATE TABLE statement for ${tableName}`);
                    }

                    // Convert to CREATE TABLE IF NOT EXISTS for migrations
                    const migrationSQL = createStatement.replace(/CREATE\s+TABLE/i, 'CREATE TABLE IF NOT EXISTS');

                    // Generate migration file with timestamp
                    const timestamp = new Date().getTime();
                    const migrationFileName = `${timestamp}_${tableName}.sql`;
                    const migrationPath = join(migrationDir, migrationFileName);

                    writeFileSync(migrationPath, migrationSQL + ';');
                    describeSpinner.stop();
                    success(`Generated migration for ${quoteName(tableName)}`);
                    downloadedCount++;
                } catch (e) {
                    describeSpinner.stop();
                    error(`Failed to generate migration for ${quoteName(tableName)}`);
                    error(String(e));
                }
            }

            console.log(); // Add linebreak before summary
            if (downloadedCount > 0) {
                success(`Generated ${downloadedCount} migration${downloadedCount === 1 ? '' : 's'} in ${quoteName(migrationFolderName)}`);
            } else {
                warn('No migrations were generated');
            }

            await client.close();
            return;
        }

        // Continue with schema files generation (existing code)
        // Determine file format from config preference, fallback to prompt
        let fileFormat: 'js' | 'ts';
        if (config.language === 'js' || config.language === 'ts') {
            fileFormat = config.language;
            info(`Using schema file format from config: ${fileFormat.toUpperCase()}`);
        } else {
            fileFormat = await listPrompt<'js' | 'ts'>(
                'Choose file format:',
                [
                    { name: 'TypeScript (.ts)', value: 'ts' },
                    { name: 'JavaScript (.js)', value: 'js' }
                ],
                'ts'
            );
            try {
                const configPath = await getConfigPath();
                persistLanguagePreference(configPath, fileFormat);
                info(`Saved language preference (${fileFormat.toUpperCase()}) to housekit.config`);
            } catch {
                // If we can't persist, continue without failing
            }
        }

        // Ask if user wants to download all tables or confirm one by one
        const downloadMode = await listPrompt<'all' | 'one-by-one'>(
            'How would you like to download the tables?',
            [
                { name: 'Download all tables', value: 'all' },
                { name: 'Confirm each table individually', value: 'one-by-one' }
            ],
            'all'
        );

        // Ask if user wants to organize tables in a subdirectory
        const useSubdirectory = await confirmPrompt('Organize tables in a subdirectory?', false);
        let subdirectoryName = '';

        if (useSubdirectory) {
            subdirectoryName = await inputPrompt(
                'Enter subdirectory name:',
                undefined,
                (input: string) => {
                    if (!input.trim()) {
                        return 'Subdirectory name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                        return 'Subdirectory name can only contain letters, numbers, underscores, and hyphens';
                    }
                    return true;
                }
            );
        }

        let targetDir = join(process.cwd(), schemaPath);
        if (useSubdirectory && subdirectoryName) {
            targetDir = join(targetDir, subdirectoryName);
        }
        if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

        let downloadedCount = 0;
        const fileExtension = fileFormat;

        for (const tableName of tables) {
            // If one-by-one mode, ask for confirmation
            if (downloadMode === 'one-by-one') {
                const confirm = await confirmPrompt(`Download schema for table ${quoteName(tableName)}?`, true);

                if (!confirm) {
                    info(`Skipped ${quoteName(tableName)}`);
                    continue;
                }
            }

            const describeSpinner = createSpinner(`Fetching schema for ${tableName}`);
            describeSpinner.start();

            try {
                // Get column definitions from DESCRIBE TABLE
                const describeResult = await client.query({ query: `DESCRIBE TABLE \`${tableName}\``, format: 'JSONEachRow' });
                const parsedColumns = await describeResult.json() as any;
                const columnRows = Array.isArray(parsedColumns) ? parsedColumns : (parsedColumns?.data ?? []);
                if (!Array.isArray(columnRows)) {
                    throw new TypeError(`Unexpected response format for DESCRIBE TABLE ${tableName}`);
                }

                // Also get CREATE TABLE statement to extract defaults and comments and table metadata
                const createResult = await client.query({ query: `SHOW CREATE TABLE \`${tableName}\``, format: 'JSONEachRow' });
                const createParsed = await createResult.json() as any;
                const createRows = Array.isArray(createParsed) ? createParsed : (createParsed?.data ?? []);
                const createStatement = Array.isArray(createRows) && createRows.length > 0
                    ? (createRows[0] as any)?.statement || ''
                    : '';
                const engineSQL = extractEngineFromCreate(createStatement);

                // Fetch table-level comment directly from system.tables
                let tableMetadata: { version: string; appendOnly?: boolean; readOnly?: boolean } | null = null;
                try {
                    const commentRes = await client.query({
                        query: `SELECT comment FROM system.tables WHERE name = {table:String} AND database = {db:String} LIMIT 1`,
                        query_params: { table: tableName, db: dbName },
                        format: 'JSONEachRow'
                    });
                    const commentParsed: any = await commentRes.json();
                    const commentRows = Array.isArray(commentParsed) ? commentParsed : (commentParsed?.data ?? []);
                    const tableComment = Array.isArray(commentRows) && commentRows.length > 0
                        ? (commentRows[0] as any)?.comment ?? null
                        : null;

                    const metaRaw = extractHousekitMetadata(tableComment);
                    if (metaRaw) {
                        tableMetadata = metaRaw;
                    }
                } catch {
                    // ignore; no metadata
                }

                // Parse defaults and comments from CREATE TABLE statement
                const defaultsMap = new Map<string, string>();
                const commentsMap = new Map<string, string>();

                if (createStatement && columnRows.length > 0) {
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

                        // Parse each column for DEFAULT and COMMENT clauses
                        for (const colDef of columns) {
                            // Skip if it's not a column definition (e.g., ENGINE, ORDER BY, etc.)
                            if (!colDef.match(/^[`]?[a-zA-Z_][a-zA-Z0-9_]*[`]?\s+/)) continue;

                            // Extract column name
                            const nameMatch = colDef.match(/^[`]?([a-zA-Z_][a-zA-Z0-9_]*)[`]?\s+/);
                            if (!nameMatch) continue;

                            const columnName = nameMatch[1];

                            // Look for DEFAULT clause
                            const defaultIndex = colDef.search(/\bDEFAULT\s+/i);
                            if (defaultIndex >= 0) {
                                const afterDefault = colDef.substring(defaultIndex + 7); // Skip "DEFAULT"
                                let defaultValue = '';
                                let i = 0;
                                let depth = 0;
                                let inSingleQuote = false;
                                let inDoubleQuote = false;

                                while (i < afterDefault.length) {
                                    const char = afterDefault[i];
                                    const prevChar = i > 0 ? afterDefault[i - 1] : '';

                                    if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                                        inSingleQuote = !inSingleQuote;
                                        defaultValue += char;
                                    } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                                        inDoubleQuote = !inDoubleQuote;
                                        defaultValue += char;
                                    } else if (!inSingleQuote && !inDoubleQuote) {
                                        const remaining = afterDefault.substring(i);
                                        if (remaining.match(/^\s*(?:MATERIALIZED|ALIAS|CODEC|TTL|COMMENT|,|\))/i)) {
                                            break;
                                        }

                                        if (char === '(') depth++;
                                        else if (char === ')') {
                                            depth--;
                                            if (depth < 0) break;
                                        }

                                        defaultValue += char;
                                    } else {
                                        defaultValue += char;
                                    }

                                    i++;
                                }

                                defaultValue = defaultValue.trim().replace(/[,)\s]+$/, '').trim();
                                if (defaultValue) {
                                    defaultsMap.set(columnName.toLowerCase(), defaultValue);
                                }
                            }

                            // Look for COMMENT clause
                            const commentIndex = colDef.search(/\bCOMMENT\s+/i);
                            if (commentIndex >= 0) {
                                const afterComment = colDef.substring(commentIndex + 7); // Skip "COMMENT"
                                let commentValue = '';
                                let i = 0;
                                let inSingleQuote = false;
                                let inDoubleQuote = false;

                                while (i < afterComment.length) {
                                    const char = afterComment[i];
                                    const prevChar = i > 0 ? afterComment[i - 1] : '';

                                    if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                                        if (inSingleQuote) {
                                            // End of comment
                                            break;
                                        }
                                        inSingleQuote = true;
                                    } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                                        if (inDoubleQuote) {
                                            // End of comment
                                            break;
                                        }
                                        inDoubleQuote = true;
                                    } else if (inSingleQuote || inDoubleQuote) {
                                        commentValue += char;
                                    } else if (char === ',' || char === ')') {
                                        break;
                                    }

                                    i++;
                                }

                                commentValue = commentValue.trim();
                                if (commentValue) {
                                    commentsMap.set(columnName.toLowerCase(), commentValue);
                                }
                            }
                        }
                    }
                }

                // Combine DESCRIBE TABLE data with parsed defaults and comments
                const columns: ColumnInfo[] = columnRows.map((row: any) => {
                    const name = row.name || row.column || row.Name || '';
                    const defaultFromDescribe = row.default_expression || row.defaultExpression || row['default_expression'] || row['default expression'] || '';
                    const defaultFromCreate = defaultsMap.get(name.toLowerCase()) || '';
                    const commentFromDescribe = row.comment || row.Comment || '';
                    const commentFromCreate = commentsMap.get(name.toLowerCase()) || '';

                    return {
                        name,
                        type: row.type || row.Type || '',
                        default_expression: defaultFromDescribe || defaultFromCreate,
                        comment: commentFromDescribe || commentFromCreate
                    };
                });

                const content = buildTableFile(tableName, columns, engineSQL, fileFormat, tableMetadata);
                writeFileSync(join(targetDir, `${tableName}.${fileExtension}`), content);
                describeSpinner.stop();
                success(`Wrote schema file for ${quoteName(tableName)}`);
                downloadedCount++;
            } catch (e) {
                describeSpinner.stop();
                error(`Failed to fetch schema for ${quoteName(tableName)}`);
                error(String(e));
            }
        }

        console.log(); // Add linebreak before summary
        if (downloadedCount > 0) {
            success(`Pulled schema for ${downloadedCount} table${downloadedCount === 1 ? '' : 's'} from ${quoteName(dbName)}`);
        } else {
            warn('No tables were downloaded');
        }

        await client.close();
    } catch (e) {
        spinner.stop();
        console.log(); // Add linebreak
        error('Failed to pull schema');
        error(String(e));
    }
}
