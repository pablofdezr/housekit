import type { ClickHouseClient } from '@clickhouse/client';
import { type TableRuntime, type CleanInsert, type CleanSelect } from '../core';
import { buildInsertPlan, processRowWithPlan, processRowsStream, type InsertPlan } from '../utils/insert-processing';
import { createBatchTransformStream, type BatchTransformOptions } from '../utils/batch-transform';
import { SyncBinarySerializer } from '../utils/binary-worker-pool';
import {
    BinaryWriter,
    createBinaryEncoder,
    type BinaryEncoder,
    type BinarySerializationConfig
} from '../utils/binary-serializer';
import { Readable, Transform } from 'stream';
import { type BatchConfig, globalBatcher } from '../utils/background-batcher';
import { v1 as uuidv1, v4 as uuidv4, v6 as uuidv6, v7 as uuidv7 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Binary Stream Transform
// ============================================================================

/**
 * Transform that converts objects to RowBinary format
 */
class BinaryTransform extends Transform {
    private serializer: SyncBinarySerializer;
    private batch: any[] = [];
    private batchSize: number;

    constructor(
        columns: Array<{ name: string; type: string; isNullable: boolean }>,
        batchSize: number = 1000
    ) {
        super({ objectMode: true, writableObjectMode: true, readableObjectMode: false });
        this.serializer = new SyncBinarySerializer(columns);
        this.batchSize = batchSize;
    }

    _transform(row: any, _encoding: string, callback: (error?: Error | null) => void): void {
        this.batch.push(row);

        if (this.batch.length >= this.batchSize) {
            try {
                const buffer = this.serializer.serialize(this.batch);
                this.push(buffer);
                this.batch = [];
            } catch (error) {
                callback(error as Error);
                return;
            }
        }

        callback();
    }

    _flush(callback: (error?: Error | null) => void): void {
        if (this.batch.length > 0) {
            try {
                const buffer = this.serializer.serialize(this.batch);
                this.push(buffer);
            } catch (error) {
                callback(error as Error);
                return;
            }
        }
        callback();
    }
}

// ============================================================================
// Insert Builder
// ============================================================================

export class ClickHouseInsertBuilder<TTable extends TableRuntime<any, any>, TReturn = void> {
    private _values: Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>> | Readable | null = null;
    private _async: boolean = true;  // DEFAULT: async_insert enabled for best performance
    private _waitForAsync: boolean = true;
    private _batchOptions: BatchTransformOptions = {};
    private _format: InsertFormat = 'auto'; // DEFAULT: auto (prefers binary)
    private _batchSize: number = 1000;
    private _batchConfig: BatchConfig | null = null;
    private _forceJson: boolean = false;
    private _returning: boolean = false;

    constructor(
        private client: ClickHouseClient,
        private table: TTable
    ) {
        // Auto-manage async_insert based on table options
        if (table.$options?.asyncInsert !== undefined) {
            this._async = table.$options.asyncInsert;
        } else if (table.$options?.appendOnly) {
            this._async = true;
        } else {
            // Default to sync for non-append-only tables to ensure durability
            this._async = false;
        }
    }

    values(value: CleanInsert<TTable> | Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>> | Readable) {
        this._values = value as any;
        return this;
    }

    /** @template [T = CleanInsert<TTable>] */
    async insert(data: CleanInsert<TTable> | CleanInsert<TTable>[]) {
        return this.values(data as any);
    }

    returning(): ClickHouseInsertBuilder<TTable, CleanSelect<TTable>[]> {
        this._returning = true;
        return this as any;
    }

    /** 
     * Force synchronous insert (disables async_insert).
     * Use when you need immediate durability guarantee.
     * 
     * Note: By default, HouseKit uses async_insert for better performance.
     * The data is still durable, but ClickHouse batches writes internally.
     */
    syncInsert() {
        this._async = false;
        return this;
    }

    /**
     * Enables asynchronous inserts on the server.
     * ClickHouse will batch multiple small inserts into a single disk operation.
     * Ideal for high-frequency logs or events.
     */
    asyncInsert(waitForCompletion = true) {
        this._async = true;
        this._waitForAsync = waitForCompletion;
        return this;
    }

    /**
     * Activate Background Batching (Client-side buffering).
     * 
     * Instead of sending request immediately, rows are buffered in memory
     * and sent when limit is reached or interval passes.
     * 
     * @param options Batch configuration
     */
    batch(options: Partial<BatchConfig> = {}) {
        this._batchConfig = {
            maxRows: options.maxRows ?? 10000,
            flushIntervalMs: options.flushIntervalMs ?? 5000,
        };
        return this;
    }

    /** Configure batch processing options */
    batchOptions(options: BatchTransformOptions) {
        this._batchOptions = options;
        return this;
    }

    /**
     * Set the batch size for streaming inserts.
     * Larger batches = better throughput, higher memory usage.
     * Default: 1000
     */
    batchSize(size: number) {
        this._batchSize = size;
        return this;
    }

    /**
     * Add a row to the background batcher.
     *
     * If batching is not yet configured, it will use default settings
     * (10,000 rows or 5 seconds).
     *
     * Note: This method is "fire-and-forget" and does not wait for
     * the database to acknowledge the insert.
     */
    async append(row: CleanInsert<TTable>) {
        if (!this._batchConfig) {
            this.batch();
        }

        const plan = buildInsertPlan(this.table);
        const batcher = globalBatcher(this.client);

        // We temporarily set _values to this single row to reuse processRows logic
        const oldValues = this._values;
        this._values = [row];

        try {
            const rowIterator = this.processRows(plan);
            for await (const processedRow of rowIterator) {
                batcher.add(this.table, processedRow, this._batchConfig!);
            }
        } finally {
            this._values = oldValues;
        }
    }

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
    useJsonFormat() {
        this._format = 'json';
        this._forceJson = true;
        return this;
    }

    /**
     * Force JSONCompactEachRow format (smaller than JSON, but slower than binary).
     */
    useCompactFormat() {
        this._format = 'compact';
        return this;
    }

    /**
     * Force RowBinary format (this is already the default via 'auto').
     * Explicit call for documentation purposes.
     */
    useBinaryFormat() {
        this._format = 'binary';
        return this;
    }

    /**
     * Activates "Turbo Mode" (RowBinary).
     * Sends data in native binary format, skipping JSON parsing on the server.
     * Up to 5x faster than normal insertion.
     */
    turbo() {
        return this.useBinaryFormat();
    }

    async execute(): Promise<TReturn> {
        if (!this._values) {
            throw new Error("❌ No values to insert");
        }
        if (Array.isArray(this._values) && this._values.length === 0) {
            throw new Error("❌ No values to insert");
        }

        const plan = buildInsertPlan(this.table);

        if (this._returning) {
            if (this._batchConfig) {
                throw new Error('❌ returning() cannot be used with background batching');
            }

            const { processedRows, resultRows } = await this.collectReturningRows(plan);
            const stream = Readable.from(processedRows, { objectMode: true });

            await this.client.insert({
                table: this.table.$table,
                values: stream,
                format: 'JSONEachRow',
                clickhouse_settings: {
                    async_insert: this._async ? 1 : 0,
                    wait_for_async_insert: this._waitForAsync ? 1 : 0,
                },
            });

            return resultRows as any;
        }

        // --- Background Batching Path ---
        if (this._batchConfig && !this._forceJson) {
            const batcher = globalBatcher(this.client);
            // Process rows to ensure they are mapped to columns and defaults applied
            // Note: This consumes the stream/iterator.
            const rowIterator = this.processRows(plan);

            for await (const row of rowIterator) {
                // Fire-and-forget to ensure zero-latency API response
                batcher.add(this.table, row, this._batchConfig);
            }
            return undefined as any; // Return immediately, background flush handles it
        }

        // --- Immediate Execution Path ---
        const tableName = this.table.$table;

        // Determine actual format to use
        const format = this.resolveFormat(plan);

        if (format === 'binary') {
            await this.executeBinaryInsert(plan, tableName);
        } else {
            await this.executeJsonInsert(plan, tableName, format);
        }

        return undefined as any;
    }

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
    private resolveFormat(plan: InsertPlan): 'binary' | 'json' | 'compact' {
        // If user explicitly chose, respect that
        if (this._format !== 'auto') {
            return this._format;
        }

        // Check if binary is safe to use
        const canUseBinary = this.canUseBinaryFormat(plan);

        return canUseBinary ? 'binary' : (plan.useCompact ? 'compact' : 'json');
    }

    /**
     * Check if table and data are compatible with binary format
     */
    private canUseBinaryFormat(plan: InsertPlan): boolean {
        for (const col of plan.columns) {
            // Server-side UUID generation requires JSON format
            if (col.useServerUUID) {
                return false;
            }

            // Check for unsupported types
            const type = col.column.type.toLowerCase();

            // These complex types might need special handling
            // For now, be conservative and use JSON for them
            if (
                type.includes('map(') ||       // Map types
                type.includes('tuple(') ||     // Tuple types  
                type.includes('nested(') ||    // Nested types
                type.includes('lowcardinality(') // LowCardinality needs special handling
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Execute insert using JSON format
     */
    private async executeJsonInsert(plan: InsertPlan, tableName: string, format: 'json' | 'compact'): Promise<void> {
        const mode = format === 'compact' ? 'compact' : 'json';
        let stream: Readable;

        if (this._values instanceof Readable) {
            stream = this._values;
        } else {
            const iterable = (Array.isArray(this._values) || isIterable(this._values) || isAsyncIterable(this._values))
                ? this._values as any
                : [this._values];

            const sourceStream = Readable.from(iterable, { objectMode: true });
            const batchTransform = createBatchTransformStream(plan, mode, this._batchOptions);
            stream = sourceStream.pipe(batchTransform);
        }

        await this.client.insert({
            table: tableName,
            values: stream,
            format: mode === 'compact' ? 'JSONCompactEachRow' : 'JSONEachRow',
            columns: mode === 'compact' && plan.columnNames.length > 0 ? plan.columnNames as any : undefined,
            clickhouse_settings: {
                async_insert: this._async ? 1 : 0,
                wait_for_async_insert: this._waitForAsync ? 1 : 0,
            },
        });
    }

    /**
     * Execute insert using RowBinary format (fastest)
     */
    private async executeBinaryInsert(plan: InsertPlan, tableName: string): Promise<void> {
        // Build column configuration for binary serializer
        const columns = plan.columns.map((col: any) => ({
            name: col.columnName,
            type: col.column.type,
            isNullable: col.column.isNull,
            propKey: col.propKey,
        }));

        // Create binary transform stream
        const binaryTransform = new BinaryTransform(columns, this._batchSize);

        let sourceStream: Readable;

        if (this._values instanceof Readable) {
            sourceStream = this._values;
        } else {
            // Convert values to processed rows
            const processedRows = this.processRows(plan);
            sourceStream = Readable.from(processedRows, { objectMode: true });
        }

        // Pipe through binary transform
        const binaryStream = sourceStream.pipe(binaryTransform);

        await this.client.insert({
            table: tableName,
            values: binaryStream,
            format: 'RowBinary' as any, // RowBinary is supported but not in the type definitions
            clickhouse_settings: {
                async_insert: this._async ? 1 : 0,
                wait_for_async_insert: this._waitForAsync ? 1 : 0,
            },
        });
    }

    /**
     * Process rows and yield them with column names mapped and defaults applied
     */
    private async *processRows(plan: InsertPlan): AsyncGenerator<Record<string, any>> {
        const values = this._values as any;
        const iterable = Array.isArray(values) ? values :
            isIterable(values) ? values :
                isAsyncIterable(values) ? values :
                    [values];

        for await (const row of iterable as any) {
            const processedRow: Record<string, any> = {};

            for (const col of plan.columns) {
                // Get value from row using propKey or columnName
                let value = row[col.propKey] !== undefined ? row[col.propKey] : row[col.columnName];

                // Apply defaults and transformations
                if (value === undefined) {
                    if (col.defaultFn) {
                        value = col.defaultFn(row);
                    } else if (col.autoUUIDVersion !== null && !col.useServerUUID) {
                        // Generate UUID using statically imported functions
                        value = col.autoUUIDVersion === 7 ? uuidv7() : uuidv4();
                    } else if (col.hasDefault) {
                        value = col.defaultValue;
                    }
                }

                // Apply column transform
                if (value !== undefined) {
                    value = col.transform(value);
                }

                processedRow[col.columnName] = value;
            }

            yield processedRow;
        }
    }

    private async collectReturningRows(
        plan: InsertPlan
    ): Promise<{ processedRows: Array<Record<string, any>>; resultRows: Array<CleanSelect<TTable>> }> {
        const processedRows: Array<Record<string, any>> = [];
        const resultRows: Array<CleanSelect<TTable>> = [];
        const values = this._values as any;
        const iterable = values instanceof Readable ? values :
            Array.isArray(values) ? values :
                isIterable(values) ? values :
                    isAsyncIterable(values) ? values :
                        [values];

        for await (const row of iterable as any) {
            const processed = processRowWithPlan(row as any, plan, 'json') as Record<string, any>;

            for (const col of plan.columns) {
                if (processed[col.columnName] !== undefined) continue;
                const expr = col.column.meta?.defaultExpr;
                if (!expr) continue;
                const resolved = this.resolveClientDefaultExpr(expr);
                if (resolved !== undefined) {
                    processed[col.columnName] = col.transform(resolved);
                }
            }

            this.assertReturningRow(row as any, processed, plan);
            processedRows.push(processed);

            const resultRow: Record<string, any> = {};
            for (const col of plan.columns) {
                const value = processed[col.columnName];
                resultRow[col.propKey] = value;
            }
            resultRows.push(resultRow as CleanSelect<TTable>);
        }

        return { processedRows, resultRows };
    }

    private assertReturningRow(rawRow: Record<string, any>, processed: Record<string, any>, plan: InsertPlan) {
        for (const col of plan.columns) {
            const hasValue = rawRow[col.propKey] !== undefined || rawRow[col.columnName] !== undefined;
            if (hasValue) continue;
            if (processed[col.columnName] !== undefined) {
                continue;
            }
            if (col.defaultFn || (col.autoUUIDVersion !== null && !col.useServerUUID) || col.hasDefault) {
                continue;
            }
            if (col.useServerUUID || col.column.meta?.defaultExpr) {
                throw new Error(`❌ returning() cannot infer column '${col.columnName}' because it uses a server-side default. Provide a value or remove the default expression.`);
            }
        }
    }

    private resolveClientDefaultExpr(expr: string) {
        const normalized = expr.replace(/\s+/g, '').toLowerCase();
        if (normalized === 'now()' || normalized === 'now64()' || normalized.startsWith('now64(')) {
            return new Date();
        }
        if (normalized === 'generateuuidv4()') return uuidv4();
        if (normalized === 'generateuuidv7()') return uuidv7();
        if (normalized === 'generateuuidv1()') return uuidv1();
        if (normalized === 'generateuuidv6()') return uuidv6();
        return undefined;
    }

    // Thenable implementation
    async then<TResult1 = TReturn, TResult2 = never>(
        onfulfilled?: ((value: TReturn) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        try {
            const result = await this.execute();
            if (onfulfilled) {
                return Promise.resolve(onfulfilled(result));
            }
            return Promise.resolve(result) as any;
        } catch (error) {
            if (onrejected) {
                return Promise.resolve(onrejected(error));
            }
            return Promise.reject(error);
        }
    }
}

function isIterable(obj: any): obj is Iterable<any> {
    return obj && typeof obj[Symbol.iterator] === 'function';
}

function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
    return obj && typeof obj[Symbol.asyncIterator] === 'function';
}
