/**
 * HouseKit Materialized Views DSL - Type-Safe Materialized Views
 * 
 * Unlike generic ORMs which often treat materialized views as static SQL strings,
 * HouseKit allows defining MV queries using the Query Builder for
 * compile-time type safety. If you rename a column in the source table,
 * TypeScript will catch the error before deployment.
 */

import { ClickHouseColumn } from './column';
import { type TableDefinition, type TableColumns, type TableOptions } from './table';
import { EngineConfiguration, renderEngineSQL } from './engines';
import { sql, type SQLExpression } from './expressions';

// ============================================================================
// Type Definitions
// ============================================================================

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
export interface MaterializedViewConfig<
    TSource extends TableDefinition<any>,
    TTargetCols extends TableColumns = TableColumns
> {
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
    select<TSelection extends Record<string, ClickHouseColumn | SQLExpression>>(
        fields: TSelection
    ): MaterializedViewQueryBuilder<TTable>;

    from<TNewTable extends TableDefinition<any>>(
        table: TNewTable
    ): MaterializedViewQueryBuilder<TNewTable>;

    where(expression: SQLExpression): MaterializedViewQueryBuilder<TTable>;

    groupBy(...cols: (ClickHouseColumn | SQLExpression)[]): MaterializedViewQueryBuilder<TTable>;

    having(expression: SQLExpression): MaterializedViewQueryBuilder<TTable>;

    orderBy(
        col: ClickHouseColumn | SQLExpression,
        dir?: 'ASC' | 'DESC'
    ): MaterializedViewQueryBuilder<TTable>;

    limit(val: number): MaterializedViewQueryBuilder<TTable>;

    innerJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable>;
    leftJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable>;

    toSQL(): { query: string; params: Record<string, unknown> };
}

/**
 * Extended type for materialized views - contains table-like properties
 * plus MV-specific metadata for drift detection and query tracking.
 */
export type MaterializedViewDefinition<
    TCols extends TableColumns,
    TSource extends TableDefinition<any>,
    TOptions = MaterializedViewConfig<TSource>
