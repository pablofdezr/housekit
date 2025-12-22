/**
 * HouseKit Binary Worker Pool - High-Performance Parallel Serialization
 * 
 * Manages a pool of worker threads for parallel RowBinary serialization.
 * Automatically distributes work across available CPU cores.
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as os from 'os';
import { binaryWorkerCode } from './binary-worker-code';

// ============================================================================
// Types
// ============================================================================

interface WorkerMessage {
    type: string;
    batchId?: number;
    buffer?: Buffer;
    rowCount?: number;
    error?: string;
}

interface ColumnConfig {
    name: string;
    type: string;
    isNullable: boolean;
}

interface PendingBatch {
    batchId: number;
    resolve: (buffer: Buffer) => void;
    reject: (error: Error) => void;
}

interface WorkerInfo {
    worker: Worker;
    busy: boolean;
    configured: boolean;
    pendingBatches: Map<number, PendingBatch>;
}

export interface BinaryWorkerPoolOptions {
    /** Number of worker threads (default: CPU cores - 1) */
    poolSize?: number;
    /** Maximum rows per batch sent to a worker */
    batchSize?: number;
    /** Enable high-water mark backpressure */
    highWaterMark?: number;
}

// ============================================================================
// Worker Pool Implementation
// ============================================================================

export class BinaryWorkerPool extends EventEmitter {
    private workers: WorkerInfo[] = [];
    private columns: ColumnConfig[] = [];
    private batchIdCounter = 0;
    private queue: Array<{ rows: any[]; resolve: (buf: Buffer) => void; reject: (err: Error) => void }> = [];
    private isShutdown = false;
    private readonly options: Required<BinaryWorkerPoolOptions>;

    constructor(options: BinaryWorkerPoolOptions = {}) {
        super();
        this.options = {
            poolSize: options.poolSize ?? Math.max(1, os.cpus().length - 1),
            batchSize: options.batchSize ?? 10000,
            highWaterMark: options.highWaterMark ?? 100,
        };
    }

    /**
     * Initialize the worker pool with column configuration
     */
    async initialize(columns: ColumnConfig[]): Promise<void> {
        this.columns = columns;

        // Spawn worker threads
        await Promise.all(
            Array(this.options.poolSize).fill(0).map(() => this.spawnWorker())
        );
    }

    private async spawnWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Use embedded worker code to avoid file path issues in production
            const worker = new Worker(binaryWorkerCode, {
                eval: true,
                workerData: { columns: this.columns },
            });

            const workerInfo: WorkerInfo = {
                worker,
                busy: false,
                configured: false,
                pendingBatches: new Map(),
            };

            worker.on('message', (message: WorkerMessage) => {
                this.handleWorkerMessage(workerInfo, message);
                if (message.type === 'ready' && !workerInfo.configured) {
                    workerInfo.configured = true;
                    resolve();
                }
            });

            worker.on('error', (error) => {
                this.emit('error', error);
                // Reject all pending batches
                for (const [, pending] of workerInfo.pendingBatches) {
                    pending.reject(error);
                }
                workerInfo.pendingBatches.clear();

                // Remove worker and spawn replacement
                const index = this.workers.indexOf(workerInfo);
                if (index !== -1) {
                    this.workers.splice(index, 1);
                }
                if (!this.isShutdown) {
                    this.spawnWorker().catch(e => this.emit('error', e));
                }
            });

            worker.on('exit', (code) => {
                if (code !== 0 && !this.isShutdown) {
                    this.emit('error', new Error(`Worker exited with code ${code}`));
                }
            });

