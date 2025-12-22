/**
 * HouseKit Materialized Views DSL - Type-Safe Materialized Views
 *
 * Unlike generic ORMs which often treat materialized views as static SQL strings,
 * HouseKit allows defining MV queries using the Query Builder for
 * compile-time type safety. If you rename a column in the source table,
 * TypeScript will catch the error before deployment.
 */
import { ClickHouseColumn } from './column';
import { type TableDefinition, type TableColumns } from './table';
import { EngineConfiguration } from './engines';
import { type SQLExpression } from './expressions';
/**
 * Helper type to extract columns from a TableDefinition
 */
export type InferTableColumns<T> = T extends TableDefinition<infer TCols> ? TCols : TableColumns;
/**
 * Helper type to ensure we have access to $columns
 */
type TableWithColumns<TCols extends TableColumns> = {
    $table: string;
    $columns: TCols;
};
/**
 * Configuration for type-safe materialized views
 */
export interface MaterializedViewConfig<TSource extends TableDefinition<any>, TTargetCols extends TableColumns = TableColumns> {
    /**
     * Source table(s) for the materialized view.
     * This is used to provide type information for the query builder.
     */
    source: TSource;
    /**
     * The query definition for the materialized view.
     * Use the query builder to ensure type safety.
     *
     * @example
     * ```typescript
     * query: (qb) => qb
     *   .from(events)
     *   .select({
     *     eventType: events.event_type,
     *     count: sql`count()`
     *   })
     *   .groupBy(events.event_type)
     * ```
     */
    query: (qb: MaterializedViewQueryBuilder<TSource>) => MaterializedViewQueryBuilder<any>;
    /**
     * Target table to write materialized data to.
     * If not specified, ClickHouse creates an internal table.
     *
     * Can be:
     * - A string table name
     * - A TableDefinition reference (type-safe)
     */
    toTable?: string | TableDefinition<TTargetCols>;
    /**
     * Cluster name for distributed materialized view
     */
    onCluster?: string;
    /**
     * Whether to populate the MV with existing data on creation.
     * Warning: Can be slow and resource-intensive for large tables.
     */
    populate?: boolean;
    /**
     * Engine configuration for the internal table (when toTable is not specified).
     * Uses the type-safe Engine DSL.
     */
    engine?: EngineConfiguration;
    /**
     * Whether to use OR REPLACE semantics
     */
    orReplace?: boolean;
    /**
     * Optional ORDER BY for the internal storage table
     */
    orderBy?: string | string[];
    /**
     * Optional partition by for the internal storage table
     */
    partitionBy?: string | string[];
}
/**
 * Simplified query builder for materialized view definitions.
 * This is a subset of the full ClickHouseQueryBuilder that generates
 * SQL without executing queries.
 */
export interface MaterializedViewQueryBuilder<TTable extends TableDefinition<any>> {
    select<TSelection extends Record<string, ClickHouseColumn | SQLExpression>>(fields: TSelection): MaterializedViewQueryBuilder<TTable>;
    from<TNewTable extends TableDefinition<any>>(table: TNewTable): MaterializedViewQueryBuilder<TNewTable>;
    where(expression: SQLExpression): MaterializedViewQueryBuilder<TTable>;
    groupBy(...cols: (ClickHouseColumn | SQLExpression)[]): MaterializedViewQueryBuilder<TTable>;
    having(expression: SQLExpression): MaterializedViewQueryBuilder<TTable>;
    orderBy(col: ClickHouseColumn | SQLExpression, dir?: 'ASC' | 'DESC'): MaterializedViewQueryBuilder<TTable>;
    limit(val: number): MaterializedViewQueryBuilder<TTable>;
    innerJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable>;
    leftJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable>;
    toSQL(): {
        query: string;
        params: Record<string, unknown>;
    };
}
/**
 * Extended type for materialized views - contains table-like properties
 * plus MV-specific metadata for drift detection and query tracking.
 */
export type MaterializedViewDefinition<TCols extends TableColumns, TSource extends TableDefinition<any>, TOptions = MaterializedViewConfig<TSource>> = {
    $table: string;
    $columns: TCols;
    $options: TOptions;
    $kind: 'materializedView';
    $source: TSource;
    $querySQL: string;
    $config: TOptions;
    /**
     * Get the SQL to create the materialized view
     */
    toSQL(): string;
    /**
     * Get all SQL statements (for views that need multiple statements)
     */
    toSQLs(): string[];
    /**
     * Create an aliased version for use in queries
     */
    as(alias: string): MaterializedViewDefinition<TCols, TSource, TOptions>;
} & TCols;
/**
 * Result type for projection definitions using query builder
 */
