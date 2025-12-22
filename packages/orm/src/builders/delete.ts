import type { ClickHouseClient } from '@clickhouse/client';
import type { SQLExpression } from '../expressions';
import type { TableDefinition, TableColumns } from '../core';

export class ClickHouseDeleteBuilder<TTable extends TableDefinition<TableColumns>> {
    private _where: SQLExpression | null = null;
    private _lastMutationId: string | null = null;

    constructor(
        private client: ClickHouseClient,
        private table: TTable
    ) { }

    where(expression: SQLExpression) {
        this._where = expression;
        return this;
    }

    toSQL() {
        if (this.table.$options.appendOnly !== false) {
            throw new Error(`DELETE is blocked for append-only table ${this.table.$table}. Set appendOnly: false to allow.`);
        }

        if (!this._where) {
            throw new Error("❌ DELETE requires a WHERE clause in ClickHouse (safety first!)");
        }

        // ClickHouse ALTER TABLE DELETE doesn't like qualified column names in WHERE
        const { sql, params } = this._where.toSQL({ ignoreTablePrefix: true });
        const tableName = this.table.$table;
        return {
            query: `ALTER TABLE \`${tableName}\` DELETE WHERE ${sql}`,
            params
        };
    }

    async execute() {
        const { query, params } = this.toSQL();

        // ClickHouse mutations are async by default, but we can wait for them if configured.
        // For now, we just send the command.
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
