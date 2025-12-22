import type { ClickHouseClient } from '@clickhouse/client';
import type { SQLExpression } from '../expressions';
import { type TableDefinition, type TableColumns } from '../core';
export declare class ClickHouseUpdateBuilder<TTable extends TableDefinition<TableColumns>> {
    private client;
    private table;
    private _set;
    private _where;
    private _lastMutationId;
    constructor(client: ClickHouseClient, table: TTable);
    set(values: Record<string, any>): this;
    where(expression: SQLExpression): this;
    toSQL(): {
        query: string;
        params: Record<string, unknown>;
    };
    execute(): Promise<void>;
    wait(options?: {
        pollIntervalMs?: number;
        timeoutMs?: number;
    }): Promise<void>;
    then<TResult1 = void, TResult2 = never>(onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
}
