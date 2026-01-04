import type { ClickHouseClient } from '@clickhouse/client';
import type { TableRuntime } from '../core';
import { SyncBinarySerializer } from './binary-worker-pool';

export interface BatchConfig {
    maxRows: number;
    flushIntervalMs: number;
}

class BackgroundBatcher {
    // Map: "tableName" -> array of pending rows
    private queues = new Map<string, any[]>();
    // Map: "tableName" -> flush timer
    private timers = new Map<string, NodeJS.Timeout>();
    // Map: "tableName" -> TableRuntime (captured for context)
    private tables = new Map<string, TableRuntime<any, any>>();
    // Cache of serializers per table to avoid re-creation
    private serializers = new Map<string, SyncBinarySerializer>();

    constructor(private client: ClickHouseClient) { }

    private getSerializer(table: TableRuntime<any, any>): SyncBinarySerializer {
        const tableName = table.$table;
        if (!this.serializers.has(tableName)) {
            // Convert table schema to serializer config
            const config = Object.values(table.$columns).map((col: any) => ({
                name: col.name,
                type: col.type,
                isNullable: col.isNull
            }));
            this.serializers.set(tableName, new SyncBinarySerializer(config));
        }
        return this.serializers.get(tableName)!;
    }

    async add(table: TableRuntime<any, any>, row: any, config: BatchConfig) {
        const tableName = table.$table;

        if (!this.queues.has(tableName)) {
            this.queues.set(tableName, []);
            this.tables.set(tableName, table);
        }

        const queue = this.queues.get(tableName)!;
        queue.push(row);

        // Case A: Reached row limit -> Immediate Flush
        if (queue.length >= config.maxRows) {
            await this.flush(tableName);
            return;
        }

        // Case B: First element -> Start Timer
        if (queue.length === 1) {
            const timer = setTimeout(() => {
                this.flush(tableName);
            }, config.flushIntervalMs);
            // Unref timer so it doesn't block process exit
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
            this.timers.set(tableName, timer);
        }
    }

    async flush(tableName: string) {
        const queue = this.queues.get(tableName);
        const table = this.tables.get(tableName);

        if (!queue || queue.length === 0 || !table) return;

        // Atomic swap / Cleanup
        const timer = this.timers.get(tableName);
        if (timer) clearTimeout(timer);
        this.timers.delete(tableName);

        const dataToInsert = [...queue];
        this.queues.set(tableName, []);
        // We keep the table reference in this.tables for future adds/flushes

        try {
            // RowBinary serialization before sending
            const serializer = this.getSerializer(table);
            const binaryBuffer = serializer.serialize(dataToInsert);

            // Wrap buffer in a Readable stream (required by ClickHouse client)
            const { Readable } = await import('stream');
            const bufferStream = Readable.from([binaryBuffer]);

            await this.client.insert({
                table: tableName,
                values: bufferStream,
                format: 'RowBinary' as any,
                clickhouse_settings: {
                    async_insert: 1, // HouseKit enables this by default for throughput
                    wait_for_async_insert: 0,
                }
            });
        } catch (err) {
            // Background flush failed. In a production app, you might want to 
            // retry or log this to a monitoring service.
        }
    }

    // Flush all pending queues (e.g., on app shutdown)
    async flushAll() {
        const promises: Promise<void>[] = [];
        for (const tableName of this.queues.keys()) {
            promises.push(this.flush(tableName));
        }
        await Promise.all(promises);
    }
}

// Singleton map: Client -> Batcher
const batchers = new WeakMap<ClickHouseClient, BackgroundBatcher>();

export const globalBatcher = (client: ClickHouseClient) => {
    let batcher = batchers.get(client);
    if (!batcher) {
        batcher = new BackgroundBatcher(client);
        batchers.set(client, batcher);
    }
    return batcher;
};