            this.workers.push(workerInfo);
        });
    }

    private handleWorkerMessage(workerInfo: WorkerInfo, message: WorkerMessage): void {
        switch (message.type) {
            case 'result': {
                const pending = workerInfo.pendingBatches.get(message.batchId!);
                if (pending) {
                    workerInfo.pendingBatches.delete(message.batchId!);
                    pending.resolve(message.buffer!);
                }
                workerInfo.busy = workerInfo.pendingBatches.size > 0;
                this.processQueue();
                break;
            }

            case 'error': {
                const pending = workerInfo.pendingBatches.get(message.batchId!);
                if (pending) {
                    workerInfo.pendingBatches.delete(message.batchId!);
                    pending.reject(new Error(message.error));
                }
                workerInfo.busy = workerInfo.pendingBatches.size > 0;
                this.processQueue();
                break;
            }

            case 'ready': {
                workerInfo.configured = true;
                this.processQueue();
                break;
            }
        }
    }

    /**
     * Serialize rows to binary format using worker pool
     */
    async serialize(rows: Array<Record<string, any>>): Promise<Buffer> {
        if (this.isShutdown) {
            throw new Error('Worker pool is shut down');
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ rows, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Serialize rows in batches, returning an async iterator of buffers
     */
    async *serializeStream(
        rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>
    ): AsyncGenerator<Buffer> {
        let batch: Record<string, any>[] = [];
        const batchSize = this.options.batchSize;

        for await (const row of rows) {
            batch.push(row);

            if (batch.length >= batchSize) {
                yield await this.serialize(batch);
                batch = [];
            }
        }

        // Flush remaining rows
        if (batch.length > 0) {
            yield await this.serialize(batch);
        }
    }

    private processQueue(): void {
        if (this.queue.length === 0) return;

        // Find available worker
        const available = this.workers.find(w => w.configured && !w.busy);
        if (!available) return;

        const { rows, resolve, reject } = this.queue.shift()!;
        const batchId = ++this.batchIdCounter;

        available.busy = true;
        available.pendingBatches.set(batchId, { batchId, resolve, reject });

        available.worker.postMessage({
            type: 'serialize',
            rows,
            batchId,
        });
    }

    /**
     * Get pool statistics
     */
    getStats(): { workers: number; busy: number; queueSize: number } {
        return {
            workers: this.workers.length,
            busy: this.workers.filter(w => w.busy).length,
            queueSize: this.queue.length,
        };
    }

    /**
     * Shutdown all workers
     */
    async shutdown(): Promise<void> {
        this.isShutdown = true;

        // Reject all queued items
        for (const item of this.queue) {
            item.reject(new Error('Worker pool shutting down'));
        }
        this.queue = [];

        // Terminate all workers
        await Promise.all(
            this.workers.map(w =>
                new Promise<void>(resolve => {
                    w.worker.on('exit', () => resolve());
                    w.worker.postMessage({ type: 'shutdown' });
                })
            )
        );

        this.workers = [];
    }
}

// ============================================================================
// Singleton Pool (for convenience)
// ============================================================================

let defaultPool: BinaryWorkerPool | null = null;

/**
 * Get or create the default worker pool
 */
export async function getDefaultBinaryPool(columns?: ColumnConfig[]): Promise<BinaryWorkerPool> {
    if (!defaultPool) {
        defaultPool = new BinaryWorkerPool();
        if (columns) {
            await defaultPool.initialize(columns);
        }
    }
    return defaultPool;
}

/**
 * Shutdown the default pool
 */
export async function shutdownDefaultBinaryPool(): Promise<void> {
    if (defaultPool) {
        await defaultPool.shutdown();
        defaultPool = null;
    }
}

// ============================================================================
// Fallback for environments without Worker support
// ============================================================================

import {
    BinaryWriter,
    createBinaryEncoder,
    type BinaryEncoder
} from './binary-serializer';

/**
 * Synchronous fallback serializer for environments without Worker support
 */
export class SyncBinarySerializer {
    private encoders: BinaryEncoder[] = [];
    private columns: ColumnConfig[] = [];
    private writer: BinaryWriter;

    constructor(columns: ColumnConfig[]) {
        this.columns = columns;
        this.encoders = columns.map(col => createBinaryEncoder(col.type, col.isNullable));
        this.writer = new BinaryWriter(1024 * 1024);
    }

    serialize(rows: Array<Record<string, any>>): Buffer {
        this.writer.reset();

        for (const row of rows) {
            for (let i = 0; i < this.columns.length; i++) {
                const col = this.columns[i];
                const value = row[col.name];
                this.encoders[i](this.writer, value);
            }
        }

        return this.writer.toBuffer();
    }

    async *serializeStream(
        rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>,
        batchSize: number = 10000
    ): AsyncGenerator<Buffer> {
        let batch: Record<string, any>[] = [];

        for await (const row of rows) {
            batch.push(row);

            if (batch.length >= batchSize) {
                yield this.serialize(batch);
                batch = [];
            }
        }

        if (batch.length > 0) {
            yield this.serialize(batch);
        }
    }
}
