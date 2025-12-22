import type { ClickHouseClient } from '@clickhouse/client';
import type { TableDefinition } from '../core';
export interface BatchConfig {
    maxRows: number;
    flushIntervalMs: number;
}
declare class BackgroundBatcher {
    private client;
    private queues;
    private timers;
    private tables;
    private serializers;
    constructor(client: ClickHouseClient);
    private getSerializer;
    add(table: TableDefinition<any>, row: any, config: BatchConfig): Promise<void>;
    flush(tableName: string): Promise<void>;
    flushAll(): Promise<void>;
}
export declare const globalBatcher: (client: ClickHouseClient) => BackgroundBatcher;
export {};
