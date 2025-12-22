import type { ClickHouseClient } from '@clickhouse/client';
import { type TableDefinition, type TableInsert, type TableColumns } from '../core';
import { type BatchTransformOptions } from '../utils/batch-transform';
import { Readable } from 'stream';
import { type BatchConfig } from '../utils/background-batcher';
/**
 * Insert format strategy:
 * - 'auto': Automatically choose best format (default - uses binary when possible)
 * - 'binary': Force RowBinary format (fastest)
 * - 'json': Force JSON format (for debugging/compatibility)
 * - 'compact': Force JSONCompactEachRow (smaller than JSON, faster than JSON)
 */
type InsertFormat = 'auto' | 'binary' | 'json' | 'compact';
export interface InsertOptions {
    /**
     * Format strategy for serialization.
     * Default: 'auto' (uses RowBinary when possible, falls back to JSON)
     */
    format?: InsertFormat;
    /** Rows per batch when streaming */
    batchSize?: number;
}
export declare class ClickHouseInsertBuilder<TTable extends TableDefinition<TableColumns>> {
    private client;
    private table;
    private _values;
    private _async;
    private _waitForAsync;
    private _batchOptions;
    private _format;
    private _batchSize;
    private _batchConfig;
    private _forceJson;
    constructor(client: ClickHouseClient, table: TTable);
    values(value: TableInsert<TTable['$columns']> | Array<TableInsert<TTable['$columns']>> | Iterable<TableInsert<TTable['$columns']>> | AsyncIterable<TableInsert<TTable['$columns']>> | Readable): this;
    /**
     * Force synchronous insert (disables async_insert).
     * Use when you need immediate durability guarantee.
     *
     * Note: By default, HouseKit uses async_insert for better performance.
     * The data is still durable, but ClickHouse batches writes internally.
     */
    syncInsert(): this;
    /**
     * Enables asynchronous inserts on the server.
     * ClickHouse will batch multiple small inserts into a single disk operation.
     * Ideal for high-frequency logs or events.
     */
    asyncInsert(waitForCompletion?: boolean): this;
    /**
     * Activate Background Batching (Client-side buffering).
     *
     * Instead of sending request immediately, rows are buffered in memory
     * and sent when limit is reached or interval passes.
     *
     * @param options Batch configuration
     */
    batch(options?: Partial<BatchConfig>): this;
    /** Configure batch processing options */
    batchOptions(options: BatchTransformOptions): this;
    /**
     * Set the batch size for streaming inserts.
     * Larger batches = better throughput, higher memory usage.
     * Default: 1000
     */
    batchSize(size: number): this;
    /**
     * Force JSON format (useful for debugging or compatibility).
     *
     * Note: HouseKit uses RowBinary by default for maximum performance.
     * Only use this when you need human-readable output or debugging.
     *
     * @example
     * ```typescript
     * await db.insert(events)
     *   .values(rows)
     *   .useJsonFormat() // For debugging
     *   .execute();
     * ```
     */
    useJsonFormat(): this;
    /**
     * Force JSONCompactEachRow format (smaller than JSON, but slower than binary).
     */
    useCompactFormat(): this;
    /**
     * Force RowBinary format (this is already the default via 'auto').
     * Explicit call for documentation purposes.
     */
    useBinaryFormat(): this;
    /**
     * Activates "Turbo Mode" (RowBinary).
     * Sends data in native binary format, skipping JSON parsing on the server.
     * Up to 5x faster than normal insertion.
     */
    turbo(): this;
    execute(): Promise<void>;
    /**
     * Resolve the actual format to use based on settings and table capabilities.
     *
     * Binary is preferred when:
     * - No columns require server-side UUID generation
     * - All column types are supported by our binary encoder
     *
     * Falls back to JSON when:
     * - Columns use server-side defaults (e.g., generateUUIDv4())
     * - Unsupported types are detected
     */
    private resolveFormat;
    /**
     * Check if table and data are compatible with binary format
     */
    private canUseBinaryFormat;
    /**
     * Execute insert using JSON format
     */
    private executeJsonInsert;
    /**
     * Execute insert using RowBinary format (fastest)
     */
    private executeBinaryInsert;
    /**
     * Process rows and yield them with column names mapped and defaults applied
     */
    private processRows;
    then<TResult1 = void, TResult2 = never>(onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
}
export {};
