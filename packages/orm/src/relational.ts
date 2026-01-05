import { ClickHouseQueryBuilder } from './builders/select';
import { SQL } from './expressions';
import * as ops from './expressions';
import * as cond from './modules/conditional';
import { ClickHouseColumn, type RelationDefinition, type TableDefinition, type CleanSelect } from './core';
import type { SQLExpression } from './expressions';

/**
 * Internal map of SQL operators provided to relational query callbacks.
 * These match the standard HouseKit operators but are bundled for ergonomic access.
 */
const operators = {
    eq: ops.eq,
    ne: ops.ne,
    gt: ops.gt,
    gte: ops.gte,
    lt: ops.lt,
    lte: ops.lte,
    inArray: ops.inArray,
    notInArray: ops.notInArray,
    between: ops.between,
    notBetween: ops.notBetween,
    has: ops.has,
    hasAll: ops.hasAll,
    hasAny: ops.hasAny,
    sql: ops.sql,
    and: cond.and,
    or: cond.or,
    not: cond.not,
    isNull: cond.isNull,
    isNotNull: cond.isNotNull,
    asc: ops.asc,
    desc: ops.desc,
};

type Operators = typeof operators;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type RelationsOf<TTable> = TTable extends { $relations: infer R } ? R : {};

type NormalizedRelations<TTable> = RelationsOf<TTable> extends Record<string, RelationDefinition<any>>
    ? RelationsOf<TTable>
    : {};

type RelationTarget<T> = T extends RelationDefinition<infer TTarget> ? TTarget : never;

/**
 * Join strategy for relational queries.
 * 
 * ClickHouse performance varies significantly depending on the join strategy used,
 * especially in distributed environments.
 */
export type JoinStrategy =
    | 'auto'      // Automatically choose based on table configuration (recommended)
    | 'standard'  // Use regular LEFT JOIN
    | 'global'    // Force GLOBAL JOIN (essential for distributed sharded clusters)
    | 'any'       // Use ANY JOIN (performance optimization when single match is guaranteed)
    | 'global_any'; // Combine GLOBAL and ANY strategies

/**
 * Configuration options for the Relational Query API (`findMany`, `findFirst`).
 */
export type RelationalWith<TTable> =
    [keyof NormalizedRelations<TTable>] extends [never]
    ? Record<string, boolean | RelationalFindOptions<any>>
    : {
        [K in keyof NormalizedRelations<TTable>]?: boolean | RelationalFindOptions<RelationTarget<NormalizedRelations<TTable>[K]>>;
    };

type NestedWith<T> = T extends RelationalFindOptions<any> ? T['with'] : undefined;

type RelationValue<TRel, TWith> =
    TRel extends { relation: 'one'; table: infer TRelTable }
    ? RelationalResult<TRelTable, TWith> | null
    : TRel extends { relation: 'many'; table: infer TRelTable }
    ? Array<RelationalResult<TRelTable, TWith>>
    : never;

type RelationValueForKey<TTable, K, TWithValue> =
    K extends keyof NormalizedRelations<TTable>
    ? TWithValue extends boolean
    ? RelationValue<NormalizedRelations<TTable>[K], undefined>
    : TWithValue extends RelationalFindOptions<any>
    ? RelationValue<NormalizedRelations<TTable>[K], NestedWith<TWithValue>>
    : never
    : any;

export type RelationalResult<TTable, TWith = undefined> = Simplify<
    CleanSelect<TTable> &
    (TWith extends RelationalWith<TTable>
        ? {
            [K in keyof TWith]:
                RelationValueForKey<TTable, K, TWith[K]>;
        }
        : {})
>;

// Type for object where syntax: { email: 'value' } or { email: 'value', role: 'admin' }
type WhereObject<TTable> = TTable extends TableDefinition<infer TCols>
    ? { [K in keyof TCols]?: TCols[K] extends ClickHouseColumn<infer T> ? T | SQLExpression : any }
    : Record<string, any>;