export interface TypedProjectionDefinition<TSource extends TableDefinition<any>> {
    name: string;
    query: string;
    sourceTable: TSource;
    orderBy?: string[];
}
/**
 * Create a type-safe materialized view definition.
 * The query is defined using a query builder that validates column references
 * at compile time.
 *
 * @example
 * ```typescript
 * import { defineMaterializedView, text, uint64, sql, Engine } from '@housekit/orm';
 *
 * // Source table
 * const events = defineTable('events', {
 *   event_type: t.text('event_type'),
 *   user_id: t.text('user_id'),
 *   revenue: t.uint64('revenue'),
 * }, { engine: Engine.MergeTree(), orderBy: 'event_type' });
 *
 * // Type-safe materialized view
 * export const revenueByEvent = defineMaterializedView('revenue_by_event_mv', {
 *   event_type: t.text('event_type'),
 *   total_revenue: t.uint64('total_revenue'),
 *   event_count: t.uint64('event_count'),
 * }, {
 *   source: events,
 *   query: (qb) => qb
 *     .from(events)  // Type-safe: only accepts events columns
 *     .select({
 *       event_type: events.event_type,
 *       total_revenue: sql`sum(${events.revenue})`,
 *       event_count: sql`count()`,
 *     })
 *     .groupBy(events.event_type),
 *   engine: Engine.SummingMergeTree(['total_revenue', 'event_count']),
 *   orderBy: 'event_type',
 * });
 * ```
 */
export declare function chMaterializedView<TCols extends TableColumns, TSource extends TableDefinition<any>, TTarget extends TableColumns = TCols>(name: string, columns: TCols, config: MaterializedViewConfig<TSource, TTarget>): MaterializedViewDefinition<TCols, TSource, MaterializedViewConfig<TSource, TTarget>>;
/**
 * Create a type-safe projection definition.
 *
 * Projections are precomputed aggregations stored alongside the main table.
 * They're automatically used by ClickHouse when the query matches.
 *
 * @example
 * ```typescript
 * const events = defineTable('events', {
 *   event_type: t.text('event_type'),
 *   user_id: t.text('user_id'),
 *   created_at: t.timestamp('created_at'),
 * }, {
 *   engine: Engine.MergeTree(),
 *   orderBy: ['event_type', 'created_at'],
 *   projections: [
 *     // Type-safe projection
 *     chProjection('events_by_user', events, (cols) => ({
 *       select: {
 *         user_id: cols.user_id,
 *         event_type: cols.event_type,
 *         event_count: sql`count()`,
 *       },
 *       groupBy: [cols.user_id, cols.event_type],
 *       orderBy: ['user_id', 'event_type'],
 *     })),
 *   ],
 * });
 * ```
 */
export declare function chProjection<TCols extends TableColumns, TSource extends TableDefinition<TCols>>(name: string, sourceTable: TSource & TableWithColumns<TCols>, definition: (cols: TCols) => {
    select: Record<string, ClickHouseColumn | SQLExpression>;
    groupBy?: (ClickHouseColumn | SQLExpression)[];
    orderBy?: string[];
}): TypedProjectionDefinition<TSource>;
/**
 * Convert a TypedProjectionDefinition to the format expected by defineTable
 */
export declare function toProjectionDefinition(projection: TypedProjectionDefinition<any>): {
    name: string;
    query: string;
};
/**
 * Normalize SQL for comparison (removes extra whitespace, normalizes case)
 */
export declare function normalizeSQL(sql: string): string;
/**
 * Compare two materialized view definitions for drift
 */
export declare function detectMaterializedViewDrift(local: MaterializedViewDefinition<any, any>, remoteSQL: string): {
    hasDrift: boolean;
    localSQL: string;
    remoteSQL: string;
    normalizedLocal: string;
    normalizedRemote: string;
};
/**
 * Extract the AS query from a CREATE MATERIALIZED VIEW statement
 */
export declare function extractMVQuery(createStatement: string): string | null;
/**
 * Generate a Blue-Green migration plan for a Materialized View update.
 *
 * Instead of just dropping and recreating, we:
 * 1. Create a "next" version of the target table (if using TO table)
 * 2. Create a "next" version of the MV
 * 3. Backfill data from source table using the NEW query
 * 4. Swap them using RENAME
 */
export declare function generateBlueGreenMigration(oldMV: MaterializedViewDefinition<any, any>, newMV: MaterializedViewDefinition<any, any>, options?: {
    backfill?: boolean;
}): string[];
/**
 * Creates a "migration bridge" Materialized View that synchronizes data from an old table to a new one.
 * This is extremely useful for zero-downtime migrations where you need to pipe real-time
 * inserts from the v1 table into the v2 table while you perform a separate historical backfill.
 *
 * @example
 * ```typescript
 * const bridge = createMigrationBridge({
 *   from: tableV1,
 *   to: tableV2,
 *   mapping: {
 *     new_col: sql`upper(${tableV1.old_col})`
 *   }
 * });
 * ```
 */
export declare function createMigrationBridge<TSourceCols extends TableColumns, TTargetCols extends TableColumns>(options: {
    from: TableDefinition<TSourceCols>;
    to: TableDefinition<TTargetCols>;
    mapping?: Record<string, ClickHouseColumn | SQLExpression>;
    name?: string;
    onCluster?: string;
}): MaterializedViewDefinition<TTargetCols, TableDefinition<TSourceCols>>;
export {};
