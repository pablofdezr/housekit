export interface HousekitLogger {
    logQuery(query: string, params: any, durationMs: number, stats?: { readRows: number; readBytes: number }): void;
    logError(error: Error, query: string): void;
}

export function wrapClientWithLogger(client: any, logger?: HousekitLogger): any {
    if (!logger) return client;

    const extractStats = (summary: any) => {
        if (!summary) return undefined;
        const readRows = summary.read_rows ?? summary.rows_read ?? summary.rows ?? summary.result_rows ?? 0;
        const readBytes = summary.read_bytes ?? summary.bytes_read ?? summary.bytes ?? 0;
        return { readRows, readBytes };
    };

    const withTiming = async <T>(sql: string, params: any, fn: () => Promise<T>): Promise<T> => {
        const start = Date.now();
        try {
            const res: any = await fn();
            const duration = Date.now() - start;
            logger.logQuery(sql, params, duration, extractStats(res?.summary));
            return res;
        } catch (err) {
            logger.logError(err as Error, sql);
            throw err;
        }
    };

    const wrapped = {
        ...client,
        query: async (params: any) => {
            const sql = typeof params === 'string' ? params : params?.query || '';
            return withTiming(sql, params?.query_params, () => client.query(params));
        },
        insert: async (params: any) => {
            const sql = `INSERT INTO ${params?.table ?? ''}`;
            return withTiming(sql, params?.values, () => (client as any).insert(params));
        }
    };

    return wrapped;
}
