import { ClickHouseColumn } from './core';

export type SQLWrapper = SQLExpression | ClickHouseColumn | SQLValue;
export type SQLValue = string | number | boolean | Date | null | string[] | number[];

export interface ToSQLOptions {
    ignoreTablePrefix?: boolean;
    table?: { $columns: Record<string, any> };
}

export type AliasedExpression<TResult = any, TAlias extends string = string> = SQLExpression<TResult> & { _alias: TAlias };

export interface SQLExpression<TResult = any> {
    _type: TResult; // Phantom type to help inference
    toSQL(options?: ToSQLOptions): { sql: string; params: Record<string, unknown> };
    as<TAlias extends string>(alias: TAlias): AliasedExpression<TResult, TAlias>;
    walk(visitor: (value: any, type: string) => void): string;
}

// UUID regex pattern: matches standard UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inferType(val: any, contextCol?: ClickHouseColumn): string {
    // Prefer column context to avoid regex work
    if (contextCol) {
        if (contextCol.type === 'UUID') return 'UUID';
        if (contextCol.type.startsWith('Int') || contextCol.type.startsWith('UInt')) return contextCol.type;
        if (contextCol.type.startsWith('Float') || contextCol.type.startsWith('Decimal')) return contextCol.type;
    }

    if (val === null) return 'String'; // Nullable?
    if (typeof val === 'number') return Number.isInteger(val) ? 'Int32' : 'Float64';
    if (typeof val === 'boolean') return 'Bool';
    if (val instanceof Date) return 'DateTime';
    if (Array.isArray(val)) {
        if (val.length > 0) return `Array(${inferType(val[0])})`;
        return 'Array(String)';
    }
    // Check if string is a valid UUID format
    if (typeof val === 'string' && val.length === 36 && UUID_REGEX.test(val)) {
        return 'UUID';
    }
    if (typeof val === 'object') return 'String'; // Assume JSON string for objects
    return 'String';
}

export class SQL<TResult = any> implements SQLExpression<TResult> {
    readonly _type!: TResult;

    constructor(readonly queryChunks: string[], readonly params: any[]) { }

    as<TAlias extends string>(alias: TAlias): AliasedExpression<TResult, TAlias> {
        const cloned = new SQL<TResult>([...this.queryChunks], [...this.params]) as unknown as AliasedExpression<TResult, TAlias>;
        (cloned as any)._alias = alias;
        return cloned;
    }

    walk(visitor: (value: any, type: string) => void): string {
        let structure = '';
        let lastColumn: ClickHouseColumn | null = null;

        for (let i = 0; i < this.queryChunks.length; i++) {
            structure += this.queryChunks[i];
            if (i < this.params.length) {
                const param = this.params[i];

                // Check if it's a ClickHouseColumn
                const isColumnByInstanceof = param instanceof ClickHouseColumn;
                const isColumnByProperties = param && typeof param === 'object' &&
                    'name' in param && 'type' in param && 'toSQL' in param;

                if (isColumnByInstanceof || isColumnByProperties) {
                    const col = param as ClickHouseColumn;
                    lastColumn = col;
                    structure += col.tableName ? `${col.tableName}.${col.name}` : col.name;
                } else if (typeof param === 'object' && param !== null && 'walk' in param) {
                    // Recursive walk
                    structure += (param as SQLExpression).walk(visitor);
                    lastColumn = null;
                } else {
                    // It's a value
                    if (param !== undefined) {
                        const type = inferType(param, lastColumn || undefined);
                        visitor(param, type);
                        structure += `{:${type}}`; // Placeholder in structure
                    }
                    lastColumn = null;
                }
            }
        }
        return structure;
    }

    private formatColumn(col: ClickHouseColumn, options?: ToSQLOptions) {
        if (options?.ignoreTablePrefix) {
            return `\`${col.name}\``;
        }
        return col.tableName ? `\`${col.tableName}\`.\`${col.name}\`` : `\`${col.name}\``;
    }

