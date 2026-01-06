import type { ClickHouseClient } from '@clickhouse/client';
import { ClickHouseColumn, type TableDefinition, type TableOptions, type InferSelectModel } from '../core';
import { sql, type SQLExpression, eq } from '../expressions';
import { and } from '../modules/conditional';
import { QueryCompiler } from '../compiler';
import {
    type QueryBuilderState,
    type SelectionShape,
    type SelectResult,
    type ResultWithArrayJoin,
    type InferQueryResult
} from './select.types';
export type {
    QueryBuilderState,
    SelectionShape,
    SelectResult
} from './select.types';

export type InferQueryResultFromBuilder<TBuilder extends ClickHouseQueryBuilder<any, any, any>> =
    TBuilder extends ClickHouseQueryBuilder<any, any, infer TResult> ? TResult : never;

// ClickHouse-specific join types
// Standard SQL joins
type StandardJoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

// ClickHouse join strictness modifiers
// ANY: Returns first matching row (faster, may be non-deterministic)
// ALL: Returns all matching rows (default behavior, like standard SQL)
type JoinStrictness = 'ANY' | 'ALL';

// ClickHouse-specific join types
// ASOF: For time-series data, finds closest match by ordered column
// SEMI: Returns rows from left table that have matches in right (no duplicates)
// ANTI: Returns rows from left table that have NO matches in right
type SpecialJoinType = 'ASOF' | 'SEMI' | 'ANTI';

// Combined type for all supported join types
// Includes: INNER, LEFT, RIGHT, FULL, CROSS
//          ANY INNER, ANY LEFT, ALL INNER, ALL LEFT, etc.
//          GLOBAL INNER, GLOBAL LEFT, etc.
//          LEFT ASOF, LEFT SEMI, LEFT ANTI, etc.
type JoinType =
    | StandardJoinType
    | `${JoinStrictness} ${StandardJoinType}`
    | `GLOBAL ${StandardJoinType}`
    | `GLOBAL ${JoinStrictness} ${StandardJoinType}`
    | `LEFT ${SpecialJoinType}`
    | `INNER ${SpecialJoinType}`
    | `GLOBAL LEFT ${SpecialJoinType}`
    | `GLOBAL INNER ${SpecialJoinType}`;
type SubqueryTable = TableDefinition<
    Record<string, ClickHouseColumn>,
    TableOptions & { kind: 'subquery'; subquery: ClickHouseQueryBuilder<any, any, any> }
>;

export class ClickHouseQueryBuilder<
    TTable extends TableDefinition<any> | null = null,
    TSelection extends SelectionShape | null = null,
    TResult = InferQueryResult<TTable, TSelection>
