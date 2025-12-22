
export type StatementType =
    | 'CREATE_TABLE'
    | 'ALTER_ADD_COLUMN'
    | 'ALTER_MODIFY_COLUMN'
    | 'ALTER_MODIFY_COMMENT'
    | 'ALTER_TABLE'
    | 'DROP_TABLE'
    | 'UNKNOWN';

export interface ParsedStatement {
    type: StatementType;
    tableName?: string;
    columnName?: string;
    columnType?: string;
    comment?: string;
    statement: string;
}

export interface ParsedIndex {
    name: string;
    expression: string;
    type: string;
    granularity?: number;
}

export interface ParsedProjection {
    name: string;
    query: string;
}

export interface ParsedCreateOptions {
    engine?: string;
    onCluster?: string;
    orderBy?: string;
    partitionBy?: string;
    ttl?: string;
    primaryKey?: string;
    indices?: ParsedIndex[];
    projections?: ParsedProjection[];
}

/**
 * Parses a single SQL statement to extract semantic information.
 */
export function parseStatement(statement: string): ParsedStatement {
    const trimmed = statement.trim();
    if (!trimmed) {
        return { type: 'UNKNOWN', statement: '' };
    }

    // CREATE TABLE IF NOT EXISTS
    const createMatch = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i);
    if (createMatch) {
        return {
            type: 'CREATE_TABLE',
            tableName: createMatch[1],
            statement: trimmed
        };
    }

    // ALTER TABLE ... ADD COLUMN
    const addColumnMatch = trimmed.match(/ALTER\s+TABLE\s+`([^`]+)`\s+ADD\s+COLUMN\s+`([^`]+)`\s+(.+)/i);
    if (addColumnMatch) {
        return {
            type: 'ALTER_ADD_COLUMN',
            tableName: addColumnMatch[1],
            columnName: addColumnMatch[2],
            columnType: addColumnMatch[3].trim(),
            statement: trimmed
        };
    }

    // ALTER TABLE ... MODIFY COLUMN
    const modifyColumnMatch = trimmed.match(/ALTER\s+TABLE\s+`([^`]+)`\s+MODIFY\s+COLUMN\s+`([^`]+)`\s+(.+)/i);
    if (modifyColumnMatch) {
        return {
            type: 'ALTER_MODIFY_COLUMN',
            tableName: modifyColumnMatch[1],
            columnName: modifyColumnMatch[2],
            columnType: modifyColumnMatch[3].trim(),
            statement: trimmed
        };
    }

    // ALTER TABLE ... MODIFY COMMENT
    const modifyCommentMatch = trimmed.match(/ALTER\s+TABLE\s+`([^`]+)`\s+MODIFY\s+COMMENT\s+'((?:[^']|'')*)'/i);
    if (modifyCommentMatch) {
        return {
            type: 'ALTER_MODIFY_COMMENT',
            tableName: modifyCommentMatch[1],
            comment: modifyCommentMatch[2].replace(/''/g, "'"),
            statement: trimmed
        };
    }

    // General ALTER TABLE match
    const alterMatch = trimmed.match(/ALTER\s+TABLE\s+`([^`]+)`/i);
    if (alterMatch) {
        return {
            type: 'ALTER_TABLE',
            tableName: alterMatch[1],
            statement: trimmed
        };
    }

    // DROP TABLE
    const dropMatch = trimmed.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`([^`]+)`/i);
    if (dropMatch) {
        return {
            type: 'DROP_TABLE',
            tableName: dropMatch[1],
            statement: trimmed
        };
    }

    return {
        type: 'UNKNOWN',
        statement: trimmed
    };
}

/**
 * Parses a SHOW CREATE TABLE statement into structured options.
 */
export function parseCreate(statement: string): ParsedCreateOptions {
    const opts: ParsedCreateOptions = {};

    // Engine
    const engineMatch = statement.match(/ENGINE\s*=\s*([a-zA-Z0-9_]+)/i);
    if (engineMatch) opts.engine = engineMatch[1];

    // ON CLUSTER
    const clusterMatch = statement.match(/ON\s+CLUSTER\s+`?([^`\s]+)`?/i);
    if (clusterMatch) opts.onCluster = clusterMatch[1];

    // Order By
    const orderByMatch = statement.match(/ORDER\s+BY\s+([^\s,;()]+|\([^)]+\))/i);
    if (orderByMatch) opts.orderBy = orderByMatch[1].replace(/[()]/g, '');

    // Partition By
    const partitionByMatch = statement.match(/PARTITION\s+BY\s+([^\s,;()]+|\([^)]+\))/i);
    if (partitionByMatch) opts.partitionBy = partitionByMatch[1].replace(/[()]/g, '');

    // TTL
    const ttlMatch = statement.match(/TTL\s+(.*?)(?=\s+(?:SETTINGS|INDEX|PROJECTION|PRIMARY|ORDER|PARTITION|$))/i);
    if (ttlMatch) opts.ttl = ttlMatch[1].trim();

    // Primary Key
    const primaryKeyMatch = statement.match(/PRIMARY\s+KEY\s+([^\s,;()]+|\([^)]+\))/i);
    if (primaryKeyMatch) opts.primaryKey = primaryKeyMatch[1].replace(/[()]/g, '');

    // Indexes
    opts.indices = [];
    const indexRegex = /INDEX\s+`?([^`\s]+)`?\s+(.+?)\s+TYPE\s+([a-zA-Z0-9_]+(?:\([^)]*\))?)\s+GRANULARITY\s+(\d+)/gi;
    let match;
    while ((match = indexRegex.exec(statement)) !== null) {
        opts.indices.push({
            name: match[1],
            expression: match[2],
            type: match[3],
            granularity: parseInt(match[4], 10)
        });
    }

    // Projections
    opts.projections = [];
    const projectionRegex = /PROJECTION\s+`?([^`\s]+)`?\s+\((.+?)\)/gi;
    while ((match = projectionRegex.exec(statement)) !== null) {
        opts.projections.push({
            name: match[1],
            query: match[2]
        });
    }

    return opts;
}

/**
 * Extracts column definitions from a CREATE TABLE statement.
 */
export function parseColumnsFromCreate(statement: string): Array<{ name: string, definition: string, defaultValue?: string }> {
    // Find the content between first level of parentheses
    const start = statement.indexOf('(');
    if (start === -1) return [];

    let end = -1;
    let depth = 0;
    for (let i = start; i < statement.length; i++) {
        if (statement[i] === '(') depth++;
        else if (statement[i] === ')') depth--;

        if (depth === 0) {
            end = i;
            break;
        }
    }

    if (end === -1) return [];

    const inner = statement.substring(start + 1, end);
    const columns: Array<{ name: string, definition: string, defaultValue?: string }> = [];

    // Split by comma, but handle parens and single quotes
    let current = '';
    depth = 0;
    let inSingleQuote = false;
    const parts: string[] = [];
    for (let i = 0; i < inner.length; i++) {
        const char = inner[i];
        const prevChar = i > 0 ? inner[i - 1] : '';

        if (char === "'" && prevChar !== '\\') {
            inSingleQuote = !inSingleQuote;
        }

        if (!inSingleQuote) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
        }

        if (char === ',' && depth === 0 && !inSingleQuote) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) parts.push(current.trim());

    for (const part of parts) {
        // Skip INDEX, PROJECTION, PRIMARY KEY, or CONSTRAINT inside the column list
        const upperPart = part.toUpperCase();
        if (upperPart.startsWith('INDEX') ||
            upperPart.startsWith('PROJECTION') ||
            upperPart.startsWith('PRIMARY KEY') ||
            upperPart.startsWith('CONSTRAINT')) continue;

        const match = part.match(/^`?([^`\s]+)`?\s+(.+)$/);
        if (match) {
            const name = match[1];
            let definition = match[2];
            let defaultValue: string | undefined;

            // Extract COMMENT if exists (it can have nested quotes)
            const commentMatch = definition.match(/\s+COMMENT\s+('([^']|'')*')/i);
            if (commentMatch) {
                // We keep definition for type extraction later, but we need to isolate DEFAULT
                definition = definition.replace(/\s+COMMENT\s+'(?:[^']|'')*'/i, '').trim();
            }

            // Extract DEFAULT if exists
            // A default value can be a function call, a string, a number, etc.
            // We match everything until the end of the definition (since we already stripped COMMENT)
            const defaultMatch = definition.match(/\s+DEFAULT\s+(.+)$/i);
            if (defaultMatch) {
                defaultValue = defaultMatch[1].trim();
                definition = definition.replace(/\s+DEFAULT\s+.+$/i, '').trim();
            }

            columns.push({ name, definition, defaultValue });
        }
    }

    return columns;
}

/**
 * Analyzes EXPLAIN output for potential performance issues.
 */
export function analyzeExplain(explainText: string): string[] {
    const warnings: string[] = [];
    const text = explainText.toUpperCase();

    if (text.includes('STEP: FULL SCAN') || text.includes('READING ALL BLOCKS')) {
        warnings.push('Full table scan detected. Consider adding filters or using an index.');
    }

    if (text.includes('STEP: SORT') && !text.includes('PRE-SORTED')) {
        warnings.push('Query requires in-memory sort. Consider using a matching ORDER BY in the table definition.');
    }

    if (text.includes('STEP: JOIN') && text.includes('HASH')) {
        warnings.push('Hash join detected, which can be memory intensive. Ensure tables are joined on small columns.');
    }

    if (text.includes('UNRECOGNIZED HINT') || text.includes('INDEX NOT USED')) {
        warnings.push('One of your indexes was not used for this query.');
    }

    return warnings;
}
