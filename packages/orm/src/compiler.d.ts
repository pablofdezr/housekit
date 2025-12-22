import type { QueryBuilderState } from './builders/select.types';
import { PreparedQuery } from './builders/prepared';
export declare class QueryCompiler {
    private paramCounter;
    reset(): void;
    private getNextParamName;
    /**
     * Compile with caching support.
     * Returns a PreparedQuery ready for execution and the values to bind.
     */
    compileWithCache(state: QueryBuilderState, client: any): {
        cachedQuery: PreparedQuery<any>;
        values: any[];
    };
    /**
     * Legacy/Internal method for getting SQL + Params directly (used by toSQL)
     */
    compileSelect(state: QueryBuilderState): {
        sql: string;
        params: Record<string, unknown>;
        suggestions: string[];
    };
    private generateFingerprint;
    private performFullCompilation;
    private formatColumn;
    private resolveColumn;
}
