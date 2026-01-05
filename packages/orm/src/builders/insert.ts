import type { ClickHouseClient } from '@clickhouse/client';
import { type TableRuntime, type CleanInsert, type CleanSelect } from '../core';
import { buildInsertPlan, processRowWithPlan, type InsertPlan } from '../utils/insert-processing';
import { createBatchTransformStream, type BatchTransformOptions } from '../utils/batch-transform';
import { SyncBinarySerializer } from '../utils/binary-worker-pool';
import { Readable } from 'stream';
import { type BatchConfig, globalBatcher } from '../utils/background-batcher';
import http from 'http';
import https from 'https';

// Lazy-load uuid only when needed (reduces startup time)
let uuidv4Fn: (() => string) | null = null;
let uuidv7Fn: (() => string) | null = null;
let uuidv1: (() => string) | null = null;
let uuidv6: (() => string) | null = null;

// Use native crypto.randomUUID when available (Node 19+, Bun, modern browsers)
const hasNativeUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

function getUUIDv4(): string {
    // Prefer native implementation (faster, no dependencies)
    if (hasNativeUUID) {
        return crypto.randomUUID();
    }
    if (uuidv4Fn) return uuidv4Fn();
    // Sync fallback - load uuid package
    const uuid = require('uuid');
    uuidv4Fn = uuid.v4;
    return uuidv4Fn!();
}

function getUUIDv7(): string {
    if (uuidv7Fn) return uuidv7Fn();
    // Sync fallback - load uuid package
    const uuid = require('uuid');
    uuidv7Fn = uuid.v7;
    return uuidv7Fn!();
}

// ============================================================================
// Types
// ============================================================================

type InsertFormat = 'auto' | 'binary' | 'json' | 'compact';

// ============================================================================
// Connection config for binary inserts
// ============================================================================

export interface BinaryInsertConfig {
    url: string;
    username: string;
    password: string;
    database: string;
    /** Skip validation for maximum performance */
    skipValidation?: boolean;
}

// ============================================================================
// Insert Builder
// ============================================================================

export class ClickHouseInsertBuilder<TTable extends TableRuntime<any, any>, TReturn = any> {
    private _values: Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>> | Readable | null = null;
    private _async: boolean = false;  // DEFAULT: sync insert for best performance with small/medium batches
    private _waitForAsync: boolean = true;
    private _batchOptions: BatchTransformOptions = {};
    private _format: InsertFormat = 'auto'; // DEFAULT: auto (prefers json)
    private _batchConfig: BatchConfig | null = null;
    private _forceJson: boolean = false;
    private _returning: boolean = false; // DEFAULT: off for binary performance
    private _isSingle: boolean = false;
    private _skipValidation: boolean = false;

    constructor(
        private client: ClickHouseClient,
        private table: TTable,
        private connectionConfig?: BinaryInsertConfig
    ) {
        // Auto-manage async_insert based on table options
        if (table.$options?.asyncInsert !== undefined) {
            this._async = table.$options.asyncInsert;
        }
        // Inherit skipValidation from connection config
        if (connectionConfig?.skipValidation) {
            this._skipValidation = true;
        }
    }

    /**
     * Skip enum validation for maximum performance.
     * Use in production when you trust your data source.
     */
    skipValidation(): this {
        this._skipValidation = true;
        return this;
    }

    values(value: CleanInsert<TTable> | Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>> | Readable): ClickHouseInsertBuilder<TTable, TReturn> {
        this._values = value as any;
        this._isSingle = !Array.isArray(value) && !isIterable(value) && !isAsyncIterable(value) && !((value as any) instanceof Readable);
        return this as any;
    }

    /** @template [T = CleanInsert<TTable>] */
    async insert(data: CleanInsert<TTable> | CleanInsert<TTable>[]): Promise<TReturn> {
        return this.values(data as any).execute();
    }

    /**
     * Return inserted data as an array.
     * Use when inserting multiple rows.
     */
    returning(): ClickHouseInsertBuilder<TTable, CleanSelect<TTable>[]> {
        this._returning = true;
        return this as any;
    }

    /**
     * Return the single inserted row directly (not wrapped in array).
     * Use when inserting a single value for cleaner syntax.
     * 
     * @example
     * const user = await db.insert(users).values({ email: 'a@b.com' }).returningOne();
     */
    returningOne(): ClickHouseInsertBuilder<TTable, CleanSelect<TTable>> {
        this._returning = true;
        this._isSingle = true;
        return this as any;
    }

    /**
     * Disable the default returning() behavior.
     * Useful when you don't need the inserted data back and want to avoid the overhead.
     */
    noReturning(): ClickHouseInsertBuilder<TTable, void> {
        this._returning = false;
        return this as any;
    }

    /** 
     * Force synchronous insert (disables async_insert).
     * This is already the default in HouseKit for best performance.
     */
    syncInsert() {
        this._async = false;
        return this;
    }