export type RelationalFindOptions<TTable = any> = {
    /** 
     * Filter rows.
     * 
     * @example
     * // Object syntax (simplest)
     * where: { email: 'a@b.com' }
     * where: { role: 'admin', active: true }
     * 
     * // Direct expression
     * where: eq(users.active, true)
     * 
     * // Callback for complex filters
     * where: (cols, { eq, and, gt }) => and(eq(cols.role, 'admin'), gt(cols.age, 18))
     */
    where?: WhereObject<TTable> | SQLExpression | ((
        columns: TTable extends TableDefinition<infer TCols> ? TCols : any,
        ops: typeof operators
    ) => SQLExpression);
    
    /** Max rows to return */
    limit?: number;

    /** 
     * Select specific columns. By default all columns are returned.
     * 
     * @example
     * columns: { id: true, email: true }
     */
    columns?: TTable extends TableDefinition<infer TCols> 
        ? { [K in keyof TCols]?: boolean }
        : Record<string, boolean>;
    
    /** Rows to skip */
    offset?: number;

    /**
     * Sort results. Accepts direct value, array, or callback.
     * 
     * @example
     * // Direct
     * orderBy: desc(users.createdAt)
     * 
     * // Array
     * orderBy: [desc(users.createdAt), asc(users.name)]
     * 
     * // Callback
     * orderBy: (cols, { desc }) => desc(cols.createdAt)
     */
    orderBy?: OrderByValue | OrderByValue[] | ((
        columns: TTable extends TableDefinition<infer TCols> ? TCols : any,
        fns: { asc: typeof ops.asc; desc: typeof ops.desc }
    ) => OrderByValue | OrderByValue[]);
    
    /** 
     * Include related data. Use `true` for all columns or an object for filtering.
     * 
     * @example
     * with: { 
     *   posts: true,                          // All posts
     *   comments: { limit: 5 },               // Latest 5 comments
     *   profile: { where: eq(profile.public, true) }  // Only public profile
     * }
     */
    with?: RelationalWith<TTable>;
    
    /**
     * Join strategy for distributed clusters.
     * @default 'auto'
     */
    joinStrategy?: JoinStrategy;
};

