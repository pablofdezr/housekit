import type { ClickHouseClient } from '@clickhouse/client';
import { ClickHouseColumn, type TableDefinition, type TableOptions } from '../core';
import { type SQLExpression } from '../expressions';
import { type QueryBuilderState, type SelectionShape, type SelectResult, type ResultWithArrayJoin, type InferQueryResult } from './select.types';
export type { QueryBuilderState, SelectionShape, SelectResult } from './select.types';
export type InferQueryResultFromBuilder<TBuilder extends ClickHouseQueryBuilder<any, any, any>> = TBuilder extends ClickHouseQueryBuilder<any, any, infer TResult> ? TResult : never;
type StandardJoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
export declare class ClickHouseQueryBuilder<TTable extends TableDefinition<any> | null = null, TSelection extends SelectionShape | null = null, TResult = InferQueryResult<TTable, TSelection>> {
    private client;
    private _select;
    private _table;
    private _prewhere;
    private _sample;
    private _settings;
    private _distinct;
    private _joins;
    private _arrayJoins;
    private _ctes;
    private _where;
    private _limit;
    private _offset;
    private _orderBy;
    private _groupBy;
    private _having;
    private _final;
    private _windows;
    private _suggestions;
    constructor(client: ClickHouseClient);
    select<TNewSelection extends SelectionShape>(fields: TNewSelection): ClickHouseQueryBuilder<TTable, TNewSelection, InferQueryResult<TTable, TNewSelection>>;
    select(): ClickHouseQueryBuilder<TTable, null, InferQueryResult<TTable, null>>;
    from<TNewTable extends TableDefinition<any>>(table: TNewTable): ClickHouseQueryBuilder<TNewTable, TSelection, InferQueryResult<TNewTable, TSelection>>;
    from<TSubQuery extends ClickHouseQueryBuilder<any, any, any>>(subquery: TSubQuery, alias?: string): ClickHouseQueryBuilder<any, TSelection, any>;
    private fromSubquery;
    where(expression: SQLExpression | undefined | null): this;
    orderBy(col: ClickHouseColumn | SQLExpression | {
        col: ClickHouseColumn | SQLExpression;
        dir: 'ASC' | 'DESC';
    }, dir?: 'ASC' | 'DESC'): this;
    groupBy(...cols: (ClickHouseColumn | SQLExpression)[]): this;
    having(expression: SQLExpression): this;
    limit(val: number): this;
    offset(val: number): this;
    distinct(): this;
    innerJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    leftJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    rightJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    fullJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * CROSS JOIN - Cartesian product of two tables
     * Use with caution on large tables!
     */
    crossJoin(table: {
        $table: string;
    }): this;
    /**
     * GLOBAL JOIN - Essential for distributed ClickHouse clusters.
     *
     * In a cluster, the right table is sent to all nodes where the left table exists.
     * Without GLOBAL, each node only sees its local data, leading to incomplete results.
     *
     * @example
     * ```typescript
     * // For distributed tables, use GLOBAL to ensure complete results
     * db.select().from(events).globalJoin('LEFT', users, eq(events.user_id, users.id))
     * ```
     */
    globalJoin(type: StandardJoinType, table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * Global INNER JOIN shorthand
     */
    globalInnerJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * Global LEFT JOIN shorthand
     */
    globalLeftJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ANY JOIN - Returns first matching row from right table.
     *
     * Faster than ALL JOIN but may be non-deterministic if multiple rows match.
     * Excellent for lookup tables where you know there's only one match.
     *
     * @example
     * ```typescript
     * // When user_id is unique in users table, ANY is faster
     * db.select().from(events).anyJoin('LEFT', users, eq(events.user_id, users.id))
     * ```
     */
    anyJoin(type: StandardJoinType, table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ANY INNER JOIN shorthand
     */
    anyInnerJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ANY LEFT JOIN shorthand
     */
    anyLeftJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ALL JOIN - Returns all matching rows (default SQL behavior).
     * Explicitly stating ALL can be useful for clarity.
     */
    allJoin(type: StandardJoinType, table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ASOF JOIN - Time-series join that finds closest match.
     *
     * Essential for financial data, IoT, and logs where exact timestamp matches are rare.
     * Finds the row with the closest (less-than-or-equal) value in the ordered column.
     *
     * The ON condition should include an inequality on an ordered column.
     *
     * @example
     * ```typescript
     * // Find the closest price quote for each trade
     * db.select()
     *   .from(trades)
     *   .asofJoin(quotes, sql`${trades.symbol} = ${quotes.symbol} AND ${trades.timestamp} >= ${quotes.timestamp}`)
     * ```
     */
    asofJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ASOF INNER JOIN - Same as ASOF but only returns matching rows
     */
    asofInnerJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * SEMI JOIN - Returns rows from left table that have at least one match in right.
     *
     * Unlike regular JOIN, doesn't duplicate rows and doesn't include right table columns.
     * More efficient than EXISTS subquery.
     *
     * @example
     * ```typescript
     * // Get all users who have at least one order
     * db.select().from(users).semiJoin(orders, eq(users.id, orders.user_id))
     * ```
     */
    semiJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * ANTI JOIN - Returns rows from left table that have NO matches in right.
     *
     * More efficient than NOT EXISTS subquery.
     *
     * @example
     * ```typescript
     * // Get all users who have never placed an order
     * db.select().from(users).antiJoin(orders, eq(users.id, orders.user_id))
     * ```
     */
    antiJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * GLOBAL ASOF JOIN - For time-series joins across distributed clusters
     */
    globalAsofJoin(table: {
        $table: string;
    }, on: SQLExpression): this;
    /**
     * GLOBAL ANY JOIN - Combines GLOBAL (for clusters) with ANY (for performance)
     */
    globalAnyJoin(type: StandardJoinType, table: {
        $table: string;
    }, on: SQLExpression): this;
    arrayJoin<TCol extends ClickHouseColumn, TColName extends keyof TResult>(column: TCol & {
        name: TColName;
    }, ...additionalColumns: (ClickHouseColumn | SQLExpression)[]): ClickHouseQueryBuilder<TTable, TSelection, ResultWithArrayJoin<TResult, TColName>>;
    arrayJoinMultiple<TColumns extends (ClickHouseColumn | SQLExpression)[]>(...columns: TColumns): ClickHouseQueryBuilder<TTable, TSelection, TResult>;
    arrayJoinAs(column: ClickHouseColumn | SQLExpression, alias: string): ClickHouseQueryBuilder<TTable, TSelection, any>;
    with(name: string, query: ClickHouseQueryBuilder<any>): this;
    prewhere(expression: SQLExpression): this;
    sample(ratio: number, offset?: number): this;
    /**
     * Define a typed CTE and get a virtual table for use in FROM/JOIN with autocomplete.
     * Also registers the CTE on this builder; use register() to attach to another builder if needed.
     */
    $with<TAlias extends string, TSelection extends SelectionShape | null>(alias: TAlias, queryBuilder: ClickHouseQueryBuilder<any, TSelection>): {
        cteTable: {
            $table: string;
            $columns: TSelection extends SelectionShape ? { [K in keyof (TSelection extends infer T ? T extends TSelection ? T extends SelectionShape ? SelectResult<T> : Record<string, any> : never : never)]: ClickHouseColumn<(TSelection extends infer T_1 ? T_1 extends TSelection ? T_1 extends SelectionShape ? SelectResult<T_1> : Record<string, any> : never : never)[K], true, false>; } : Record<string, ClickHouseColumn<any, true, false>>;
            $options: TableOptions & {
                kind: "cte";
                query?: string;
            };
            $relations?: Record<string, import("../table").RelationDefinition>;
            toSQL(): string;
            toSQLs?(): string[];
            as(alias: string): TableDefinition<TSelection extends SelectionShape ? { [K in keyof (TSelection extends infer T_1 ? T_1 extends TSelection ? T_1 extends SelectionShape ? SelectResult<T_1> : Record<string, any> : never : never)]: ClickHouseColumn<(TSelection extends infer T_2 ? T_2 extends TSelection ? T_2 extends SelectionShape ? SelectResult<T_2> : Record<string, any> : never : never)[K], true, false>; } : Record<string, ClickHouseColumn<any, true, false>>, TableOptions & {
                kind: "cte";
                query?: string;
            }>;
            $inferSelect?: import("../table").InferSelectModel<{
                $columns: TSelection extends SelectionShape ? { [K in keyof (TSelection extends infer T_1 ? T_1 extends TSelection ? T_1 extends SelectionShape ? SelectResult<T_1> : Record<string, any> : never : never)]: ClickHouseColumn<(TSelection extends infer T_2 ? T_2 extends TSelection ? T_2 extends SelectionShape ? SelectResult<T_2> : Record<string, any> : never : never)[K], true, false>; } : Record<string, ClickHouseColumn<any, true, false>>;
            }> | undefined;
            $inferInsert?: import("../table").InferInsertModel<{
                $columns: TSelection extends SelectionShape ? { [K in keyof (TSelection extends infer T_2 ? T_2 extends TSelection ? T_2 extends SelectionShape ? SelectResult<T_2> : Record<string, any> : never : never)]: ClickHouseColumn<(TSelection extends infer T_3 ? T_3 extends TSelection ? T_3 extends SelectionShape ? SelectResult<T_3> : Record<string, any> : never : never)[K], true, false>; } : Record<string, ClickHouseColumn<any, true, false>>;
            }> | undefined;
        } & (TSelection extends SelectionShape ? { [K in keyof (TSelection extends infer T_3 ? T_3 extends TSelection ? T_3 extends SelectionShape ? SelectResult<T_3> : Record<string, any> : never : never)]: ClickHouseColumn<(TSelection extends infer T_4 ? T_4 extends TSelection ? T_4 extends SelectionShape ? SelectResult<T_4> : Record<string, any> : never : never)[K], true, false>; } : Record<string, ClickHouseColumn<any, true, false>>);
        register: (mainQuery: ClickHouseQueryBuilder<any, any, any>) => ClickHouseQueryBuilder<any, any, any>;
    };
    final(): this;
    window(name: string, definition: string): this;
    settings(settings: Record<string, string | number | boolean>): this;
    private createSubqueryTable;
    getState(): QueryBuilderState<ClickHouseQueryBuilder<any>>;
    toSQL(): {
        query: string;
        params: Record<string, unknown>;
        suggestions: string[];
    };
    then<TResult1 = TResult[], TResult2 = never>(onfulfilled?: ((value: TResult[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    /**
     * Native streaming support.
     * Iterate over results row-by-row without loading everything into memory.
     * Prevents OOM on large datasets.
     *
     * @example
     * for await (const row of db.select().from(logs)) {
     *   process(row);
     * }
     */
    [Symbol.asyncIterator](): AsyncIterableIterator<TResult>;
    /**
     * Explicit alias for streaming
     */
    stream(): AsyncIterableIterator<TResult>;
    /**
     * Native binary mode for high-performance data retrieval.
     * Reads data using ClickHouse 'RowBinary' format and parses it directly in Node.js.
     * Up to 10x faster than standard JSON select for large datasets.
     *
     * Requirements: All selected columns must be strictly typed (ClickHouseColumn instances).
     */
    native(): Promise<TResult[]>;
    /**
     * Vector mode for columnar data retrieval.
     * Returns data in Columnar format (TypedArrays) instead of Row-based objects.
     * Ideal for analytical processing, charting, or passing to libraries like Apache Arrow.
     *
     * @example
     * const { prices } = await db.select({ prices: trades.price }).vector();
     * // prices is a Float64Array
     */
    vector(): Promise<{
        [K in keyof TResult]: TResult[K] extends number ? (TResult[K] extends number ? Float64Array | Int32Array : Array<TResult[K]>) : Array<TResult[K]>;
    }>;
    private executeBinary;
    explain(): Promise<any>;
    explainPipeline(): Promise<any>;
    /**
     * Find first record (limit 1)
     * @returns First record or null if no records found
     */
    findFirst(): Promise<TResult | null>;
    /**
     * Find unique record (limit 1, expects exactly one record)
     * @returns Record if found, null if no records found
     * @throws If multiple records found (shouldn't happen with limit 1)
     */
    findUnique(): Promise<TResult | null>;
    /**
     * Find many records with pagination
     * @param options - Pagination options
     */
    findMany(options?: {
        limit?: number;
        offset?: number;
    }): Promise<TResult[]>;
    /**
     * Find many records with cursor-based pagination
     * @param options - Cursor pagination options
     */
    findManyCursor(options?: {
        limit?: number;
        cursor?: {
            column: ClickHouseColumn | SQLExpression;
            value: any;
            direction?: 'ASC' | 'DESC';
        };
    }): Promise<TResult[]>;
    /**
     * Count records with optional where clause
     * @param table - Table to count from (optional if already set)
     * @param options - Count options
     */
    count(table?: TableDefinition<any>, options?: {
        where?: SQLExpression;
    }): Promise<number>;
    /**
     * Check if any records exist
     * @param options - Existence check options
     */
    exists(options?: {
        where?: SQLExpression;
    }): Promise<boolean>;
    /**
     * Get paginated results with metadata
     * @param options - Pagination options
     */
    findManyWithMeta(options?: {
        limit?: number;
        offset?: number;
        includeTotal?: boolean;
    }): Promise<{
        data: TResult[];
        total?: number;
        hasMore?: boolean;
    }>;
    /**
     * Find records and return as a Map keyed by specified column
     * @param keyColumn - Column to use as key
     * @param options - Query options
     */
    findAsMap<K extends string | number>(keyColumn: ClickHouseColumn | SQLExpression, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Map<K, TResult>>;
    /**
     * Find records and return as a grouped object
     * @param groupColumn - Column to group by
     * @param options - Query options
     */
    findGrouped<G extends string | number>(groupColumn: ClickHouseColumn | SQLExpression, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Record<G, TResult[]>>;
}