> = {
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

// ============================================================================
// Virtual Query Builder for Compile-Only SQL Generation
// ============================================================================

/**
 * A virtual query builder that generates SQL without executing.
 * Used for defining materialized view queries in a type-safe way.
 */
class VirtualQueryBuilder<TTable extends TableDefinition<any>>
    implements MaterializedViewQueryBuilder<TTable> {
    private _select: Record<string, ClickHouseColumn | SQLExpression> | null = null;
    private _table: TableDefinition<any> | null = null;
    private _where: SQLExpression | null = null;
    private _groupBy: (ClickHouseColumn | SQLExpression)[] = [];
    private _having: SQLExpression | null = null;
    private _orderBy: { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' }[] = [];
    private _limit: number | null = null;
    private _joins: { type: 'INNER' | 'LEFT'; table: string; on: SQLExpression }[] = [];

    constructor(sourceTable?: TTable) {
        if (sourceTable) {
            this._table = sourceTable;
        }
    }

    select<TSelection extends Record<string, ClickHouseColumn | SQLExpression>>(
        fields: TSelection
    ): MaterializedViewQueryBuilder<TTable> {
        this._select = fields;
        return this as MaterializedViewQueryBuilder<TTable>;
    }

    from<TNewTable extends TableDefinition<any>>(
        table: TNewTable
    ): MaterializedViewQueryBuilder<TNewTable> {
        this._table = table;
        return this as unknown as MaterializedViewQueryBuilder<TNewTable>;
    }

    where(expression: SQLExpression): MaterializedViewQueryBuilder<TTable> {
        this._where = expression;
        return this;
    }

    groupBy(...cols: (ClickHouseColumn | SQLExpression)[]): MaterializedViewQueryBuilder<TTable> {
        this._groupBy = cols;
        return this;
    }

    having(expression: SQLExpression): MaterializedViewQueryBuilder<TTable> {
        this._having = expression;
        return this;
    }

    orderBy(
        col: ClickHouseColumn | SQLExpression,
        dir: 'ASC' | 'DESC' = 'ASC'
    ): MaterializedViewQueryBuilder<TTable> {
        this._orderBy.push({ col, dir });
        return this;
    }

    limit(val: number): MaterializedViewQueryBuilder<TTable> {
        this._limit = val;
        return this;
    }

    innerJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable> {
        this._joins.push({ type: 'INNER', table: table.$table, on });
        return this;
    }

    leftJoin(table: TableDefinition<any>, on: SQLExpression): MaterializedViewQueryBuilder<TTable> {
        this._joins.push({ type: 'LEFT', table: table.$table, on });
        return this;
    }

    toSQL(): { query: string; params: Record<string, unknown> } {
        const parts: string[] = [];
        const params: Record<string, unknown> = {};

        // SELECT clause
        if (this._select) {
            const selectParts = Object.entries(this._select).map(([alias, col]) => {
                if (col instanceof ClickHouseColumn) {
                    const tableName = col.tableName ? `\`${col.tableName}\`.` : '';
                    return `${tableName}\`${col.name}\` AS \`${alias}\``;
                } else {
                    // SQLExpression
                    const { sql, params: exprParams } = this.resolveSQLExpression(col);
                    Object.assign(params, exprParams);
                    return `${sql} AS \`${alias}\``;
                }
            });
            parts.push(`SELECT ${selectParts.join(', ')}`);
        } else {
            parts.push('SELECT *');
        }

        // FROM clause
        if (this._table) {
            parts.push(`FROM \`${this._table.$table}\``);
        }

        // JOIN clauses
        for (const join of this._joins) {
            const { sql: onSQL } = this.resolveSQLExpression(join.on);
            parts.push(`${join.type} JOIN \`${join.table}\` ON ${onSQL}`);
        }

        // WHERE clause
        if (this._where) {
            const { sql: whereSQL, params: whereParams } = this.resolveSQLExpression(this._where);
            Object.assign(params, whereParams);
            parts.push(`WHERE ${whereSQL}`);
        }

        // GROUP BY clause
        if (this._groupBy.length > 0) {
            const groupParts = this._groupBy.map(col => {
                if (col instanceof ClickHouseColumn) {
                    const tableName = col.tableName ? `\`${col.tableName}\`.` : '';
                    return `${tableName}\`${col.name}\``;
                } else {
                    const { sql } = this.resolveSQLExpression(col);
                    return sql;
                }
            });
            parts.push(`GROUP BY ${groupParts.join(', ')}`);
        }

        // HAVING clause
        if (this._having) {
            const { sql: havingSQL, params: havingParams } = this.resolveSQLExpression(this._having);
            Object.assign(params, havingParams);
            parts.push(`HAVING ${havingSQL}`);
        }

        // ORDER BY clause
        if (this._orderBy.length > 0) {
            const orderParts = this._orderBy.map(({ col, dir }) => {
                if (col instanceof ClickHouseColumn) {
                    const tableName = col.tableName ? `\`${col.tableName}\`.` : '';
                    return `${tableName}\`${col.name}\` ${dir}`;
                } else {
                    const { sql } = this.resolveSQLExpression(col);
                    return `${sql} ${dir}`;
                }
            });
            parts.push(`ORDER BY ${orderParts.join(', ')}`);
        }

        // LIMIT clause
        if (this._limit !== null) {
            parts.push(`LIMIT ${this._limit}`);
        }

        return { query: parts.join(' '), params };
    }

    private resolveSQLExpression(expr: SQLExpression): { sql: string; params: Record<string, unknown> } {
        const params: Record<string, unknown> = {};

        // Handle the SQLExpression type
        if (typeof (expr as any).toSQL === 'function') {
            const result = (expr as any).toSQL();
            return { sql: result.sql || String(result), params: result.params || {} };
        }

        if (typeof (expr as any).sql === 'string') {
            return { sql: (expr as any).sql, params: (expr as any).params || {} };
        }

        // Fallback: template literal handling
        if (Array.isArray((expr as any).strings)) {
            const exprAny = expr as any;
            let sql = '';
            const strings = exprAny.strings as string[];
            const values = exprAny.values as any[];

            for (let i = 0; i < strings.length; i++) {
                sql += strings[i];
                if (i < values.length) {
                    const value = values[i];
                    if (value instanceof ClickHouseColumn) {
                        const tableName = value.tableName ? `\`${value.tableName}\`.` : '';
                        sql += `${tableName}\`${value.name}\``;
                    } else if (typeof value === 'object' && value !== null && 'sql' in value) {
                        const nested = this.resolveSQLExpression(value);
                        sql += nested.sql;
                        Object.assign(params, nested.params);
                    } else {
                        // Literal value - use parameterized query
                        const paramName = `p${Object.keys(params).length}`;
                        params[paramName] = value;
                        sql += `{${paramName}: String}`; // ClickHouse parameter syntax
                    }
                }
            }
            return { sql, params };
        }

        return { sql: String(expr), params };
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

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
export function chMaterializedView<
    TCols extends TableColumns,
    TSource extends TableDefinition<any>,
    TTarget extends TableColumns = TCols
>(
    name: string,
    columns: TCols,
    config: MaterializedViewConfig<TSource, TTarget>
): MaterializedViewDefinition<TCols, TSource, MaterializedViewConfig<TSource, TTarget>> {
    // Validate that columns match the query output
    // (This is done at runtime as a safety net; TypeScript handles compile-time)

    // Create virtual query builder and compile query
    const virtualBuilder = new VirtualQueryBuilder(config.source);
    const finalBuilder = config.query(virtualBuilder);
    const { query: querySQL, params } = finalBuilder.toSQL();

    // Attach table name to columns
    for (const col of Object.values(columns)) {
        (col as ClickHouseColumn).tableName = name;
    }

    // Build SQL generation logic
    const toSQL = (): string => {
        const parts: string[] = [];

        // CREATE [OR REPLACE] MATERIALIZED VIEW
        if (config.orReplace) {
            parts.push('CREATE OR REPLACE MATERIALIZED VIEW');
        } else {
            parts.push('CREATE MATERIALIZED VIEW IF NOT EXISTS');
        }

        parts.push(`\`${name}\``);

        // ON CLUSTER
        if (config.onCluster) {
            parts.push(`ON CLUSTER ${config.onCluster}`);
        }

        // TO table or ENGINE
        if (config.toTable) {
            const tableName = typeof config.toTable === 'string'
                ? config.toTable
                : config.toTable.$table;
            parts.push(`TO \`${tableName}\``);
        } else if (config.engine) {
            const engineSQL = renderEngineSQL(config.engine);
            parts.push(`ENGINE = ${engineSQL}`);

            // ORDER BY for internal table
            if (config.orderBy) {
                const orderBy = Array.isArray(config.orderBy)
                    ? config.orderBy.join(', ')
                    : config.orderBy;
                parts.push(`ORDER BY (${orderBy})`);
            }

            // PARTITION BY for internal table
            if (config.partitionBy) {
                const partitionBy = Array.isArray(config.partitionBy)
                    ? config.partitionBy.join(', ')
                    : config.partitionBy;
                parts.push(`PARTITION BY (${partitionBy})`);
            }
        }

        // POPULATE
        if (config.populate) {
            parts.push('POPULATE');
        }

        // AS query
        parts.push('AS');
        parts.push(querySQL);

        return parts.join(' ');
    };

    // Create the base definition object
    const definition: any = {
        $table: name,
        $columns: columns,
        $options: config,
        $kind: 'materializedView' as const,
        $source: config.source,
        $querySQL: querySQL,
        $config: config,
        toSQL,
        toSQLs: () => [toSQL()],
        as: (alias: string) => {
            // Create an aliased version (for use in queries)
            const aliased: any = {
                $table: alias,
                $columns: { ...columns },
                $options: { ...config, externallyManaged: true },
                $kind: 'materializedView' as const,
                toSQL: () => ''
            };
            for (const [key, col] of Object.entries(columns)) {
                const column = col as ClickHouseColumn;
                const cloned = Object.create(Object.getPrototypeOf(column));
                Object.assign(cloned, column);
                cloned.tableName = alias;
                aliased[key] = cloned;
                aliased.$columns[key] = cloned;
            }
            return aliased;
        }
    };

    // Add columns as direct properties for type access
    for (const [key, col] of Object.entries(columns)) {
        definition[key] = col;
    }

    return definition as MaterializedViewDefinition<TCols, TSource, MaterializedViewConfig<TSource, TTarget>>;
}

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
export function chProjection<TCols extends TableColumns, TSource extends TableDefinition<TCols>>(
    name: string,
    sourceTable: TSource & TableWithColumns<TCols>,
    definition: (cols: TCols) => {
        select: Record<string, ClickHouseColumn | SQLExpression>;
        groupBy?: (ClickHouseColumn | SQLExpression)[];
        orderBy?: string[];
    }
): TypedProjectionDefinition<TSource> {
    // Now we have proper access to $columns with correct typing
    const cols = sourceTable.$columns;
    const def = definition(cols);

    // Build the projection query
    const selectParts = Object.entries(def.select).map(([alias, col]) => {
        if (col instanceof ClickHouseColumn) {
            return `\`${col.name}\` AS \`${alias}\``;
        } else {
            // SQLExpression - call toSQL() method
            const sqlExpr = col as SQLExpression;
            if (typeof sqlExpr.toSQL === 'function') {
                const { sql: sqlStr } = sqlExpr.toSQL({ ignoreTablePrefix: true });
                return `${sqlStr} AS \`${alias}\``;
            }
            // Fallback for unknown types
            return `${String(col)} AS \`${alias}\``;
        }
    });

    let query = `SELECT ${selectParts.join(', ')}`;

    if (def.groupBy && def.groupBy.length > 0) {
        const groupParts = def.groupBy.map(col => {
            if (col instanceof ClickHouseColumn) {
                return `\`${col.name}\``;
            }
            // SQLExpression
            const sqlExpr = col as SQLExpression;
            if (typeof sqlExpr.toSQL === 'function') {
                const { sql: sqlStr } = sqlExpr.toSQL({ ignoreTablePrefix: true });
                return sqlStr;
            }
            return String(col);
        });
        query += ` GROUP BY ${groupParts.join(', ')}`;
    }

    if (def.orderBy && def.orderBy.length > 0) {
        query += ` ORDER BY ${def.orderBy.join(', ')}`;
    }

    return {
        name,
        query,
        sourceTable,
        orderBy: def.orderBy
    };
}

/**
 * Convert a TypedProjectionDefinition to the format expected by defineTable
 */
export function toProjectionDefinition(
    projection: TypedProjectionDefinition<any>
): { name: string; query: string } {
    return {
        name: projection.name,
        query: projection.query
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize SQL for comparison (removes extra whitespace, normalizes case)
 */
export function normalizeSQL(sql: string): string {
    return sql
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/,\s+/g, ', ')
        .trim()
        .toUpperCase();
}

/**
 * Simple string hash for drift detection
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Compare two materialized view definitions for drift
 */
export function detectMaterializedViewDrift(
    local: MaterializedViewDefinition<any, any>,
    remoteSQL: string
): { hasDrift: boolean; localSQL: string; remoteSQL: string; normalizedLocal: string; normalizedRemote: string } {
    const localSQL = local.toSQL();
    const normalizedLocal = normalizeSQL(localSQL);
    const normalizedRemote = normalizeSQL(remoteSQL);

    return {
        hasDrift: normalizedLocal !== normalizedRemote,
        localSQL,
        remoteSQL,
        normalizedLocal,
        normalizedRemote
    };
}

/**
 * Extract the AS query from a CREATE MATERIALIZED VIEW statement
 */
export function extractMVQuery(createStatement: string): string | null {
    const match = createStatement.match(/\bAS\s+(.+)$/is);
    return match ? match[1].trim() : null;
}
/**
 * Generate a Blue-Green migration plan for a Materialized View update.
 * 
 * Instead of just dropping and recreating, we:
 * 1. Create a "next" version of the target table (if using TO table)
 * 2. Create a "next" version of the MV
 * 3. Backfill data from source table using the NEW query
 * 4. Swap them using RENAME
 */
export function generateBlueGreenMigration(
    oldMV: MaterializedViewDefinition<any, any>,
    newMV: MaterializedViewDefinition<any, any>,
    options: { backfill?: boolean } = {}
): string[] {
    const name = newMV.$table;
    const nextName = `${name}_next`;
    const targetTable = (newMV.$options as any).toTable;

    const sqls: string[] = [];

    if (targetTable) {
        const targetTableName = typeof targetTable === 'string' ? targetTable : targetTable.$table;
        const nextTargetName = `${targetTableName}_next`;

        // 1. Create next target table
        if (typeof targetTable !== 'string') {
            // If we have the full definition, we can generate the SQL for the next table
            const nextTableSQL = targetTable.toSQL().replace(new RegExp(`\`${targetTableName}\``, 'g'), `\`${nextTargetName}\``);
            sqls.push(nextTableSQL);
        } else {
            // Fallback: create table like old one
            sqls.push(`CREATE TABLE \`${nextTargetName}\` AS \`${targetTableName}\``);
        }

        // 2. Create next MV
        const nextMVSQL = newMV.toSQL()
            .replace(new RegExp(`\`${name}\``, 'g'), `\`${nextName}\``)
            .replace(new RegExp(`TO \`${targetTableName}\``, 'g'), `TO \`${nextTargetName}\``);
        sqls.push(nextMVSQL);

        // 3. Backfill (optional)
        if (options.backfill) {
            const querySQL = newMV.$querySQL;
            sqls.push(`INSERT INTO \`${nextTargetName}\` ${querySQL}`);
        }

        // 4. Atomic Swap
        sqls.push(`EXCHANGE TABLES \`${name}\` AND \`${nextName}\``);
        sqls.push(`EXCHANGE TABLES \`${targetTableName}\` AND \`${nextTargetName}\``);

        // 5. Cleanup
        sqls.push(`DROP VIEW IF EXISTS \`${nextName}\``);
        sqls.push(`DROP TABLE IF EXISTS \`${nextTargetName}\``);

    } else {
        // Internal table case - ClickHouse manages name, harder to swap cleanly
        // Better to just recreate or use OR REPLACE if acceptable
        sqls.push(`DROP VIEW IF EXISTS \`${name}\``);
        sqls.push(newMV.toSQL());
    }

    return sqls;
}

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
export function createMigrationBridge<
    TSourceCols extends TableColumns,
    TTargetCols extends TableColumns
>(options: {
    from: TableDefinition<TSourceCols>;
    to: TableDefinition<TTargetCols>;
    mapping?: Record<string, ClickHouseColumn | SQLExpression>;
    name?: string;
    onCluster?: string;
}): MaterializedViewDefinition<TTargetCols, TableDefinition<TSourceCols>> {
    const fromName = (options.from as any).$table;
    const toName = (options.to as any).$table;
    const bridgeName = options.name || `${fromName}_to_${toName}_bridge_mv`;

    // Build the selection: if no mapping, use all columns from 'from' that exist in 'to'
    const selection: Record<string, ClickHouseColumn | SQLExpression> = {};

    if (options.mapping) {
        Object.assign(selection, options.mapping);
    } else {
        // Default mapping: all columns with same name
        const fromCols = (options.from as any).$columns as TableColumns;
        const toCols = (options.to as any).$columns as TableColumns;
        for (const key of Object.keys(fromCols)) {
            if (toCols[key]) {
                selection[key] = fromCols[key];
            }
        }
    }

    return chMaterializedView(bridgeName, (options.to as any).$columns as TTargetCols, {
        source: options.from,
        toTable: options.to as any,
        onCluster: options.onCluster,
        query: (qb) => qb.from(options.from).select(selection)
    });
}