type OrderByValue = { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' };

// Helper type for columns selection result
type SelectedColumns<TTable, TCols> = TCols extends Record<string, boolean>
    ? { [K in keyof TCols as TCols[K] extends true ? K : never]: K extends keyof CleanSelect<TTable> ? CleanSelect<TTable>[K] : never }
    : CleanSelect<TTable>;

export type RelationalAPI<TSchema extends Record<string, TableDefinition<any>>> = {
    [K in keyof TSchema]: {
        /** Find multiple records with optional filtering, pagination, and relations */
        findMany: <TOpts extends RelationalFindOptions<TSchema[K]> | undefined>(
            opts?: TOpts
        ) => Promise<Array<RelationalResult<TSchema[K], TOpts extends RelationalFindOptions<TSchema[K]> ? TOpts['with'] : undefined>>>;
        
        /** Find a single record (first match) */
        findFirst: <TOpts extends RelationalFindOptions<TSchema[K]> | undefined>(
            opts?: TOpts
        ) => Promise<RelationalResult<TSchema[K], TOpts extends RelationalFindOptions<TSchema[K]> ? TOpts['with'] : undefined> | null>;

        /** 
         * Find a record by its primary key
         * @example
         * const user = await db.query.users.findById('uuid-here')
         * const user = await db.query.users.findById('uuid', { with: { posts: true } })
         */
        findById: <TOpts extends Omit<RelationalFindOptions<TSchema[K]>, 'where' | 'limit'> | undefined>(
            id: string | number,
            opts?: TOpts
        ) => Promise<RelationalResult<TSchema[K], TOpts extends RelationalFindOptions<TSchema[K]> ? TOpts['with'] : undefined> | null>;
    }
};

/**
 * Internal helper to generate SQL join conditions based on relation metadata.
 * Combines multiple field pairs into a single AND expression if necessary.
 */
function buildJoinCondition(fields: ClickHouseColumn[] | undefined, references: ClickHouseColumn[] | undefined): SQLExpression | null {
    if (!fields || !references || fields.length === 0 || references.length === 0) return null;
    const pairs = fields.map((f, i) => ops.sql`${f} = ${references[i]}`);
    const filtered = pairs.filter((p): p is SQL => Boolean(p));
    if (filtered.length === 0) return null;
    if (filtered.length === 1) return filtered[0];
    return cond.and(...filtered) || null;
}

/**
 * Utility to detect if a table is distributed or sharded based on its options.
 * Used to automatically trigger GLOBAL JOIN strategies.
 */
function isDistributedTable(tableDef: TableDefinition<any>): boolean {
    const options = tableDef.$options as any;
    return !!(options?.onCluster || options?.shardKey);
}

/**
 * Build a modern relational API with ClickHouse-specific optimizations.
 * 
 * Key architectural features:
 * - **groupUniqArray Optimization**: Instead of flat-joining which causes row explosion,
 *   HouseKit uses ClickHouse aggregation to fetch nested relations as arrays of tuples.
 * - **Automatic Cluster Handling**: Detects sharded tables and applies GLOBAL JOINs.
 * - **Smart Deduplication**: Merges results in-memory when flat joins are unavoidable.
 * 
 * @param client - The ClickHouse client instance.
 * @param schema - The shared schema definition containing all table and relation metadata.
 */
export function buildRelationalAPI<TSchema extends Record<string, TableDefinition<any>>>(
    client: any,
    schema?: TSchema
): RelationalAPI<TSchema> | undefined {
    if (!schema) return undefined;
    const api: Record<string, any> = {};

    for (const [tableKey, tableDef] of Object.entries(schema)) {
        api[tableKey] = {
            /**
             * Find multiple records from this table, including all requested nested relations.
             * 
             * This method automatically optimizes the SQL query to minimize data transfer
             * by using `groupUniqArray` for top-level "many" relations.
             */
            findMany: async (opts?: RelationalFindOptions<typeof tableDef>) => {
                let builder = new ClickHouseQueryBuilder(client).from(tableDef);
                
                // Filter columns if specified
                const selectedColumns = opts?.columns;
                const baseColumns = selectedColumns
                    ? Object.entries(tableDef.$columns).filter(([key]) => selectedColumns[key] === true)
                    : Object.entries(tableDef.$columns);
                
                const relations = (tableDef as any).$relations as Record<string, RelationDefinition> | undefined;

                // Identify top-level relations requested by the user
                const requestedTopLevel = opts?.with ? Object.entries(opts.with).filter(([, v]) => v) : [];
                const requestedRelations = requestedTopLevel
                    .map(([relName, val]: [string, boolean | RelationalFindOptions]) => {
                        const rel = relations?.[relName];
                        return { relName, rel, options: typeof val === 'object' ? val : {} as RelationalFindOptions };
                    })
                    .filter((r): r is { relName: string; rel: RelationDefinition; options: RelationalFindOptions } => Boolean(r.rel));

                const needsGrouping = requestedRelations.length > 0;
                const allColumns = Object.entries(tableDef.$columns); // For groupBy we need all columns
                const groupByColumns = needsGrouping ? allColumns.map(([, col]) => col as ClickHouseColumn) : [];

                // Detect environmental requirements
                const joinStrategy: JoinStrategy = opts?.joinStrategy || 'auto';
                const isDistributed = isDistributedTable(tableDef);
                const useGlobal = joinStrategy === 'global' || joinStrategy === 'global_any' || (joinStrategy === 'auto' && isDistributed);
                const useAny = joinStrategy === 'any' || joinStrategy === 'global_any';

                /**
                 * Recursive helper to construct the flat SELECT and the necessary JOINS for the entire relation tree.
                 */
                function buildNestedSelection(
                    currentTableDef: TableDefinition<any>,
                    currentWith: RelationalFindOptions['with'],
                    prefix: string = '',
                    outerJoinStrategy: JoinStrategy,
                    outerUseGlobal: boolean,
                    outerUseAny: boolean,
                    columnsFilter?: Record<string, boolean | undefined>
                ): { selection: Record<string, any>; joins: any[] } {
                    let currentSelection: Record<string, any> = {};
                    let currentJoins: any[] = [];

                    // Register columns for the current table level (filtered if specified)
                    Object.entries(currentTableDef.$columns).forEach(([key, col]) => {
                        if (!columnsFilter || columnsFilter[key] === true) {
                            currentSelection[`${prefix}${key}`] = col;
                        }
                    });

                    if (!currentWith) return { selection: currentSelection, joins: currentJoins };

                    const currentRelations = (currentTableDef as any).$relations as Record<string, RelationDefinition> | undefined;
                    const requestedNested = Object.entries(currentWith)
                        .map(([relName, val]) => {
                            const rel = currentRelations?.[relName];
                            return { relName, rel, options: typeof val === 'object' ? val : {} as RelationalFindOptions };
                        })
                        .filter((r): r is { relName: string; rel: RelationDefinition; options: RelationalFindOptions } => Boolean(r.rel));

                    for (const { relName, rel, options } of requestedNested) {
                        const newPrefix = prefix ? `${prefix}_${relName}_` : `${relName}_`;
                        
                        // Process where: function, object, or SQLExpression
                        let relWhere: SQLExpression | null = null;
                        if (options.where) {
                            if (typeof options.where === 'function') {
                                relWhere = options.where(rel.table.$columns, operators);
                            } else if (typeof options.where === 'object' && !('toSQL' in options.where)) {
                                const conditions = Object.entries(options.where).map(([key, value]) => {
                                    const col = rel.table.$columns[key] as ClickHouseColumn;
                                    if (!col) throw new Error(`Column '${key}' not found in relation '${relName}'`);
                                    return ops.eq(col, value);
                                });
                                relWhere = conditions.length === 1 ? conditions[0] : cond.and(...conditions)!;
                            } else {
                                relWhere = options.where as SQLExpression;
                            }
                        }

                        let joinCondition = buildJoinCondition(rel.fields, rel.references);

                        if (joinCondition) {
                            const joinType = (() => {
                                const relIsDistributed = isDistributedTable(rel.table);
                                const useRelGlobal = outerUseGlobal || (outerJoinStrategy === 'auto' && relIsDistributed);
                                if (useRelGlobal && outerUseAny) return builder.globalAnyJoin;
                                if (useRelGlobal) return builder.globalLeftJoin;
                                if (outerUseAny) return builder.anyLeftJoin;
                                return builder.leftJoin;
                            })();

                            // OPTIMIZATION: Top-level "Many" relations are fetched as unique arrays of tuples.
                            // This prevents the "Cartesian Product" data explosion over the wire.
                            if (rel.relation === 'many' && !prefix) {
                                const relCols = Object.entries(rel.table.$columns);
                                const tupleArgs = relCols.map(([, col]) => ops.sql`${col}`);
                                if (relWhere) {
                                    // Use groupUniqArrayIf to filter elements directly in ClickHouse
                                    currentSelection[relName] = ops.sql`groupUniqArrayIf(tuple(${ops.sql.join(tupleArgs, ops.sql`, `)}), ${relWhere})`;
                                } else {
                                    currentSelection[relName] = ops.sql`groupUniqArray(tuple(${ops.sql.join(tupleArgs, ops.sql`, `)}))`;
                                }
                            } else if (relWhere) {
                                // For One-to-One or nested relations, inject filters into the JOIN condition
                                joinCondition = cond.and(joinCondition, relWhere) as SQLExpression;
                            }
                            currentJoins.push({ type: joinType, table: rel.table, on: joinCondition });
                        }

                        // Recursively process deeper levels of the relation tree
                        const nestedResult = buildNestedSelection(rel.table, options.with, newPrefix, outerJoinStrategy, outerUseGlobal, outerUseAny, options.columns);
                        if (!(rel.relation === 'many' && !prefix)) {
                            Object.assign(currentSelection, nestedResult.selection);
                        }
                        currentJoins.push(...nestedResult.joins);
                    }
                    return { selection: currentSelection, joins: currentJoins };
                }

                const { selection: flatSelection, joins: allJoins } = buildNestedSelection(tableDef, opts?.with, '', joinStrategy, useGlobal, useAny, opts?.columns);

                // Initialize standard Select Query
                for (const joinDef of allJoins) {
                    builder = joinDef.type.call(builder, joinDef.table, joinDef.on) as any;
                }

                builder = (builder as any).select(flatSelection);
                
                // Group by primary table if relations are being aggregated into arrays
                if (needsGrouping && groupByColumns.length > 0) {
                    builder = (builder as any).groupBy(...groupByColumns);
                }
                
                // Apply primary table filters
                if (opts?.where) {
                    let whereValue: SQLExpression;
                    if (typeof opts.where === 'function') {
                        whereValue = opts.where(tableDef.$columns, operators);
                    } else if (opts.where && typeof opts.where === 'object' && !('toSQL' in opts.where)) {
                        // Object syntax: { email: 'value', role: 'admin' }
                        const conditions = Object.entries(opts.where).map(([key, value]) => {
                            const col = tableDef.$columns[key] as ClickHouseColumn;
                            if (!col) throw new Error(`Column '${key}' not found in table`);
                            return ops.eq(col, value);
                        });
                        whereValue = conditions.length === 1 ? conditions[0] : cond.and(...conditions)!;
                    } else {
                        whereValue = opts.where as SQLExpression;
                    }
                    builder = builder.where(whereValue);
                }

                // Apply orderBy
                if (opts?.orderBy) {
                    const orderByFns = { asc: ops.asc, desc: ops.desc };
                    const orderByValue = typeof opts.orderBy === 'function' 
                        ? opts.orderBy(tableDef.$columns, orderByFns)
                        : opts.orderBy;
                    const orderByArray = Array.isArray(orderByValue) ? orderByValue : [orderByValue];
                    for (const ob of orderByArray) {
                        builder = builder.orderBy(ob.col, ob.dir);
                    }
                }
                
                // Standard pagination
                if (opts?.limit) builder = builder.limit(opts.limit);
                if (opts?.offset) builder = builder.offset(opts.offset);

                const rows = await builder.then();

                /**
                 * Internal helper to transform the flat ClickHouse result (with potentially nested arrays)
                 * back into a deep JavaScript object tree.
                 */
                function reconstructNested(row: any, currentTableDef: TableDefinition<any>, currentWith: RelationalFindOptions['with'], prefix: string = '') {
                    const result: Record<string, any> = {};
                    
                    // Map primary columns
                    Object.entries(currentTableDef.$columns).forEach(([key]) => {
                        result[key] = row[`${prefix}${key}`];
                    });

                    if (!currentWith) return result;

                    const currentRelations = (currentTableDef as any).$relations as Record<string, RelationDefinition> | undefined;
                    Object.entries(currentWith).filter(([, v]) => v).forEach(([relName, val]) => {
                        const rel = currentRelations?.[relName];
                        if (!rel) return;
                        const options = typeof val === 'object' ? val : {} as RelationalFindOptions;
                        const newPrefix = prefix ? `${prefix}_${relName}_` : `${relName}_`;

                        if (rel.relation === 'one') {
                            const relatedData = reconstructNested(row, rel.table, options.with, newPrefix);
                            const allNull = Object.values(relatedData).every(v => v === null || v === undefined);
                            result[relName] = allNull ? null : relatedData;
                        } else {
                            const rawVal = row[relName];
                            if (Array.isArray(rawVal)) {
                                // De-serialize aggregated tuples back into objects
                                const relCols = Object.keys(rel.table.$columns);
                                let items = rawVal.map((tuple: any[]) => {
                                    const obj: Record<string, any> = {};
                                    let allNull = true;
                                    relCols.forEach((colKey, i) => {
                                        const v = tuple[i];
                                        if (v !== null && v !== undefined) allNull = false;
                                        obj[colKey] = v;
                                    });
                                    return allNull ? null : obj;
                                }).filter(Boolean);
                                
                                // Apply nested pagination (limit/offset) which ClickHouse cannot do inside groupArray
                                if (options.offset) items = items.slice(options.offset);
                                if (options.limit) items = items.slice(0, options.limit);
                                result[relName] = items;
                            } else {
                                // Fallback for nested many relations using standard flat joins
                                const relatedData = reconstructNested(row, rel.table, options.with, newPrefix);
                                const allNull = Object.values(relatedData).every(v => v === null || v === undefined);
                                result[relName] = allNull ? [] : [relatedData];
                            }
                        }
                    });
                    return result;
                }

                const results = rows.map((row: any) => reconstructNested(row, tableDef, opts?.with));

                if (needsGrouping) {
                    /**
                     * SMART DEDUPLICATION:
                     * When using standard flat joins for deep relations, rows in the result set are multiplied.
                     * We use a Map keyed by the primary key to merge these rows and their nested collections.
                     */
                    const grouped = new Map<string, any>();
                    const pkCols = Array.isArray(tableDef.$options.primaryKey) 
                        ? tableDef.$options.primaryKey 
                        : [tableDef.$options.primaryKey || Object.keys(tableDef.$columns)[0]];

                    for (const item of results) {
                        // Generate identity key
                        const id = pkCols.map((col: string) => {
                            const val = item[col];
                            return val instanceof Date ? val.getTime() : String(val);
                        }).join('|');

                        if (!grouped.has(id)) {
                            grouped.set(id, item);
                        } else {
                            const existing = grouped.get(id);
                            requestedRelations.forEach(({ relName, rel, options }) => {
                                if (rel.relation === 'many' && Array.isArray(item[relName])) {
                                    for (const newItem of item[relName]) {
                                        // Avoid duplicate objects in the nested array
                                        const isDuplicate = existing[relName].some((x: any) => JSON.stringify(x) === JSON.stringify(newItem));
                                        if (!isDuplicate) existing[relName].push(newItem);
                                    }
                                    // Re-apply limits after merging collections
                                    if (options.limit) existing[relName] = existing[relName].slice(0, options.limit);
                                }
                            });
                        }
                    }
                    return Array.from(grouped.values());
                }

                return results;
            },
            /**
             * Find a single record including its requested relations.
             * Equivalent to `findMany` with `limit: 1`.
             */
            findFirst: async (opts?: RelationalFindOptions) => {
                const rows = await api[tableKey].findMany({ ...opts, limit: 1 });
                return rows[0] ?? null;
            },

            /**
             * Find a record by its primary key.
             * Automatically detects the primary key column from table options.
             */
            findById: async (id: string | number, opts?: Omit<RelationalFindOptions, 'where' | 'limit'>) => {
                // Get primary key column(s) from table options
                const pkOption = (tableDef.$options as any)?.primaryKey;
                const pkCols = pkOption 
                    ? (Array.isArray(pkOption) ? pkOption : [pkOption])
                    : [Object.keys(tableDef.$columns)[0]]; // Default to first column
                
                const pkColName = pkCols[0];
                const pkColumn = tableDef.$columns[pkColName] as ClickHouseColumn;
                
                if (!pkColumn) {
                    throw new Error(`Primary key column '${pkColName}' not found in table '${tableKey}'`);
                }

                const rows = await api[tableKey].findMany({
                    ...opts,
                    where: ops.eq(pkColumn, id),
                    limit: 1
                });
                return rows[0] ?? null;
            }
        };
    }
    return api as RelationalAPI<TSchema>;
}
