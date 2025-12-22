import { Transform, type TransformCallback } from 'stream';
import { InsertPlan, processRowWithPlan } from './insert-processing';

export interface BatchTransformOptions {
    batchSize?: number;
    maxProcessingTime?: number; // ms
}

export class BatchTransformStream extends Transform {
    private batch: any[] = [];
    private processingTimer: NodeJS.Timeout | null = null;
    private readonly batchSize: number;
    private readonly maxProcessingTime: number;

    constructor(
        private plan: InsertPlan,
        private mode: 'compact' | 'json',
        options: BatchTransformOptions = {}
    ) {
        super({ objectMode: true });
        this.batchSize = options.batchSize || 100;
        this.maxProcessingTime = options.maxProcessingTime || 10; // 10ms max processing time
    }

    _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void {
        this.batch.push(chunk);

        if (this.batch.length >= this.batchSize) {
            this.processBatch(callback);
        } else {
            this.scheduleProcessing(callback);
        }
    }

    _flush(callback: TransformCallback): void {
        if (this.batch.length > 0) {
            this.processBatch(callback);
        } else {
            callback();
        }
    }

    private scheduleProcessing(callback: TransformCallback): void {
        if (this.processingTimer) {
            return;
        }

        this.processingTimer = setTimeout(() => {
            if (this.batch.length > 0) {
                this.processBatch(callback);
            } else {
                callback();
            }
        }, this.maxProcessingTime);
    }

    private processBatch(callback: TransformCallback): void {
        if (this.processingTimer) {
            clearTimeout(this.processingTimer);
            this.processingTimer = null;
        }

        const batchToProcess = this.batch;
        this.batch = [];

        // Procesar el lote de forma asíncrona para no bloquear el Event Loop
        setImmediate(() => {
            try {
                for (const row of batchToProcess) {
                    const processed = processRowWithPlan(row, this.plan, this.mode);
                    this.push(processed);
                }
                callback();
            } catch (error) {
                callback(error as Error);
            }
        });
    }
}

export function createBatchTransformStream(
    plan: InsertPlan,
    mode: 'compact' | 'json',
    options?: BatchTransformOptions
): BatchTransformStream {
    return new BatchTransformStream(plan, mode, options);
}