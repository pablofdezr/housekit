export interface HousekitLogger {
    logQuery(query: string, params: any, durationMs: number, stats?: {
        readRows: number;
        readBytes: number;
    }): void;
    logError(error: Error, query: string): void;
}
export declare function wrapClientWithLogger(client: any, logger?: HousekitLogger): any;
