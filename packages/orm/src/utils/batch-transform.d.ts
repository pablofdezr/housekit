import { Transform, type TransformCallback } from 'stream';
import { InsertPlan } from './insert-processing';
export interface BatchTransformOptions {
    batchSize?: number;
    maxProcessingTime?: number;
}
export declare class BatchTransformStream extends Transform {
    private plan;
    private mode;
    private batch;
    private processingTimer;
    private readonly batchSize;
    private readonly maxProcessingTime;
    constructor(plan: InsertPlan, mode: 'compact' | 'json', options?: BatchTransformOptions);
    _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void;
    _flush(callback: TransformCallback): void;
    private scheduleProcessing;
    private processBatch;
}
export declare function createBatchTransformStream(plan: InsertPlan, mode: 'compact' | 'json', options?: BatchTransformOptions): BatchTransformStream;
