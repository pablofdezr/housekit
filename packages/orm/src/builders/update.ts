import type { ClickHouseClient } from '@clickhouse/client';
import type { SQLExpression } from '../expressions';
import { ClickHouseColumn, type TableDefinition, type TableColumns } from '../core';

export class ClickHouseUpdateBuilder<TTable extends TableDefinition<TableColumns>> {
    private _set: Record<string, any> = {};
    private _where: SQLExpression | null = null;
    private _lastMutationId: string | null = null;

    constructor(
        private client: ClickHouseClient,
        private table: TTable
    ) { }

    set(values: Record<string, any>) {
        this._set = values;
        return this;
    }

    where(expression: SQLExpression) {
        this._where = expression;
        return this;
    }

    toSQL() {
        if (this.table.$options.appendOnly !== false) {
            throw new Error(`UPDATE is blocked for append-only table ${this.table.$table}. Set appendOnly: false to allow.`);
        }

        if (!this._where) {
            throw new Error("❌ UPDATE requires a WHERE clause in ClickHouse (safety first!)");
        }

        if (Object.keys(this._set).length === 0) {
            throw new Error("❌ UPDATE requires at least one field to set");
        }

        const params: Record<string, unknown> = {};

        // Build SET clause
        const setParts: string[] = [];
        let paramCounter = 0;
        for (const [key, value] of Object.entries(this._set)) {
            const col = this.table.$columns[key];
            if (!col) continue;

            // Handle JSON stringification
            let finalValue = value;
            if (col.meta?.isJson && typeof value === 'object' && value !== null) {
                finalValue = JSON.stringify(value);
            }

            const paramName = `p_${key}_${++paramCounter}`;
            params[paramName] = finalValue;
            setParts.push(`\`${key}\` = {${paramName}:String}`);
        }

        // Build WHERE clause
        // ClickHouse ALTER TABLE UPDATE doesn't like qualified column names in WHERE
        const whereRes = this._where.toSQL({ ignoreTablePrefix: true });
        Object.assign(params, whereRes.params);

        const tableName = this.table.$table;
        return {
            query: `ALTER TABLE \`${tableName}\` UPDATE ${setParts.join(', ')} WHERE ${whereRes.sql}`,
            params
        };
    }

    async execute() {
        const { query, params } = this.toSQL();

        await this.client.command({
            query,
            query_params: params,
        });

        this._lastMutationId = await fetchLatestMutationId(this.client, this.table.$table);
    }

    async wait(options?: { pollIntervalMs?: number; timeoutMs?: number }) {
        if (!this._lastMutationId) {
            await this.execute();
        }
        if (!this._lastMutationId) return;
        await waitForMutationCompletion(this.client, this.table.$table, this._lastMutationId, options);
    }

    // Thenable
    async then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        try {
            await this.execute();
            if (onfulfilled) {
                return Promise.resolve(onfulfilled());
            }
            return Promise.resolve() as any;
        } catch (error) {
            if (onrejected) {
                return Promise.resolve(onrejected(error));
            }
            return Promise.reject(error);
        }
    }
}

async function fetchLatestMutationId(client: ClickHouseClient, tableName: string): Promise<string | null> {
    const result = await client.query({
        query: `SELECT mutation_id FROM system.mutations WHERE database = currentDatabase() AND table = {table:String} ORDER BY create_time DESC LIMIT 1 FORMAT JSONEachRow`,
        query_params: { table: tableName }
    });
    const rows = await result.json() as unknown as Array<{ mutation_id?: string }>;
    return rows[0]?.mutation_id ?? null;
}

async function waitForMutationCompletion(
    client: ClickHouseClient,
    tableName: string,
    mutationId: string,
    options?: { pollIntervalMs?: number; timeoutMs?: number }
) {
    const pollInterval = options?.pollIntervalMs ?? 500;
    const timeout = options?.timeoutMs ?? 60_000;
    const start = Date.now();

    while (true) {
        const result = await client.query({
            query: `SELECT is_done, latest_failed_part, latest_fail_reason FROM system.mutations WHERE database = currentDatabase() AND table = {table:String} AND mutation_id = {mid:String} FORMAT JSONEachRow`,
            query_params: { table: tableName, mid: mutationId }
        });
        const rows = await result.json() as unknown as Array<{ is_done?: number; latest_failed_part?: string; latest_fail_reason?: string }>;
        const row = rows[0];
        if (!row) return;
        if (row.latest_fail_reason) {
            throw new Error(`Mutation ${mutationId} failed: ${row.latest_fail_reason}`);
        }
        if (row.is_done === 1) return;
        if (Date.now() - start > timeout) {
            throw new Error(`Mutation ${mutationId} not completed after ${timeout}ms`);
        }
        await new Promise(res => setTimeout(res, pollInterval));
    }
}
