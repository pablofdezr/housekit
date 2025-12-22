import { ClickHouseQueryBuilder } from './builders/select';
import { SQL } from './expressions';
import * as ops from './expressions';
import * as cond from './modules/conditional';
import { ClickHouseColumn, type RelationDefinition, type TableDefinition } from './core';
import type { SQLExpression } from './expressions';

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
 * Join strategy for relational queries
 */
export type JoinStrategy =
    | 'auto'      // Automatically choose based on table configuration
    | 'standard'  // Use regular LEFT JOIN
    | 'global'    // Force GLOBAL JOIN (for clusters)
    | 'any'       // Use ANY JOIN (faster, single match)
    | 'global_any'; // Combine GLOBAL and ANY

export type RelationalFindOptions<TTable = any> = {
    where?: SQLExpression | ((columns: TTable extends TableDefinition<infer TCols> ? TCols : any) => SQLExpression);
    limit?: number;
    offset?: number;
    with?: Record<string, boolean | RelationalFindOptions>;
    /**
     * Join strategy for related data.
     * 
     * - 'auto': Automatically uses GLOBAL when table has onCluster option
     * - 'standard': Regular LEFT JOIN
     * - 'global': Force GLOBAL JOIN (for clusters)
     * - 'any': Use ANY JOIN (faster, single match)
     * - 'global_any': Combine GLOBAL and ANY
     * 
     * @default 'auto'
     */
    joinStrategy?: JoinStrategy;
};

function buildJoinCondition(fields: ClickHouseColumn[] | undefined, references: ClickHouseColumn[] | undefined): SQLExpression | null {
    if (!fields || !references || fields.length === 0 || references.length === 0) return null;
    const pairs = fields.map((f, i) => ops.sql`${f} = ${references[i]}`);
    const filtered = pairs.filter((p): p is SQL => Boolean(p));
    if (filtered.length === 0) return null;
    if (filtered.length === 1) return filtered[0];
    const combined = cond.and(...filtered);
    return combined || null;
}

/**
 * Determine if a table is distributed/clustered
 */
function isDistributedTable(tableDef: TableDefinition<any>): boolean {
    const options = tableDef.$options as any;
    return !!(options?.onCluster || options?.shardKey);
}

/**
 * Build a modern relational API with ClickHouse optimizations.
 * 
 * Key improvements over standard ORMs:
 * - Automatic GLOBAL JOIN detection for distributed tables
 * - Join strategy selection for performance tuning
 * - Support for dictionary lookups as alternative to JOINs
 */
