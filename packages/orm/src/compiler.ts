import { ClickHouseColumn, type TableDefinition } from './core';
import type { SQLExpression } from './expressions';
import type { QueryBuilderState } from './builders/select.types';
import { LRUCache } from './utils/lru-cache';
import { PreparedQuery } from './builders/prepared';

// Cache stores Templates: SQL structure and parameter keys order
const queryCache = new LRUCache<string, { sql: string, paramKeys: string[], suggestions: string[], columnNames: string[], columnTypes: string[] }>({ max: 1000 });

export class QueryCompiler {
    private paramCounter = 0;

    reset(): void {
        this.paramCounter = 0;
    }

    private getNextParamName(): string {
        return `p_${++this.paramCounter}`;
    }

    /**
     * Compile with caching support.
     * Returns a PreparedQuery ready for execution and the values to bind.
     */
    compileWithCache(state: QueryBuilderState, client: any): { cachedQuery: PreparedQuery<any>, values: any[] } {
        // 1. Generate Fingerprint (Structure) & Extract Values
        const { key, values } = this.generateFingerprint(state);

        // 2. Check Cache
        let template = queryCache.get(key);

        if (!template) {
            // 3. Cache Miss: Full Compilation
            const result = this.performFullCompilation(state);

            // Derive parameter keys from the result params (assuming p_1, p_2 order matches traversal)
            // performFullCompilation resets paramCounter and increments.
            // But result.params is a map. We need the keys in order.
            // Since we use p_1, p_2... we can generate them based on count.
            const paramCount = Object.keys(result.params).length;
            const paramKeys = Array.from({ length: paramCount }, (_, i) => `p_${i + 1}`);

            template = {
                sql: result.sql,
                paramKeys,
                suggestions: result.suggestions,
                columnNames: result.columnNames,
                columnTypes: result.columnTypes
            };
            queryCache.set(key, template);
        }

        // 4. Return PreparedQuery bound to the current client
        // This ensures multi-client safety (e.g. read replicas)
        const cachedQuery = new PreparedQuery(
            client,
            template.sql,
            template.paramKeys,
            template.suggestions,
            template.columnNames,
            template.columnTypes
        );

        return { cachedQuery, values };
    }

    /**
     * Legacy/Internal method for getting SQL + Params directly (used by toSQL)
     */
    compileSelect(state: QueryBuilderState): { sql: string; params: Record<string, unknown>; suggestions: string[] } {
        // Reuse the fingerprint logic to get values
        const { key, values } = this.generateFingerprint(state);

        // Check cache for template
        let template = queryCache.get(key);
        if (!template) {
            const result = this.performFullCompilation(state);
            // Cache it for future use
            const paramCount = Object.keys(result.params).length;
            const paramKeys = Array.from({ length: paramCount }, (_, i) => `p_${i + 1}`);
            template = {
                sql: result.sql,
                paramKeys,
                suggestions: result.suggestions,
                columnNames: result.columnNames,
                columnTypes: result.columnTypes
            };
            queryCache.set(key, template);
        }

        // Reconstruct params map
        const params: Record<string, unknown> = {};
        for (let i = 0; i < template.paramKeys.length; i++) {
            if (i < values.length) {
                params[template.paramKeys[i]] = values[i];
            }
        }

        return {
            sql: template.sql,
            params,
            suggestions: template.suggestions
        };
    }

