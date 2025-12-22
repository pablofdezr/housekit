import { type TableDefinition } from './core';
import type { SQLExpression } from './expressions';
/**
 * Join strategy for relational queries
 */
export type JoinStrategy = 'auto' | 'standard' | 'global' | 'any' | 'global_any';
export type RelationalFindOptions<TTable = any> = {
    where?: SQLExpression | ((columns: TTable extends TableDefinition<infer TCols> ? TCols : any) => SQLExpression);
    limit?: number;
    offset?: number;
    with?: Record<string, boolean | RelationalFindOptions>;
    /**
     * Join strategy for related data.
     *
     * - 'auto': Automatically uses GLOBAL when table has onCluster option
     * - 'standard': Regular LEFT JOIN
     * - 'global': Force GLOBAL JOIN (for clusters)
     * - 'any': Use ANY JOIN (faster, single match)
     * - 'global_any': Combine GLOBAL and ANY
     *
     * @default 'auto'
     */
    joinStrategy?: JoinStrategy;
};
/**
 * Build a modern relational API with ClickHouse optimizations.
 *
 * Key improvements over standard ORMs:
 * - Automatic GLOBAL JOIN detection for distributed tables
 * - Join strategy selection for performance tuning
 * - Support for dictionary lookups as alternative to JOINs
 */
export declare function buildRelationalAPI(client: any, schema?: Record<string, TableDefinition<any>>): Record<string, any> | undefined;