    toSQL(options?: ToSQLOptions) {
        const finalParams: Record<string, unknown> = {};
        let sql = '';
        let lastColumn: ClickHouseColumn | null = null;

        for (let i = 0; i < this.queryChunks.length; i++) {
            sql += this.queryChunks[i];
            if (i < this.params.length) {
                const param = this.params[i];

                // Check if it's a ClickHouseColumn by instanceof or by properties
                // Improved detection: check for all required properties of ClickHouseColumn
                const isColumnByInstanceof = param instanceof ClickHouseColumn;
                const isColumnByProperties = param && typeof param === 'object' &&
                    'name' in param &&
                    'type' in param &&
                    'toSQL' in param &&
                    typeof (param as any).name === 'string' &&
                    typeof (param as any).type === 'string' &&
                    typeof (param as any).toSQL === 'function';

                const isColumn = isColumnByInstanceof || isColumnByProperties;

                if (isColumn) {
                    lastColumn = param as ClickHouseColumn;
                    sql += this.formatColumn(lastColumn, options);
                } else if (typeof param === 'object' && param !== null && 'toSQL' in param) {
                    // Recursive call passing options down
                    const res = (param as SQLExpression).toSQL(options);
                    sql += res.sql;
                    Object.assign(finalParams, res.params);
                    lastColumn = null; // Reset after expression
                } else {
                    // Validate that value is not undefined
                    // However, if we're in a context where this might be a column that wasn't resolved,
                    // we should try to resolve it using the table context if available
                    if (param === undefined) {
                        // Try to resolve the column using table context if available
                        if (options?.table?.$columns) {
                            // When we have table context and receive undefined, this is likely a column
                            // that wasn't resolved by the Proxy. We can't reliably guess which column
                            // it should be, but we can provide a helpful error message.
                            // The real fix should be in the Proxy to always return the correct column.
                            const paramIndex = i;
                            const context = paramIndex > 0 ? ` (parameter ${paramIndex} in expression)` : '';
                            const sqlContext = sql.substring(Math.max(0, sql.length - 50));
                            const possibleColumnNames = Object.keys(options.table.$columns);
                            const availableColumns = possibleColumnNames.slice(0, 10).join(', ');

                            // Check if this might be a common column name pattern
                            const commonNames = ['name', 'email', 'id', 'userId', 'firstName', 'lastName'];
                            const suggestedColumns = commonNames
                                .filter(name => possibleColumnNames.includes(name))
                                .slice(0, 3)
                                .join(', ');

                            throw new Error(
                                `Cannot use undefined value in SQL expression${context}. ` +
                                `A table column is undefined (e.g., users.name is undefined when calling concat(users.name, ...)).\n\n` +
                                `This usually happens when:\n` +
                                `  1. The Proxy didn't resolve the column correctly\n` +
                                `  2. The column name doesn't match (check camelCase vs snake_case)\n` +
                                `  3. The column doesn't exist on the table\n\n` +
                                `Make sure you're accessing columns correctly: table.columnName (e.g., users.email)\n` +
                                (suggestedColumns ? `Suggested columns: ${suggestedColumns}\n` : '') +
                                `Available columns: ${availableColumns}${possibleColumnNames.length > 10 ? '...' : ''}\n` +
                                `SQL context: ...${sqlContext}`
                            );
                        } else {
                            // No table context available
                            const paramIndex = i;
                            const context = paramIndex > 0 ? ` (parameter ${paramIndex} in expression)` : '';
                            const sqlContext = sql.substring(Math.max(0, sql.length - 50));
                            throw new Error(
                                `Cannot use undefined value in SQL expression${context}. ` +
                                `This usually means:\n` +
                                `  1. A table column is undefined (e.g., users.name is undefined when calling concat(users.name, ...))\n` +
                                `  2. A property wasn't returned from a previous query\n` +
                                `  3. The column doesn't exist on the table\n\n` +
                                `Make sure you're accessing columns correctly: table.columnName (e.g., users.email)\n` +
                                `SQL context: ...${sqlContext}`
                            );
                        }
                    }

                    const paramName = `p_${Object.keys(finalParams).length + 1}`;

                    // Handle Date objects - format as ClickHouse DateTime string
                    let finalVal = param;
                    if (param instanceof Date) {
                        // Format Date as 'YYYY-MM-DD HH:mm:ss' for ClickHouse DateTime
                        const iso = param.toISOString();
                        const [datePart, timePart] = iso.split('T');
                        const [time] = timePart.split('.'); // strip milliseconds and Z
                        finalVal = `${datePart} ${time}`;
                    } else if (typeof param === 'object' && param !== null && !Array.isArray(param)) {
                        // Handle JSON objects automatically
                        finalVal = JSON.stringify(param);
                    }

                    finalParams[paramName] = finalVal;
                    // Use column context if available (for UUID detection)
                    const type = inferType(param, lastColumn || undefined);
                    sql += `{${paramName}:${type}}`;
                    lastColumn = null; // Reset after value
                }
            }
        }
        return { sql, params: finalParams };
    }
}