    private generateFingerprint(state: QueryBuilderState): { key: string, values: any[] } {
        const values: any[] = [];
        const visitor = (val: any, type: string) => values.push(val);
        let key = 'SELECT'; // Base type

        // 1. CTEs
        if (state.ctes.length > 0) {
            key += '|CTES:';
            for (const cte of state.ctes) {
                if (cte.query && typeof (cte.query as any).toSQL === 'function') {
                    // Note: This calls toSQL on subquery which might use its own compiler instance.
                    // This is fine, but we need to ensure we capture its params?
                    // cte.query.toSQL() returns params map.
                    // This breaks the "visitor" pattern if we don't traverse the subquery structure.
                    // Ideally, subqueries should also be fingerprinted.
                    // For now, we use the generated SQL as structural key and extract values from params.
                    const { sql, params } = (cte.query as any).toSQL();
                    key += `(${cte.name}:${sql})`;
                    if (params) {
                        // We rely on Object.values order? No, toSQL returns map p_1...
                        // We need to push them in order.
                        // This is tricky. Mixing compiled subqueries with visitor-based fingerprinting.
                        // But performFullCompilation also recompiles subqueries.
                        // So as long as we extract values in the same order...
                        // performFullCompilation iterates Object.entries(cteParams).
                        for (const [, val] of Object.entries(params)) {
                            values.push(val);
                        }
                    }
                } else {
                    key += `(${cte.name}:unknown)`;
                }
            }
        }

        // 2. Select Items
        if (state.select) {
            key += '|SEL:';
            if (state.distinct) key += 'DISTINCT:';
            const keys = Object.keys(state.select);
            for (const alias of keys) {
                const item = state.select[alias];
                key += `${alias}=`;
                if (item instanceof ClickHouseColumn) {
                    key += `COL:${item.tableName}.${item.name}`;
                } else if (item && typeof item === 'object' && 'walk' in item) {
                    key += `EXPR:${(item as SQLExpression).walk(visitor)}`;
                } else {
                    key += `RAW:${String(item)}`;
                }
                key += ';';
            }
        } else {
            key += '|SEL:*';
        }

        // 3. From
        if (state.table) {
            const t = state.table as any;
            if (t.$options?.kind === 'subquery' && t.$options?.subquery) {
                const { sql, params } = t.$options.subquery.toSQL();
                key += `|FROM:SUB(${sql})`;
                if (params) {
                    for (const [, val] of Object.entries(params)) {
                        values.push(val);
                    }
                }
            } else {
                key += `|FROM:${state.table.$table}`;
                if (state.final) key += ':FINAL';
            }
        }

        // 4. Joins
        if (state.joins.length > 0) {
            key += '|JOINS:';
            for (const join of state.joins) {
                key += `${join.type}:${join.table}`;
                if (join.on) {
                    key += `ON:${join.on.walk(visitor)}`;
                }
                key += ';';
            }
        }

        // 5. Array Joins
        if (state.arrayJoins.length > 0) {
            key += '|AJOINS:';
            for (const aj of state.arrayJoins) {
                if (aj.column instanceof ClickHouseColumn) {
                    key += `COL:${aj.column.tableName}.${aj.column.name}`;
                } else {
                    key += `EXPR:${(aj.column as SQLExpression).walk(visitor)}`;
                }
                if (aj.alias) key += `AS:${aj.alias}`;
                key += ';';
            }
        }

        // 6. Prewhere
        if (state.prewhere) {
            key += `|PREWHERE:${state.prewhere.walk(visitor)}`;
        }

        // 7. Where
        if (state.where) {
            key += `|WHERE:${state.where.walk(visitor)}`;
        }

        // 8. Group By
        if (state.groupBy.length > 0) {
            key += '|GROUP:';
            for (const g of state.groupBy) {
                if (g instanceof ClickHouseColumn) {
                    key += `COL:${g.tableName}.${g.name}`;
                } else {
                    key += `EXPR:${(g as SQLExpression).walk(visitor)}`;
                }
                key += ';';
            }
        }

        // 9. Having
        if (state.having) {
            key += `|HAVING:${state.having.walk(visitor)}`;
        }

        // 10. Order By
        if (state.orderBy.length > 0) {
            key += '|ORDER:';
            for (const o of state.orderBy) {
                if (o.col instanceof ClickHouseColumn) {
                    key += `COL:${o.col.tableName}.${o.col.name}`;
                } else {
                    key += `EXPR:${(o.col as SQLExpression).walk(visitor)}`;
                }
                key += `:${o.dir};`;
            }
        }

        // 11. Limit/Offset
        if (state.limit !== null) key += `|LIMIT:${state.limit}`;
        if (state.offset !== null) key += `|OFFSET:${state.offset}`;

        // 12. Sample
        if (state.sample !== null) {
            key += `|SAMPLE:${state.sample.ratio}:${state.sample.offset}`;
        }

        // 13. Settings
        if (state.settings) {
            key += '|SETTINGS:';
            const sortedKeys = Object.keys(state.settings).sort();
            for (const k of sortedKeys) {
                key += `${k}=${state.settings[k]};`;
            }
        }

        // 14. Windows
        if (Object.keys(state.windows).length > 0) {
            key += '|WINDOWS:';
            const sortedKeys = Object.keys(state.windows).sort();
            for (const k of sortedKeys) {
                key += `${k}=${state.windows[k]};`;
            }
        }

        return { key, values };
    }

