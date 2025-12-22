/**
 * HouseKit Binary Worker - Parallel RowBinary Serialization
 * 
 * This worker thread handles binary serialization off the main thread,
 * allowing the main thread to focus on I/O while serialization happens in parallel.
 * 
 * Benefits:
 * - Main thread stays responsive for network I/O
 * - Serialization uses separate CPU core
 * - Can saturate 10Gbps links without blocking Node.js event loop
 */

import { parentPort, workerData } from 'worker_threads';
import {
    BinaryWriter,
    type BinarySerializationConfig,
    createBinaryEncoder,
    type BinaryEncoder
} from './binary-serializer';

// ============================================================================
// Message Types
// ============================================================================

interface SerializeRowsMessage {
    type: 'serialize';
    rows: Array<Record<string, any>>;
    batchId: number;
}

interface ConfigureMessage {
    type: 'configure';
    columns: Array<{
        name: string;
        type: string;
        isNullable: boolean;
    }>;
}

interface ShutdownMessage {
    type: 'shutdown';
}

type WorkerMessage = SerializeRowsMessage | ConfigureMessage | ShutdownMessage;

interface SerializedResult {
    type: 'result';
    batchId: number;
    buffer: Buffer;
    rowCount: number;
}

interface ErrorResult {
    type: 'error';
    batchId?: number;
    error: string;
}

interface ReadyMessage {
    type: 'ready';
}

type WorkerResult = SerializedResult | ErrorResult | ReadyMessage;

// ============================================================================
// Worker State
// ============================================================================

let config: BinarySerializationConfig | null = null;
let writer: BinaryWriter | null = null;

// ============================================================================
// Serialization Logic
// ============================================================================

function serializeRows(rows: Array<Record<string, any>>, batchId: number): Buffer {
    if (!config || !writer) {
        throw new Error('Worker not configured');
    }

    writer.reset();

    for (const row of rows) {
        for (let i = 0; i < config.columns.length; i++) {
            const col = config.columns[i];
            const value = row[col.name];
            config.encoders[i](writer, value);
        }
    }

    return writer.toBuffer();
}

// ============================================================================
// Message Handler
// ============================================================================

function handleMessage(message: WorkerMessage): void {
    try {
        switch (message.type) {
            case 'configure': {
                // Build configuration with encoders
                const encoders: BinaryEncoder[] = message.columns.map(col =>
                    createBinaryEncoder(col.type, col.isNullable)
                );

                config = {
                    columns: message.columns,
                    keyMapping: new Map(),
                    encoders,
                };

                // Pre-allocate writer with reasonable initial size
                writer = new BinaryWriter(1024 * 1024); // 1MB initial

                parentPort?.postMessage({ type: 'ready' } as ReadyMessage);
                break;
            }

            case 'serialize': {
                const buffer = serializeRows(message.rows, message.batchId);

                // Create an isolated ArrayBuffer for transfer (avoids SharedArrayBuffer issues)
                const arrayBuffer = new ArrayBuffer(buffer.length);
                new Uint8Array(arrayBuffer).set(buffer);

                // Transfer buffer ownership to main thread (zero-copy)
                parentPort?.postMessage(
                    {
                        type: 'result',
                        batchId: message.batchId,
                        buffer: Buffer.from(arrayBuffer),
                        rowCount: message.rows.length,
                    } as SerializedResult,
                    [arrayBuffer]
                );
                break;
            }

            case 'shutdown': {
                process.exit(0);
            }
        }
    } catch (error) {
        parentPort?.postMessage({
            type: 'error',
            batchId: (message as any).batchId,
            error: error instanceof Error ? error.message : String(error),
        } as ErrorResult);
    }
}

// ============================================================================
// Worker Initialization
// ============================================================================

if (parentPort) {
    parentPort.on('message', handleMessage);

    // If initial config was passed via workerData
    if (workerData?.columns) {
        handleMessage({ type: 'configure', columns: workerData.columns });
    }
}