> {
    private _select: SelectionShape | null = null;
    private _selectResolver: ((cols: any) => SelectionShape) | null = null;
    private _table: TableDefinition<any> | SubqueryTable | null = null;
    private _prewhere: SQLExpression | null = null;
    private _sample: { ratio: number; offset?: number } | null = null;
    private _settings: Record<string, string | number | boolean> | null = null;
    private _distinct: boolean = false;
    private _joins: Array<{ type: string; table: string; on: SQLExpression | null }> = [];
    private _arrayJoins: Array<{ column: ClickHouseColumn | SQLExpression; alias?: string }> = [];
    private _ctes: Array<{ name: string; query: ClickHouseQueryBuilder<any> }> = [];
    private _where: SQLExpression | null = null;
    private _limit: number | null = null;
    private _offset: number | null = null;
    private _orderBy: { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' }[] = [];
    private _groupBy: (ClickHouseColumn | SQLExpression)[] = [];
    private _having: SQLExpression | null = null;
    private _final: boolean = false;
    private _windows: Record<string, string> = {};
    private _suggestions: string[] = [];

    constructor(private client: ClickHouseClient) { }

    // 1. SELECT
    select<TNewSelection extends SelectionShape>(
        fields: TNewSelection
    ): ClickHouseQueryBuilder<TTable, TNewSelection, InferQueryResult<TTable, TNewSelection>>;
    select<TNewSelection extends SelectionShape>(
        fields: (cols: TTable extends TableDefinition<infer TCols> ? TCols : any) => TNewSelection
    ): ClickHouseQueryBuilder<TTable, TNewSelection, InferQueryResult<TTable, TNewSelection>>;
    select(): ClickHouseQueryBuilder<TTable, null, InferQueryResult<TTable, null>>;
    select<TNewSelection extends SelectionShape>(fields?: TNewSelection | ((cols: any) => TNewSelection)) {
        if (fields) {
            if (typeof fields === 'function') {
                if (!this._table) {
                    this._selectResolver = fields as any;
                    return this as any;
                }
                this._select = (fields as any)(this._table.$columns) as any;
                this._selectResolver = null;
                return this as any;
            }
            this._select = fields as any;
            this._selectResolver = null;
            return this as any;
        }
        return this as any;
    }

    // 2. FROM
    from<TNewTable extends TableDefinition<any>>(table: TNewTable): ClickHouseQueryBuilder<TNewTable, TSelection, InferQueryResult<TNewTable, TSelection>>;
    from<TSubQuery extends ClickHouseQueryBuilder<any, any, any>>(
        subquery: TSubQuery,
        alias?: string
    ): ClickHouseQueryBuilder<any, TSelection, any>;
    from(tableOrSubquery: TableDefinition<any> | ClickHouseQueryBuilder<any, any, any>, alias = 'subquery') {
        if (tableOrSubquery instanceof ClickHouseQueryBuilder) {
            return this.fromSubquery(tableOrSubquery as any, alias) as any;
        }
        this._table = tableOrSubquery;
        const defaultFinal = (tableOrSubquery as any).$options?.defaultFinal;
        if (defaultFinal !== undefined) {
            this._final = Boolean(defaultFinal);
        }
        this.resolveSelect();
        return this as any; // Cast to resolve deep type instantiation error for this path
    }

    private fromSubquery<TSubQuery extends ClickHouseQueryBuilder<any, any, any>>(subquery: TSubQuery, alias: string) {
        this._table = this.createSubqueryTable(alias, subquery);
        this._final = false; // FINAL does not apply to derived tables
        this.resolveSelect();
        return this as any; // Cast to resolve deep type instantiation error
    }

    private resolveSelect() {
        if (!this._selectResolver) return;
        if (!this._table) {
            throw new Error('Call .from() before using callback select');
        }
        this._select = this._selectResolver(this._table.$columns as any);
        this._selectResolver = null;
    }

    // 3. WHERE
    where(
        expression: SQLExpression | (TTable extends TableDefinition<infer TCols> ? Partial<InferSelectModel<{ $columns: TCols }>> : Record<string, any>) | undefined | null
    ) {
        if (!expression) return this;

        if (typeof expression === 'object' && 'toSQL' in expression) {
            this._where = expression as SQLExpression;
            return this;
        }

        if (typeof expression === 'object') {
            const table: any = this._table;
            if (!table) return this;

            const chunks: SQLExpression[] = [];
            const columns = table.$columns || table;

            for (const [key, value] of Object.entries(expression as Record<string, any>)) {
                const column = table[key] || columns?.[key];
                if (column && value !== undefined) {
                    chunks.push(eq(column, value));
                }
            }

            if (chunks.length > 0) {
                const combined = chunks.length === 1 ? chunks[0] : and(...chunks);
                if (combined) this._where = combined;
            }
        }
        return this;
    }

    // 4. ORDER BY
    orderBy(col: ClickHouseColumn | SQLExpression | { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' }, dir: 'ASC' | 'DESC' = 'ASC') {
        if (col && typeof col === 'object' && 'col' in col && 'dir' in col) {
            this._orderBy.push(col as { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' });
        } else {
            this._orderBy.push({ col: col as ClickHouseColumn | SQLExpression, dir });
        }

        if (this._table && (col as any) instanceof ClickHouseColumn) {
            const opts: any = (this._table as any).$options;
            const orderByOpts = opts?.orderBy;
            if (orderByOpts) {
                const target = (Array.isArray(orderByOpts) ? orderByOpts : [orderByOpts]).map((c: any) => c.toString().trim());
                if (!target.includes((col as ClickHouseColumn).name)) {
                    this._suggestions.push(`Ordering by ${(col as ClickHouseColumn).name} not in physical ORDER BY; may be inefficient.`);
                }
            }
        }
        return this;
    }

    // 5. GROUP BY
    groupBy(...cols: (ClickHouseColumn | SQLExpression)[]) {
        this._groupBy = cols;
        return this;
    }

    // 6. HAVING
    having(expression: SQLExpression) {
        this._having = expression;
        return this;
    }

    // 7. LIMIT / OFFSET
    limit(val: number) {
        this._limit = val;
        return this;
    }

    offset(val: number) {
        this._offset = val;
        return this;
    }

    // 8. DISTINCT
    distinct() {
        this._distinct = true;
        return this;
    }

    // 9. JOINS
    innerJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'INNER', table: table.$table, on });
        return this;
    }

    leftJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'LEFT', table: table.$table, on });
        return this;
    }

    rightJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'RIGHT', table: table.$table, on });
        return this;
    }

    fullJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'FULL', table: table.$table, on });
        return this;
    }

    /**
     * CROSS JOIN - Cartesian product of two tables
     * Use with caution on large tables!
     */
    crossJoin(table: { $table: string }) {
        this._joins.push({ type: 'CROSS', table: table.$table, on: null as any });
        return this;
    }

    // =========================================================================
    // ClickHouse-Specific Join Modifiers
    // =========================================================================

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
    globalJoin(type: StandardJoinType, table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: `GLOBAL ${type}` as JoinType, table: table.$table, on });
        return this;
    }

    /**
     * Global INNER JOIN shorthand
     */
    globalInnerJoin(table: { $table: string }, on: SQLExpression) {
        return this.globalJoin('INNER', table, on);
    }

    /**
     * Global LEFT JOIN shorthand
     */
    globalLeftJoin(table: { $table: string }, on: SQLExpression) {
        return this.globalJoin('LEFT', table, on);
    }

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
    anyJoin(type: StandardJoinType, table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: `ANY ${type}` as JoinType, table: table.$table, on });
        return this;
    }

    /**
     * ANY INNER JOIN shorthand
     */
    anyInnerJoin(table: { $table: string }, on: SQLExpression) {
        return this.anyJoin('INNER', table, on);
    }

    /**
     * ANY LEFT JOIN shorthand
     */
    anyLeftJoin(table: { $table: string }, on: SQLExpression) {
        return this.anyJoin('LEFT', table, on);
    }

    /**
     * ALL JOIN - Returns all matching rows (default SQL behavior).
     * Explicitly stating ALL can be useful for clarity.
     */
    allJoin(type: StandardJoinType, table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: `ALL ${type}` as JoinType, table: table.$table, on });
        return this;
    }

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
    asofJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'LEFT ASOF' as JoinType, table: table.$table, on });
        return this;
    }

    /**
     * ASOF INNER JOIN - Same as ASOF but only returns matching rows
     */
    asofInnerJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'INNER ASOF' as JoinType, table: table.$table, on });
        return this;
    }

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
    semiJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'LEFT SEMI' as JoinType, table: table.$table, on });
        return this;
    }

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
    antiJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'LEFT ANTI' as JoinType, table: table.$table, on });
        return this;
    }

    /**
     * GLOBAL ASOF JOIN - For time-series joins across distributed clusters
     */
    globalAsofJoin(table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: 'GLOBAL LEFT ASOF' as JoinType, table: table.$table, on });
        return this;
    }

    /**
     * GLOBAL ANY JOIN - Combines GLOBAL (for clusters) with ANY (for performance)
     */
    globalAnyJoin(type: StandardJoinType, table: { $table: string }, on: SQLExpression) {
        this._joins.push({ type: `GLOBAL ANY ${type}` as JoinType, table: table.$table, on });
        return this;
    }

    // 9.1. ARRAY JOIN (Tipado Fuerte)
    arrayJoin<TCol extends ClickHouseColumn, TColName extends keyof TResult>(
        column: TCol & { name: TColName },
        ...additionalColumns: (ClickHouseColumn | SQLExpression)[]
    ): ClickHouseQueryBuilder<
        TTable,
        TSelection,
        ResultWithArrayJoin<TResult, TColName>
    > {
        this._arrayJoins.push({ column });
        for (const col of additionalColumns) {
            this._arrayJoins.push({ column: col });
        }
        return this as any;
    }

    // Para múltiples columnas con tipado
    arrayJoinMultiple<TColumns extends (ClickHouseColumn | SQLExpression)[]>(
        ...columns: TColumns
    ): ClickHouseQueryBuilder<
        TTable,
        TSelection,
        TResult
    > {
        for (const col of columns) {
            this._arrayJoins.push({ column: col });
        }
        return this as any;
    }

    arrayJoinAs(column: ClickHouseColumn | SQLExpression, alias: string): ClickHouseQueryBuilder<TTable, TSelection, any> {
        this._arrayJoins.push({ column, alias });
        return this as any;
    }

    // 10. WITH (Common Table Expressions)
    with(name: string, query: ClickHouseQueryBuilder<any>) {
        this._ctes.push({ name, query });
        return this;
    }

    // 11. PREWHERE (ClickHouse optimization)
    prewhere(expression: SQLExpression) {
        this._prewhere = expression;
        return this;
    }

    // 12. SAMPLE
    sample(ratio: number, offset?: number) {
        this._sample = { ratio, offset };
        return this;
    }

    /**
     * Define a typed CTE and get a virtual table for use in FROM/JOIN with autocomplete.
     * Also registers the CTE on this builder; use register() to attach to another builder if needed.
     */
    $with<
        TAlias extends string,
        TSelection extends SelectionShape | null
    >(
        alias: TAlias,
        queryBuilder: ClickHouseQueryBuilder<any, TSelection>
    ) {
        type SelectionResult<TSel extends SelectionShape | null> = TSel extends SelectionShape ? SelectResult<TSel> : Record<string, any>;
        type CteColumns<TSel extends SelectionShape | null> = TSel extends SelectionShape
            ? { [K in keyof SelectionResult<TSel>]: ClickHouseColumn<SelectionResult<TSel>[K]> }
            : Record<string, ClickHouseColumn<any>>;
        type CurrentCteCols = CteColumns<TSelection>;

        const virtualColumns: Record<string, ClickHouseColumn<any>> = {};
        const selection = (queryBuilder as any)._select as SelectionShape | null;
        const sourceTable = (queryBuilder as any)._table as TableDefinition<any> | null;

        if (selection && Object.keys(selection).length > 0) {
            for (const key of Object.keys(selection)) {
                const val = selection[key];
                if (val instanceof ClickHouseColumn) {
                    const col = new ClickHouseColumn<any>(key, val.type, val.isNull, val.meta);
                    col.tableName = alias;
                    virtualColumns[key] = col;
                } else {
                    const col = new ClickHouseColumn<any>(key, 'String');
                    col.tableName = alias;
                    virtualColumns[key] = col;
                }
            }
        } else if (sourceTable) {
            for (const [key, col] of Object.entries(sourceTable.$columns)) {
                const column = col as ClickHouseColumn<any>;
                const clone = new ClickHouseColumn<any>(column.name, column.type, column.isNull, column.meta);
                clone.tableName = alias;
                virtualColumns[key] = clone;
            }
        }

        const cteOptions: TableOptions & { kind: 'cte'; query?: string } = { kind: 'cte' };
        const cteTable = {
            $table: alias,
            $columns: virtualColumns as CurrentCteCols,
            $options: cteOptions,
            toSQL: () => ''
        } as unknown as TableDefinition<CurrentCteCols, TableOptions & { kind: 'cte'; query?: string }> & CurrentCteCols;

        Object.assign(cteTable, virtualColumns);

        // Register on this builder
        this.with(alias, queryBuilder as any);

        const register = (mainQuery: ClickHouseQueryBuilder<any, any, any>) => {
            mainQuery.with(alias, queryBuilder as any);
            return mainQuery;
        };

        return { cteTable, register };
    }

    // 14. FINAL
    final() {
        this._final = true;
        return this;
    }

    // 15. WINDOW clause
    window(name: string, definition: string) {
        this._windows[name] = definition;
        return this;
    }

    // 13. SETTINGS
    settings(settings: Record<string, string | number | boolean>) {
        this._settings = settings;
        return this;
    }

    private createSubqueryTable(alias: string, subquery: ClickHouseQueryBuilder<any, any, any>): SubqueryTable {
        const buildVirtualColumns = (aliasName: string) => {
            const virtualColumns: Record<string, ClickHouseColumn<any>> = {};
            const subState = subquery.getState();
            const selection = subState.select;
            const sourceTable = subState.table;

            if (selection && Object.keys(selection).length > 0) {
                for (const [key, val] of Object.entries(selection)) {
                    if (val instanceof ClickHouseColumn) {
                        const col = new ClickHouseColumn<any>(key, val.type, val.isNull, val.meta);
                        col.tableName = aliasName;
                        virtualColumns[key] = col;
                    } else {
                        const col = new ClickHouseColumn<any>(key, 'String');
                        col.tableName = aliasName;
                        virtualColumns[key] = col;
                    }
                }
            } else if (sourceTable) {
                for (const [key, col] of Object.entries(sourceTable.$columns)) {
                    const column = col as ClickHouseColumn<any>;
                    const clone = new ClickHouseColumn<any>(key, column.type, column.isNull, column.meta);
                    clone.tableName = aliasName;
                    virtualColumns[key] = clone;
                }
            }

            return virtualColumns;
        };

        const buildTable = (aliasName: string): SubqueryTable => {
            const columns = buildVirtualColumns(aliasName);
            const table: any = {
                $table: aliasName,
                $columns: columns,
                $options: { kind: 'subquery', subquery },
                toSQL: () => '',
                as: (nextAlias: string) => buildTable(nextAlias)
            };
            Object.entries(columns).forEach(([key, col]) => { table[key] = col; });
            return table as SubqueryTable;
        };

        return buildTable(alias);
    }

    getState(): QueryBuilderState<ClickHouseQueryBuilder<any>> {
        this.resolveSelect();
        return {
            select: this._select,
            table: this._table,
            prewhere: this._prewhere,
            sample: this._sample,
            settings: this._settings,
            distinct: this._distinct,
            joins: this._joins,
            arrayJoins: this._arrayJoins,
            ctes: this._ctes,
            where: this._where,
            limit: this._limit,
            offset: this._offset,
            orderBy: this._orderBy,
            groupBy: this._groupBy,
            having: this._having,
            final: this._final,
            windows: this._windows,
            suggestions: this._suggestions
        };
    }

    // --- SQL Generation ---
    toSQL() {
        const compiler = new QueryCompiler();
        const { sql, params, suggestions } = compiler.compileSelect(this.getState());
        return { query: sql, params, suggestions };
    }

    // --- Execution (The "Thenable" magic) ---
    async then<TResult1 = TResult[], TResult2 = never>(
        onfulfilled?: ((value: TResult[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        const compiler = new QueryCompiler();

        try {
            // Automatic query optimization:
            // Use cached query structure if available (Auto-Prepare)
            const { cachedQuery, values } = compiler.compileWithCache(this.getState(), this.client);

            // Execute the pre-compiled query with current values
            const data = (await cachedQuery.execute(values)) as TResult[];

            // Note: suggestions are handled inside cachedQuery execution or ignored for performance in this path
            // If suggestions are critical, PreparedQuery can log them.

            if (onfulfilled) {
                return Promise.resolve(onfulfilled(data));
            }
            return Promise.resolve(data) as any;
        } catch (error) {
            if (onrejected) {
                return Promise.resolve(onrejected(error));
            }
            return Promise.reject(error);
        }
    }

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
    async *[Symbol.asyncIterator](): AsyncIterableIterator<TResult> {
        const compiler = new QueryCompiler();
        // Use Auto-Prepare cache for streaming too
        const { cachedQuery, values } = compiler.compileWithCache(this.getState(), this.client);

        // Map positional values to named parameters { p_1: val1, ... }
        // We match the logic of PreparedQuery
        const query_params: Record<string, any> = {};
        for (let i = 0; i < values.length; i++) {
            query_params[`p_${i + 1}`] = values[i];
        }

        const resultSet = await this.client.query({
            query: cachedQuery.sql,
            query_params,
            format: 'JSONEachRow',
        });

        const reader = resultSet.stream();
        let buffer = '';

        for await (const chunk of reader) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            // Keep the last part (potential incomplete line) in buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        yield JSON.parse(line) as TResult;
                    } catch (e) {
                        // Silently ignore or handle via custom error event if needed
                    }
                }
            }
        }

        if (buffer.trim()) {
            try {
                yield JSON.parse(buffer) as TResult;
            } catch (e) {
                // Silently ignore
            }
        }
    }

    /**
     * Explicit alias for streaming
     */
    stream() {
        return this[Symbol.asyncIterator]();
    }

    /**
     * Native binary mode for high-performance data retrieval.
     * 
     * @deprecated RowBinary streaming is not supported by @clickhouse/client 1.15+.
     * Use standard select() which uses optimized JSONEachRow format.
     */
    async native(): Promise<TResult[]> {
        // RowBinary is no longer supported for streaming in @clickhouse/client 1.15+
        // Fall back to standard JSON execution
        console.warn('[HouseKit] native() is deprecated. RowBinary streaming is not supported by @clickhouse/client 1.15+. Using JSONEachRow instead.');
        return this.then(data => data) as Promise<TResult[]>;
    }

    /**
     * Vector mode for columnar data retrieval.
     * 
     * @deprecated RowBinary streaming is not supported by @clickhouse/client 1.15+.
     * Use standard select() which uses optimized JSONEachRow format.
     */
    async vector(): Promise<{ [K in keyof TResult]: TResult[K] extends number ? (TResult[K] extends number ? Float64Array | Int32Array : Array<TResult[K]>) : Array<TResult[K]> }> {
        // RowBinary is no longer supported for streaming in @clickhouse/client 1.15+
        console.warn('[HouseKit] vector() is deprecated. RowBinary streaming is not supported by @clickhouse/client 1.15+. Using JSONEachRow instead.');
        const rows = await this.then(data => data);
        // Convert to columnar format from row data
        if (rows.length === 0) return {} as any;
        const result: Record<string, any[]> = {};
        const keys = Object.keys(rows[0] as any);
        for (const key of keys) {
            result[key] = rows.map((row: any) => row[key]);
        }
        return result as any;
    }

    async explain(): Promise<any> {
        const { query, params } = this.toSQL();
        const resultSet = await this.client.query({
            query: `EXPLAIN ${query}`,
            query_params: params
        });
        return resultSet.json();
    }

    async explainPipeline(): Promise<any> {
        const { query, params } = this.toSQL();
        const resultSet = await this.client.query({
            query: `EXPLAIN PIPELINE ${query}`,
            query_params: params
        });
        return resultSet.json();
    }

    // =============================================================================
    // HIGH-LEVEL HELPERS (Modern ORM API)
    // =============================================================================

    /**
     * Find first record (limit 1)
     * @returns First record or null if no records found
     */
    async findFirst(): Promise<TResult | null> {
        const result = await this.limit(1).then();
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Find unique record (limit 1, expects exactly one record)
     * @returns Record if found, null if no records found
     * @throws If multiple records found (shouldn't happen with limit 1)
     */
    async findUnique(): Promise<TResult | null> {
        const result = await this.limit(1).then();
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Find many records with pagination
     * @param options - Pagination options
     */
    async findMany(options?: { limit?: number; offset?: number }): Promise<TResult[]> {
        let query = this;
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.offset(options.offset);
        }
        return query.then();
    }

    /**
     * Find many records with cursor-based pagination
     * @param options - Cursor pagination options
     */
    async findManyCursor(options?: {
        limit?: number;
        cursor?: { column: ClickHouseColumn | SQLExpression; value: any; direction?: 'ASC' | 'DESC' };
    }): Promise<TResult[]> {
        let query = this;

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.cursor) {
            const { column, value, direction = 'ASC' } = options.cursor;
            const operator = direction === 'ASC' ? '>' : '<';
            query = query.where(sql`${column} ${operator} ${value}`);
            query = query.orderBy(column, direction);
        }

        return query.then();
    }

    /**
     * Count records with optional where clause
     * @param table - Table to count from (optional if already set)
     * @param options - Count options
     */
    async count(table?: TableDefinition<any>, options?: { where?: SQLExpression }): Promise<number> {
        let query: ClickHouseQueryBuilder<any, any, { count: number }>;

        if (table) {
            query = new ClickHouseQueryBuilder<any, any, { count: number }>(this.client)
                .from(table)
                .select({ count: sql`count(*)` }) as any;
        } else {
            // Use current query but replace select with count
            // Cast to avoid "Type instantiation is excessively deep" error
            // This is safe because count() returns a simple Promise<number>
            const countQuery = new ClickHouseQueryBuilder(this.client) as any;
            countQuery._table = this._table;
            countQuery._where = this._where;
            countQuery._joins = [...this._joins];
            countQuery._ctes = [...this._ctes];
            countQuery._prewhere = this._prewhere;
            countQuery._sample = this._sample;
            countQuery._distinct = this._distinct;
            countQuery._groupBy = [...this._groupBy];
            countQuery._having = this._having;
            countQuery._final = this._final;
            countQuery._windows = { ...this._windows };
            countQuery._settings = this._settings ? { ...this._settings } : null;
            countQuery._suggestions = [...this._suggestions];
            countQuery._select = { count: sql`count(*)` };
            query = countQuery;
        }

        if (options?.where) {
            query = query.where(options.where);
        }

        const result = await query.limit(1).then();
        return result[0]?.count || 0;
    }

    /**
     * Check if any records exist
     * @param options - Existence check options
     */
    async exists(options?: { where?: SQLExpression }): Promise<boolean> {
        let query = this.limit(1);
        if (options?.where) {
            query = query.where(options.where);
        }
        const result = await query.then();
        return result.length > 0;
    }

    /**
     * Get paginated results with metadata
     * @param options - Pagination options
     */
    async findManyWithMeta(options?: {
        limit?: number;
        offset?: number;
        includeTotal?: boolean;
    }): Promise<{ data: TResult[]; total?: number; hasMore?: boolean }> {
        const limit = options?.limit || 50;
        const offset = options?.offset || 0;

        let query = this.limit(limit + 1).offset(offset);
        const results = await query.then();

        const hasMore = results.length > limit;
        const data = hasMore ? results.slice(0, -1) : results;

        const result: { data: TResult[]; total?: number; hasMore?: boolean } = {
            data,
            hasMore
        };

        if (options?.includeTotal) {
            // Count total records (without limit/offset)
            const total = await this.count();
            result.total = total;
        }

        return result;
    }

    /**
     * Find records and return as a Map keyed by specified column
     * @param keyColumn - Column to use as key
     * @param options - Query options
     */
    async findAsMap<K extends string | number>(
        keyColumn: ClickHouseColumn | SQLExpression,
        options?: { limit?: number; offset?: number }
    ): Promise<Map<K, TResult>> {
        const results = await this.findMany(options);
        const map = new Map<K, TResult>();

        for (const record of results) {
            const key = (record as any)[keyColumn instanceof ClickHouseColumn ? keyColumn.name : 'key'];
            if (key !== undefined && key !== null) {
                map.set(key, record);
            }
        }

        return map;
    }

    /**
     * Find records and return as a grouped object
     * @param groupColumn - Column to group by
     * @param options - Query options
     */
    async findGrouped<G extends string | number>(
        groupColumn: ClickHouseColumn | SQLExpression,
        options?: { limit?: number; offset?: number }
    ): Promise<Record<G, TResult[]>> {
        const results = await this.findMany(options);
        const grouped: Record<string | number, TResult[]> = {};

        for (const record of results) {
            const key = (record as any)[groupColumn instanceof ClickHouseColumn ? groupColumn.name : 'group'];
            if (key !== undefined && key !== null) {
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(record);
            }
        }

        return grouped as Record<G, TResult[]>;
    }
}