export function sql<T = any>(strings: TemplateStringsArray, ...args: any[]): SQLExpression<T> {
    return new SQL([...strings], args);
}

/**
 * Create a raw SQL fragment without parameter binding.
 * Use with caution - values are NOT escaped.
 * 
 * @example
 * sql.raw('dictGet(...)') // Inserted as-is into the query
 */
sql.raw = function (rawSql: string): SQLExpression {
    // Return a minimal SQLExpression that just outputs the raw SQL
    return {
        _type: undefined as any,
        toSQL: () => ({ sql: rawSql, params: {} }),
        walk: () => rawSql,
        as: function <TAlias extends string>(alias: TAlias) {
            return {
                ...this,
                _alias: alias
            } as AliasedExpression<any, TAlias>;
        }
    };
};

/**
 * Join multiple SQL fragments with a separator.
 * 
 * @example
 * sql.join([sql`col1`, sql`col2`], sql`, `)
 */
sql.join = function (expressions: (SQLExpression | ClickHouseColumn | SQLValue)[], separator: SQLExpression | string = sql`, `): SQLExpression {
    if (expressions.length === 0) return sql``;

    const chunks: string[] = [''];
    const params: any[] = [];
    const sep = typeof separator === 'string' ? sql.raw(separator) : separator;

    expressions.forEach((expr, i) => {
        params.push(expr);
        if (i < expressions.length - 1) {
            params.push(sep);
            chunks.push('', '');
        } else {
            chunks.push('');
        }
    });

    return new SQL(chunks, params);
};

/**
 * Typed SQL helper that preserves types for columns from a table definition.
 */
export function typedSQL<T extends Record<string, ClickHouseColumn>>(strings: TemplateStringsArray, ...args: Array<SQLValue | SQLExpression | T[keyof T]>) {
    return new SQL([...strings], args);
}


/**
 * Generic function call helper for any ClickHouse function
 * @param name Function name
 * @param args Function arguments
 * @example fn('hex', md5(users.email))
 * @example fn('length', users.interests)
 */
export function fn(name: string, ...args: (ClickHouseColumn | SQLExpression | SQLValue)[]): SQLExpression {
    const chunks: string[] = [`${name}(`];
    const params: any[] = [];

    args.forEach((arg, i) => {
        params.push(arg);
        if (i < args.length - 1) {
            chunks.push(', ');
        }
    });
    chunks.push(')');

    return new SQL(chunks, params);
}

// --- Operators ---

export function eq<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} = ${val}`;
}

export function ne<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} != ${val}`;
}

export function gt<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} > ${val}`;
}

export function gte<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} >= ${val}`;
}

export function lt<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} < ${val}`;
}

export function lte<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression) {
    return sql`${col} <= ${val}`;
}

// Note: isNull and isNotNull are exported from modules/conditional.ts

export function inArray(col: ClickHouseColumn | SQLExpression, values: SQLValue[] | SQLExpression) {
    if (Array.isArray(values)) {
        if (values.length === 0) return sql`1=0`;
    }
    return sql`${col} IN ${values}`;
}

export function notInArray(col: ClickHouseColumn | SQLExpression, values: SQLValue[] | SQLExpression) {
    if (Array.isArray(values)) {
        if (values.length === 0) return sql`1=1`;
    }
    return sql`${col} NOT IN ${values}`;
}

export function between(col: ClickHouseColumn | SQLExpression, min: SQLValue, max: SQLValue) {
    return sql`${col} BETWEEN ${min} AND ${max}`;
}

export function notBetween(col: ClickHouseColumn | SQLExpression, min: SQLValue, max: SQLValue) {
    return sql`${col} NOT BETWEEN ${min} AND ${max}`;
}

// Note: like, notLike, ilike, notIlike, and match are exported from modules/string.ts

// Note: not, and, and or are exported from modules/conditional.ts

// ClickHouse Specific
export function has(col: ClickHouseColumn | SQLExpression, value: SQLValue) {
    return sql`has(${col}, ${value})`;
}

export function hasAll(col: ClickHouseColumn | SQLExpression, values: SQLValue[]) {
    return sql`hasAll(${col}, ${values})`;
}

export function hasAny(col: ClickHouseColumn | SQLExpression, values: SQLValue[]) {
    return sql`hasAny(${col}, ${values})`;
}

// Order By helpers
export function asc(col: ClickHouseColumn | SQLExpression) {
    return { col, dir: 'ASC' as const };
}

export function desc(col: ClickHouseColumn | SQLExpression) {
    return { col, dir: 'DESC' as const };
}