export function buildRelationalAPI(client: any, schema?: Record<string, TableDefinition<any>>) {
    if (!schema) return undefined;
    const api: Record<string, any> = {};

    for (const [tableKey, tableDef] of Object.entries(schema)) {
        api[tableKey] = {
            findMany: async (opts?: RelationalFindOptions<typeof tableDef>) => {
                let builder = new ClickHouseQueryBuilder(client).from(tableDef);

                const baseColumns = Object.entries(tableDef.$columns);
                const selection: Record<string, any> = {};
                baseColumns.forEach(([key, col]) => { selection[key] = col; });

                const relations = (tableDef as any).$relations as Record<string, RelationDefinition> | undefined;

                const requestedTopLevel = opts?.with ? Object.entries(opts.with).filter(([, v]) => v) : [];

                const requestedRelations = requestedTopLevel
                    .map(([relName, val]: [string, boolean | RelationalFindOptions]) => {
                        const rel = relations?.[relName];
                        return { relName, rel, options: typeof val === 'object' ? val : {} };
                    })
                    .filter((r): r is { relName: string; rel: RelationDefinition; options: any } => Boolean(r.rel));

                const needsGrouping = requestedRelations.length > 0;
                const groupByColumns = needsGrouping ? baseColumns.map(([, col]) => col as ClickHouseColumn) : [];

                // Determine join strategy
                const joinStrategy: JoinStrategy = opts?.joinStrategy || 'auto';
                const isDistributed = isDistributedTable(tableDef);
                const useGlobal = joinStrategy === 'global' ||
                    joinStrategy === 'global_any' ||
                    (joinStrategy === 'auto' && isDistributed);
                const useAny = joinStrategy === 'any' || joinStrategy === 'global_any';

                // Recursive function to build selection and joins
                function buildNestedSelection(
                    currentTableDef: TableDefinition<any>,
                    currentWith: RelationalFindOptions['with'],
                    prefix: string = '',
                    outerJoinStrategy: JoinStrategy,
                    outerUseGlobal: boolean,
                    outerUseAny: boolean,
                    isInsideMany: boolean = false
                ): { selection: Record<string, any>; joins: any[] } {
                    let currentSelection: Record<string, any> = {};
                    let currentJoins: any[] = [];

                    // Base columns
                    const tableCols = Object.entries(currentTableDef.$columns);

                    // Standard flat selection (fallback/default)
                    tableCols.forEach(([key, col]) => {
                        currentSelection[`${prefix}${key}`] = col;
                    });

                    if (!currentWith) return { selection: currentSelection, joins: currentJoins };

                    const currentRelations = (currentTableDef as any).$relations as Record<string, RelationDefinition> | undefined;
                    const requestedNested = Object.entries(currentWith)
                        .map(([relName, val]) => {
                            const rel = currentRelations?.[relName];
                            return { relName, rel, options: typeof val === 'object' ? val : {} };
                        })
                        .filter((r): r is { relName: string; rel: RelationDefinition; options: any } => Boolean(r.rel));

                    for (const { relName, rel, options } of requestedNested) {
                        const newPrefix = prefix ? `${prefix}_${relName}_` : `${relName}_`;

                        // Resolve relation filter (where)
                        const relWhere = options.where
                            ? (typeof options.where === 'function' ? options.where(rel.table.$columns) : options.where)
                            : null;

                        // Add join for this relation
                        let joinCondition = buildJoinCondition(rel.fields, rel.references);

                        if (joinCondition) {
                            const joinType = (() => {
                                const relIsDistributed = isDistributedTable(rel.table);
                                const useRelGlobal = outerUseGlobal ||
                                    outerJoinStrategy === 'global_any' ||
                                    (outerJoinStrategy === 'auto' && relIsDistributed);
                                const useRelAny = outerUseAny || outerJoinStrategy === 'global_any';

                                if (useRelGlobal && useRelAny) return builder.globalAnyJoin;
                                if (useRelGlobal) return builder.globalLeftJoin;
                                if (useRelAny) return builder.anyLeftJoin;
                                return builder.leftJoin;
                            })();

                            // Optimization: If it's a 'many' relation, we can use groupArray if it's top-level
                            if (rel.relation === 'many' && !prefix) {
                                // For 'many' relations at top level, we add a groupArray(tuple(...)) selection
                                const relCols = Object.entries(rel.table.$columns);
                                const tupleArgs = relCols.map(([, col]) => ops.sql`${col}`);

                                if (relWhere) {
                                    // Use groupArrayIf for filtering
                                    currentSelection[relName] = ops.sql`groupArrayIf(tuple(${ops.sql.join(tupleArgs, ops.sql`, `)}), ${relWhere})`;
                                } else {
                                    currentSelection[relName] = ops.sql`groupArray(tuple(${ops.sql.join(tupleArgs, ops.sql`, `)}))`;
                                }
                            } else {
                                // If it's a 'one' relation or nested 'many', we might need to add filter to join condition
                                if (relWhere && rel.relation === 'one') {
                                    joinCondition = cond.and(joinCondition, relWhere) as SQLExpression;
                                }
                            }

                            currentJoins.push({ type: joinType, table: rel.table, on: joinCondition });
                        }

                        // Recursively build selection for nested relations
                        if (rel.relation === 'one') {
                            const nestedResult = buildNestedSelection(rel.table, options.with, newPrefix, outerJoinStrategy, outerUseGlobal, outerUseAny, isInsideMany);
                            Object.assign(currentSelection, nestedResult.selection);
                            currentJoins.push(...nestedResult.joins);
                        } else if (prefix) {
                            // Deeply nested 'many' relations still use flat joins for now
                            const nestedResult = buildNestedSelection(rel.table, options.with, newPrefix, outerJoinStrategy, outerUseGlobal, outerUseAny, true);
                            Object.assign(currentSelection, nestedResult.selection);
                            currentJoins.push(...nestedResult.joins);
                        }
                    }
                    return { selection: currentSelection, joins: currentJoins };
                }

                const { selection: flatSelection, joins: allJoins } = buildNestedSelection(
                    tableDef,
                    opts?.with,
                    '',
                    joinStrategy,
                    useGlobal,
                    useAny
                );

                // Apply all collected joins
                for (const joinDef of allJoins) {
                    builder = joinDef.type.call(builder, joinDef.table, joinDef.on) as any;
                }

                builder = (builder as any).select(flatSelection);

                if (needsGrouping && groupByColumns.length > 0) {
                    builder = (builder as any).groupBy(...groupByColumns);
                }
                if (opts?.where) {
                    const whereExpr = typeof opts.where === 'function'
                        ? opts.where(tableDef.$columns)
                        : opts.where;
                    builder = builder.where(whereExpr);
                }
                if (opts?.limit) {
                    builder = builder.limit(opts.limit);
                }
                if (opts?.offset) {
                    builder = builder.offset(opts.offset);
                }

                const rows = await builder.then();

                // High-Performance Relational Reconstruction
                function reconstructNested(row: any, currentTableDef: TableDefinition<any>, currentWith: RelationalFindOptions['with'], prefix: string = '') {
                    const result: Record<string, any> = {};

                    // Extract base columns
                    Object.entries(currentTableDef.$columns).forEach(([key, col]) => {
                        const colName = `${prefix}${key}`;
                        result[key] = row[colName];
                    });

                    if (!currentWith) return result;

                    const currentRelations = (currentTableDef as any).$relations as Record<string, RelationDefinition> | undefined;
                    const requestedNested = Object.entries(currentWith)
                        .map(([relName, val]) => {
                            const rel = currentRelations?.[relName];
                            return { relName, rel, options: typeof val === 'object' ? val : {} };
                        })
                        .filter((r): r is { relName: string; rel: RelationDefinition; options: any } => Boolean(r.rel));

                    for (const { relName, rel, options } of requestedNested) {
                        const newPrefix = prefix ? `${prefix}_${relName}_` : `${relName}_`;

                        if (rel.relation === 'one') {
                            // Single relation - reconstructed from flat columns
                            const relatedData = reconstructNested(row, rel.table, options.with, newPrefix);
                            const allNull = Object.values(relatedData).every(v => v === null || v === undefined);
                            result[relName] = allNull ? null : relatedData;
                        } else {
                            // Many relation - ClickHouse returns this as an Array of Tuples if we used groupArray
                            const rawVal = row[relName];

                            if (Array.isArray(rawVal)) {
                                // Optimized path: map tuples back to objects
                                const relCols = Object.keys(rel.table.$columns);
                                result[relName] = rawVal
                                    .map((tuple: any[]) => {
                                        const obj: Record<string, any> = {};
                                        let allNull = true;
                                        relCols.forEach((colKey, i) => {
                                            const val = tuple[i];
                                            if (val !== null && val !== undefined) allNull = false;
                                            obj[colKey] = val;
                                        });
                                        return allNull ? null : obj;
                                    })
                                    .filter(Boolean);
                            } else {
                                // Fallback for deep relations that still use flat joins
                                const relatedData = reconstructNested(row, rel.table, options.with, newPrefix);
                                const allNull = Object.values(relatedData).every(v => v === null || v === undefined);
                                result[relName] = allNull ? [] : [relatedData];
                            }
                        }
                    }
                    return result;
                }

                // If it's a "many" relation query with flat joins, we need to group by base ID
                const results = rows.map((row: any) => reconstructNested(row, tableDef, opts?.with));

                if (needsGrouping) {
                    // Smart Deduplication: If row multiplication occurred, merge the "many" arrays
                    const grouped = new Map<string, any>();
                    // Find a unique key for the base table (primary key or first column)
                    const pkCols = Array.isArray(tableDef.$options.primaryKey)
                        ? tableDef.$options.primaryKey
                        : [tableDef.$options.primaryKey || Object.keys(tableDef.$columns)[0]];

                    for (const item of results) {
                        const id = pkCols.map((col: string) => item[col]).join('|');
                        if (!grouped.has(id)) {
                            grouped.set(id, item);
                        } else {
                            const existing = grouped.get(id);
                            // Merge "many" relations
                            for (const { relName, rel } of requestedRelations) {
                                if (rel.relation === 'many' && Array.isArray(item[relName])) {
                                    existing[relName].push(...item[relName]);
                                }
                            }
                        }
                    }
                    return Array.from(grouped.values());
                }

                return results;
            },
            findFirst: async (opts?: RelationalFindOptions) => {
                const rows = await api[tableKey].findMany({ ...opts, limit: 1 });
                return rows[0] ?? null;
            }
        };
    }

    return api;
}