    private performFullCompilation(state: QueryBuilderState): {
        sql: string;
        params: Record<string, unknown>;
        suggestions: string[];
        columnNames: string[];
        columnTypes: string[];
    } {
        const table = state.table;
        if (!table) throw new Error('❌ .from() is required');

        const getAlias = (fallback: string, item: any) => {
            if (item && typeof item === 'object' && typeof (item as any)._alias === 'string') {
                return (item as any)._alias as string;
            }
            return fallback;
        };

        // Reset parameter counter for consistent parameter naming
        this.reset();
        const params: Record<string, unknown> = {};

        let withSql = '';
        if (state.ctes.length > 0) {
            const cteParts = state.ctes.map(cte => {
                const { query: originalQuery, params: cteParams } = cte.query.toSQL();
                // Rename parameters to avoid conflicts
                const renamedParams: Record<string, unknown> = {};
                let query = originalQuery;
                for (const [key, value] of Object.entries(cteParams)) {
                    const newKey = this.getNextParamName();
                    renamedParams[newKey] = value;
                    // Update the query to use the new parameter name
                    query = query.replace(new RegExp(`\\{${key}:`, 'g'), `{${newKey}:`);
                }
                Object.assign(params, renamedParams);
                return `${cte.name} AS (${query})`;
            });
            withSql = `WITH ${cteParts.join(', ')}`;
        }

        const distinctKeyword = state.distinct ? 'DISTINCT ' : '';
        let selectSql = '*';
        const columnNames: string[] = [];
        const columnTypes: string[] = [];

        if (state.select) {
            selectSql = Object.keys(state.select)
                .map(alias => {
                    let item = state.select![alias];
                    const targetAlias = getAlias(alias, item);

                    const isColumnByInstanceof = item instanceof ClickHouseColumn;
                    const isColumnByProperties = item && typeof item === 'object' &&
                        'name' in item && 'type' in item && 'toSQL' in item &&
                        typeof (item as any).name === 'string' && typeof (item as any).type === 'string';
                    const isColumn = isColumnByInstanceof || isColumnByProperties;
                    const isExpression = item && typeof item === 'object' && 'toSQL' in item && !isColumn;

                    if (!isColumn && !isExpression) {
                        const resolved = this.resolveColumn(item, alias, table);
                        if (resolved) {
                            item = resolved;
                        }
                    }

                    if (item === undefined || item === null) {
                        const availableColumns = Object.keys(table.$columns).map(key => {
                            const col = table.$columns[key];
                            return `${key} (column: ${col.name})`;
                        }).join(', ');

                        const directProps = Object.keys(table).filter(k => !k.startsWith('$')).join(', ');

                        throw new Error(
                            `Field "${alias}" in SELECT is undefined. ` +
                            `The value you passed for "${alias}" is undefined. ` +
                            `Make sure you're accessing the column correctly:\n` +
                            `  - Use table.columnName (e.g., myTable.columnName)\n` +
                            `  - Or use table.$columns.columnName (e.g., myTable.$columns.columnName)\n` +
                            `  - Available column properties: ${directProps}\n` +
                            `  - Available columns (property -> column): ${availableColumns}\n` +
                            `  - Example: client.select({ my_column: myTable.columnName }).from(myTable)`
                        );
                    }

                    columnNames.push(targetAlias);

                    if (item instanceof ClickHouseColumn || isColumnByProperties) {
                        const col = item as ClickHouseColumn;
                        columnTypes.push(col.type);
                        const colSql = this.formatColumn(col);
                        return `${colSql} AS \`${targetAlias}\``;
                    } else if (item && typeof item === 'object' && 'toSQL' in item) {
                        const res = (item as SQLExpression).toSQL({ table });
                        Object.assign(params, res.params);
                        // For expressions, we default to String if we don't know the type
                        // This might be improved if we can infer expression types
                        columnTypes.push((item as any).type || 'String');
                        return `${res.sql} AS \`${targetAlias}\``;
                    } else {
                        throw new Error(
                            `Field "${alias}" in SELECT must be a ClickHouseColumn or SQLExpression, ` +
                            `but got ${typeof item}. ` +
                            `Make sure you're using table.columnName (e.g., myTable.columnName) correctly.`
                        );
                    }
                })
                .join(', ');
        } else if (table) {
            // SELECT * case
            for (const [key, col] of Object.entries(table.$columns)) {
                const column = col as ClickHouseColumn;
                columnNames.push(column.name);
                columnTypes.push(column.type);
            }
        }

        const isSubquery = (table as any)?.$options?.kind === 'subquery' && (table as any)?.$options?.subquery;
        const tableName = table.$table;
        let fromSql: string;

        if (isSubquery) {
            const { sql: subSql, params: subParams } = (table as any).$options.subquery.toSQL();
            Object.assign(params, subParams);
            fromSql = `(${subSql}) AS \`${tableName}\``;
        } else {
            fromSql = `\`${tableName}\``;
            if (state.final) {
                fromSql += ' FINAL';
            }
        }

        if (state.joins.length > 0) {
            const joinParts = state.joins.map(join => {
                // CROSS JOIN doesn't have an ON clause
                if (join.type === 'CROSS' || !join.on) {
                    return `${join.type} JOIN \`${join.table}\``;
                }
                const onRes = join.on.toSQL({ table });
                Object.assign(params, onRes.params);
                return `${join.type} JOIN \`${join.table}\` ON ${onRes.sql}`;
            });
            fromSql += ' ' + joinParts.join(' ');
        }

        if (state.arrayJoins.length > 0) {
            const arrayJoinParts = state.arrayJoins.map(aj => {
                const isColumn = aj.column instanceof ClickHouseColumn ||
                    (aj.column && typeof aj.column === 'object' && 'name' in aj.column && 'type' in aj.column);

                let columnSql;
                if (isColumn) {
                    columnSql = this.formatColumn(aj.column as ClickHouseColumn);
                } else {
                    const res = (aj.column as SQLExpression).toSQL({ table });
                    Object.assign(params, res.params);
                    columnSql = res.sql;
                }

                return aj.alias ? `${columnSql} AS \`${aj.alias}\`` : columnSql;
            });
            fromSql += ' ARRAY JOIN ' + arrayJoinParts.join(', ');
        }

        let prewhereSql = '';
        if (state.prewhere) {
            const res = state.prewhere.toSQL({ table });
            prewhereSql = `PREWHERE ${res.sql}`;
            Object.assign(params, res.params);
        }

        let whereSql = '';
        if (state.where) {
            const res = state.where.toSQL({ table });
            whereSql = `WHERE ${res.sql}`;
            Object.assign(params, res.params);
        }

        let groupBySql = '';
        if (state.groupBy.length > 0) {
            const parts = state.groupBy.map(c => {
                const isColumn = c instanceof ClickHouseColumn ||
                    (c && typeof c === 'object' && 'name' in c && 'type' in c);
                if (isColumn) {
                    return this.formatColumn(c as ClickHouseColumn);
                } else {
                    const res = c.toSQL({ table });
                    Object.assign(params, res.params);
                    return res.sql;
                }
            });
            groupBySql = `GROUP BY ${parts.join(', ')}`;
        }

        let havingSql = '';
        if (state.having) {
            const res = state.having.toSQL({ table });
            havingSql = `HAVING ${res.sql}`;
            Object.assign(params, res.params);
        }

        let orderSql = '';
        if (state.orderBy.length > 0) {
            const parts = state.orderBy.map(o => {
                let colSql;
                const isColumn = o.col instanceof ClickHouseColumn ||
                    (o.col && typeof o.col === 'object' && 'name' in o.col && 'type' in o.col);
                if (isColumn) {
                    colSql = this.formatColumn(o.col as ClickHouseColumn);
                } else {
                    const res = (o.col as SQLExpression).toSQL({ table });
                    Object.assign(params, res.params);
                    colSql = res.sql;
                }
                // Check if the SQL expression already contains ASC/DESC
                // If so, don't append the direction again
                const sqlUpper = colSql.trim().toUpperCase();
                const alreadyHasDirection = sqlUpper.endsWith(' ASC') || sqlUpper.endsWith(' DESC');
                if (alreadyHasDirection) {
                    return colSql;
                }
                return `${colSql} ${o.dir}`;
            });
            orderSql = `ORDER BY ${parts.join(', ')}`;
        }

        let limitSql = '';
        if (state.limit !== null) {
            limitSql = `LIMIT ${state.limit}`;
            if (state.offset !== null) {
                limitSql += ` OFFSET ${state.offset}`;
            }
        }

        let sampleSql = '';
        if (state.sample !== null) {
            sampleSql = `SAMPLE ${state.sample.ratio}`;
            if (state.sample.offset !== undefined) {
                sampleSql += ` OFFSET ${state.sample.offset}`;
            }
        }

        let settingsSql = '';
        const finalSettings = { ...(state.settings || {}) };

        // Auto-detect Projections
        // If table has projections, we enable use_projection = 1
        // ClickHouse will then automatically decide if any projection matches the query.
        if (table.$options?.projections && table.$options.projections.length > 0) {
            // Only enable if user didn't explicitly disable it
            if (finalSettings.use_projection === undefined) {
                finalSettings.use_projection = 1;
                state.suggestions.push(`💡 This table has projections. Automatically enabled 'use_projection = 1' for potentially faster execution.`);
            }
        }

        if (Object.keys(finalSettings).length > 0) {
            const parts = Object.entries(finalSettings).map(([k, v]) => `${k} = ${v}`);
            settingsSql = `SETTINGS ${parts.join(', ')}`;
        }

        let windowSql = '';
        if (Object.keys(state.windows).length > 0) {
            const parts = Object.entries(state.windows).map(([name, def]) => `${name} AS (${def})`);
            windowSql = `WINDOW ${parts.join(', ')}`;
        }

        const queryParts = [
            withSql,
            `SELECT ${distinctKeyword}${selectSql}`,
            `FROM ${fromSql}`,
            prewhereSql,
            whereSql,
            groupBySql,
            havingSql,
            orderSql,
            limitSql,
            sampleSql,
            windowSql,
            settingsSql
        ].filter(part => part !== '');

        return {
            sql: queryParts.join(' '),
            params,
            suggestions: state.suggestions,
            columnNames,
            columnTypes
        };
    }

