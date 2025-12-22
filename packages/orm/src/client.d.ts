import type { ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';
import { ClickHouseQueryBuilder } from './builders/select';
import { ClickHouseInsertBuilder } from './builders/insert';
import { ClickHouseDeleteBuilder } from './builders/delete';
import { ClickHouseUpdateBuilder } from './builders/update';
import { type TableDefinition, type TableColumns, type TableInsert } from './core';
import { type HousekitLogger } from './logger';
import { type RelationalFindOptions } from './relational';
export type HousekitClientConfig = ClickHouseClientConfigOptions & {
    schema?: Record<string, TableDefinition<any>>;
    logger?: HousekitLogger;
};
export type ClientConfigWithSchema = HousekitClientConfig;
export interface HousekitClient<TSchema extends Record<string, TableDefinition<any>> | undefined = any> {
    rawClient: ClickHouseClient;
    select: <T extends Record<string, any> | TableDefinition<any>>(fieldsOrTable?: T) => any;
    with: (name: string, query: ClickHouseQueryBuilder<any>) => ClickHouseQueryBuilder<any>;
    insert: <TCols extends TableColumns>(table: TableDefinition<TCols>) => ClickHouseInsertBuilder<any>;
    insertMany: <TCols extends TableColumns>(table: TableDefinition<TCols>, values: Array<TableInsert<TCols>> | Iterable<TableInsert<TCols>> | AsyncIterable<TableInsert<TCols>>, opts?: {
        maxBlockSize?: number;
        asyncInsertWait?: boolean;
    }) => Promise<void>;
    update: <TCols extends TableColumns>(table: TableDefinition<TCols>) => ClickHouseUpdateBuilder<any>;
    delete: <TCols extends TableColumns>(table: TableDefinition<TCols>) => ClickHouseDeleteBuilder<any>;
    command: (params: {
        query: string;
        query_params?: Record<string, unknown>;
        format?: string;
    }) => Promise<any>;
    raw: (query: string, params?: Record<string, unknown>) => Promise<any>;
    tableExists: (tableName: string) => Promise<boolean>;
    ensureTable: (table: {
        $table: string;
        toSQL: () => string;
    }) => Promise<void>;
    dropTable: (tableName: string, options?: {
        ifExists?: boolean;
    }) => Promise<void>;
    close: () => Promise<void>;
    schema: TSchema;
    _config: HousekitClientConfig;
    query: TSchema extends Record<string, TableDefinition<any>> ? {
        [K in keyof TSchema]: {
            findMany: (opts?: RelationalFindOptions) => Promise<any[]>;
            findFirst: (opts?: RelationalFindOptions) => Promise<any | null>;
        };
    } : undefined;
}
export declare function createHousekitClient<TSchema extends Record<string, TableDefinition<any>> | undefined = any>(config: HousekitClientConfig & {
    schema?: TSchema;
}): HousekitClient<TSchema>;
export declare const createClientFromConfigObject: typeof createHousekitClient;
