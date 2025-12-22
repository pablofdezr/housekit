import { ClickHouseQueryBuilder } from './builders/select';
import { SQL } from './expressions';
import * as ops from './expressions';
import * as cond from './modules/conditional';
import { ClickHouseColumn, type RelationDefinition, type TableDefinition } from './core';
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
};

type Operators = typeof operators;

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
export type RelationalFindOptions<TTable = any> = {
    /** 
     * Filter conditions for the main query.
     * Can be a SQL expression or a callback receiving the table columns.
     * 
     * @example where: (users) => eq(users.active, true)
     */
    where?: SQLExpression | ((columns: TTable extends TableDefinition<infer TCols> ? TCols : any) => SQLExpression);
    
    /** 
     * Maximum number of records to return from the primary table.
     */
    limit?: number;
    
    /** 
     * Number of records to skip from the primary table.
     */
    offset?: number;
    
    /** 
     * Nested relations to include in the result set.
     * Set to `true` for all columns or provide a `RelationalFindOptions` object for nested filtering/limiting.
     * 
     * @example with: { posts: { limit: 5 }, profile: true }
     */
    with?: Record<string, boolean | RelationalFindOptions>;
    
    /**
     * Join strategy for related data.
     * 
     * - 'auto': Automatically uses GLOBAL when table has onCluster option.
     * - 'standard': Regular LEFT JOIN.
     * - 'global': Force GLOBAL JOIN (for sharded clusters).
     * - 'any': Use ANY JOIN (faster, optimized for 1:1 relations).
     * - 'global_any': Combine GLOBAL and ANY.
     * 
     * @default 'auto'
     */
    joinStrategy?: JoinStrategy;
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
export function buildRelationalAPI(client: any, schema?: Record<string, TableDefinition<any>>) {
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
                const baseColumns = Object.entries(tableDef.$columns);
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
                const groupByColumns = needsGrouping ? baseColumns.map(([, col]) => col as ClickHouseColumn) : [];

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
                    outerUseAny: boolean
                ): { selection: Record<string, any>; joins: any[] } {
                    let currentSelection: Record<string, any> = {};
                    let currentJoins: any[] = [];

                    // Register columns for the current table level
                    Object.entries(currentTableDef.$columns).forEach(([key, col]) => {
                        currentSelection[`${prefix}${key}`] = col;
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
                        const relWhere = options.where
                            ? (typeof options.where === 'function' ? options.where(rel.table.$columns) : options.where)
                            : null;

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
                        const nestedResult = buildNestedSelection(rel.table, options.with, newPrefix, outerJoinStrategy, outerUseGlobal, outerUseAny);
                        if (!(rel.relation === 'many' && !prefix)) {
                            Object.assign(currentSelection, nestedResult.selection);
                        }
                        currentJoins.push(...nestedResult.joins);
                    }
                    return { selection: currentSelection, joins: currentJoins };
                }

                const { selection: flatSelection, joins: allJoins } = buildNestedSelection(tableDef, opts?.with, '', joinStrategy, useGlobal, useAny);

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
                    builder = builder.where(typeof opts.where === 'function' ? opts.where(tableDef.$columns) : opts.where);
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
            }
        };
    }
    return api;
}