    private formatColumn(col: ClickHouseColumn | { name: string; tableName?: string }) {
        const colName = 'name' in col ? col.name : (col as ClickHouseColumn).name;
        const tableName = 'tableName' in col ? col.tableName : (col as ClickHouseColumn).tableName;
        return tableName ? `\`${tableName}\`.\`${colName}\`` : `\`${colName}\``;
    }

    private resolveColumn(value: any, alias: string, table: TableDefinition<any> | null): ClickHouseColumn | SQLExpression | null {
        if (value instanceof ClickHouseColumn) {
            return value;
        }
        if (value && typeof value === 'object' && 'toSQL' in value) {
            return value;
        }

        if (table) {
            if (table.$columns[alias]) {
                const col = table.$columns[alias];
                if (col instanceof ClickHouseColumn) {
                    return col;
                }
            }

            try {
                const tableProp = (table as any)[alias];
                if (tableProp instanceof ClickHouseColumn) {
                    return tableProp;
                }
            } catch (e) { /* ignore */ }

            const aliasCamelCase = alias.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            if (aliasCamelCase !== alias) {
                if (table.$columns[aliasCamelCase]) {
                    return table.$columns[aliasCamelCase];
                }
                try {
                    const tableProp = (table as any)[aliasCamelCase];
                    if (tableProp instanceof ClickHouseColumn) {
                        return tableProp;
                    }
                } catch (e) { /* ignore */ }
            }

            const aliasSnakeCase = alias.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (aliasSnakeCase !== alias && aliasSnakeCase !== aliasCamelCase) {
                if (table.$columns[aliasSnakeCase]) {
                    return table.$columns[aliasSnakeCase];
                }
                try {
                    const tableProp = (table as any)[aliasSnakeCase];
                    if (tableProp instanceof ClickHouseColumn) {
                        return tableProp;
                    }
                } catch (e) { /* ignore */ }
            }

            for (const [, col] of Object.entries(table.$columns)) {
                const column = col as ClickHouseColumn;
                if (column.name === alias || column.name === aliasCamelCase || column.name === aliasSnakeCase) {
                    return column;
                }
            }

            const aliasLower = alias.toLowerCase();
            for (const [key, col] of Object.entries(table.$columns)) {
                const column = col as ClickHouseColumn;
                if (key.toLowerCase() === aliasLower || column.name.toLowerCase() === aliasLower) {
                    return column;
                }
            }
        }

        return null;
    }
}
