/**
 * HouseKit Binary Worker Pool - High-Performance Parallel Serialization
 *
 * Manages a pool of worker threads for parallel RowBinary serialization.
 * Automatically distributes work across available CPU cores.
 */
import { EventEmitter } from 'events';
interface ColumnConfig {
    name: string;
    type: string;
    isNullable: boolean;
}
export interface BinaryWorkerPoolOptions {
    /** Number of worker threads (default: CPU cores - 1) */
    poolSize?: number;
    /** Maximum rows per batch sent to a worker */
    batchSize?: number;
    /** Enable high-water mark backpressure */
    highWaterMark?: number;
}
export declare class BinaryWorkerPool extends EventEmitter {
    private workers;
    private columns;
    private batchIdCounter;
    private queue;
    private isShutdown;
    private readonly options;
    constructor(options?: BinaryWorkerPoolOptions);
    /**
     * Initialize the worker pool with column configuration
     */
    initialize(columns: ColumnConfig[]): Promise<void>;
    private spawnWorker;
    private handleWorkerMessage;
    /**
     * Serialize rows to binary format using worker pool
     */
    serialize(rows: Array<Record<string, any>>): Promise<Buffer>;
    /**
     * Serialize rows in batches, returning an async iterator of buffers
     */
    serializeStream(rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>): AsyncGenerator<Buffer>;
    private processQueue;
    /**
     * Get pool statistics
     */
    getStats(): {
        workers: number;
        busy: number;
        queueSize: number;
    };
    /**
     * Shutdown all workers
     */
    shutdown(): Promise<void>;
}
/**
 * Get or create the default worker pool
 */
export declare function getDefaultBinaryPool(columns?: ColumnConfig[]): Promise<BinaryWorkerPool>;
/**
 * Shutdown the default pool
 */
export declare function shutdownDefaultBinaryPool(): Promise<void>;
/**
 * Synchronous fallback serializer for environments without Worker support
 */
export declare class SyncBinarySerializer {
    private encoders;
    private columns;
    private writer;
    constructor(columns: ColumnConfig[]);
    serialize(rows: Array<Record<string, any>>): Buffer;
    serializeStream(rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>, batchSize?: number): AsyncGenerator<Buffer>;
}
export {};