    /**
     * Enable asynchronous inserts on the server (not the default).
     * ClickHouse will batch multiple small inserts into a single disk operation.
     * 
     * Note: Sync insert is faster for most use cases. Use async only when
     * you need server-side batching for very high-frequency writes.
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
        this._batchOptions.batchSize = size;
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

        const plan = buildInsertPlan(this.table, { skipValidation: this._skipValidation });
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
     * Use JSON format explicitly (this is already the default).
     * 
     * @example
     * ```typescript
     * await db.insert(events)
     *   .values(rows)
     *   .useJsonFormat()
     *   .execute();
     * ```
     */
    useJsonFormat() {
        this._format = 'json';
        this._forceJson = true;
        return this;
    }

    /**
     * Use JSONCompactEachRow format (smaller payload than JSON).
     */
    useCompactFormat() {
        this._format = 'compact';
        return this;
    }

    /**
     * Force RowBinary format.
     * Uses direct HTTP request (bypasses official client).
     */
    useBinaryFormat() {
        this._format = 'binary';
        return this;
    }

    /**
     * Alias for useBinaryFormat().
     * @deprecated Binary format is not faster than JSON with the official client.
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

        const plan = buildInsertPlan(this.table, { skipValidation: this._skipValidation });

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

            if (this._isSingle && resultRows.length > 0) {
                return resultRows[0] as any;
            }
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
     * Resolve the actual format to use based on settings.
     * Default is JSON (most reliable and well-optimized by the official client).
     */
    private resolveFormat(plan: InsertPlan): 'binary' | 'json' | 'compact' {
        // If user explicitly chose, respect that
        if (this._format !== 'auto') {
            return this._format;
        }

        // Default to JSON - the official client has excellent optimizations
        // Use compact if the plan supports it (slightly smaller payload)
        return plan.useCompact ? 'compact' : 'json';
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
     * Uses direct HTTP request since the official client doesn't support RowBinary yet
     */
    private async executeBinaryInsert(plan: InsertPlan, tableName: string): Promise<void> {
        // Check if we have connection config for binary inserts
        if (!this.connectionConfig) {
            throw new Error('❌ Binary format requires connection configuration. This is an internal error - please report it.');
        }

        // Build column configuration for binary serializer
        const columns = plan.columns.map((col: any) => ({
            name: col.columnName,
            type: col.column.type,
            isNullable: col.column.isNull,
            propKey: col.propKey,
        }));

        // Create binary serializer
        const serializer = new SyncBinarySerializer(columns);

        // Collect all rows and serialize them
        const allRows: Record<string, any>[] = [];
        
        if (this._values instanceof Readable) {
            // For streams, we need to collect all data first
            for await (const chunk of this._values) {
                allRows.push(chunk);
            }
        } else {
            // Process rows (skip date transform for binary format)
            for await (const row of this.processRows(plan, true)) {
                allRows.push(row);
            }
        }

        if (allRows.length === 0) {
            return;
        }

        // Serialize all rows to binary
        const binaryData = serializer.serialize(allRows);

        const { url: baseUrl, username, password, database } = this.connectionConfig;

        // Build the query URL
        const url = new URL(baseUrl);
        const queryParams = new URLSearchParams({
            query: `INSERT INTO ${tableName} FORMAT RowBinary`,
            database: database,
        });
        
        if (this._async) {
            queryParams.set('async_insert', '1');
            queryParams.set('wait_for_async_insert', this._waitForAsync ? '1' : '0');
        }

        url.search = queryParams.toString();

        // Make HTTP request
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        // Build auth header
        const authHeader = Buffer.from(`${username}:${password}`).toString('base64');

        return new Promise((resolve, reject) => {
            const req = httpModule.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Authorization': `Basic ${authHeader}`,
                },
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`ClickHouse error (${res.statusCode}): ${body}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(binaryData);
            req.end();
        });
    }

    /**
     * Process rows and yield them with column names mapped and defaults applied
     */
    private async *processRows(plan: InsertPlan, skipDateTransform: boolean = false): AsyncGenerator<Record<string, any>> {
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
                        // Generate UUID using lazy-loaded functions
                        value = col.autoUUIDVersion === 7 ? getUUIDv7() : getUUIDv4();
                    } else if (col.hasDefault) {
                        value = col.defaultValue;
                    }
                }

                // Apply column transform (skip for binary format to preserve Date objects)
                if (value !== undefined && !skipDateTransform) {
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
        if (normalized === 'generateuuidv4()') return getUUIDv4();
        if (normalized === 'generateuuidv7()') return getUUIDv7();
        if (normalized === 'generateuuidv1()') return uuidv1?.() ?? getUUIDv4();
        if (normalized === 'generateuuidv6()') return uuidv6?.() ?? getUUIDv7();
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
