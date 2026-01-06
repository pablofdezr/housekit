import type { ClickHouseClient } from '@clickhouse/client';
import type { TableRuntime } from '../core';

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

    constructor(private client: ClickHouseClient) { }

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

        try {
            // Use JSONEachRow format - well supported by the official client
            const { Readable } = await import('stream');
            const stream = Readable.from(dataToInsert, { objectMode: true });

            await this.client.insert({
                table: tableName,
                values: stream,
                format: 'JSONEachRow',
                clickhouse_settings: {
                    async_insert: 1,
                    wait_for_async_insert: 0,
                }
            });
        } catch (err) {
            // Background flush failed. In a production app, you might want to 
            // retry or log this to a monitoring service.
            console.error(`[housekit] Background flush failed for ${tableName}:`, err);
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
