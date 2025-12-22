import { type TableDefinition, type TableColumns } from './core';
import { createClientFromConfigObject, type ClientConfigWithSchema } from './client';
export { ClickHouseColumn } from './column';
export { type TableDefinition, type TableColumns, type TableOptions, type IndexDefinition, type ProjectionDefinition, index, projection, deriveTable, renderSchema } from './table';
export { Engine, type EngineConfiguration } from './engines';
export * from './external';
export * from './expressions';
export * from './builders/select';
export * from './builders/select.types';
export * from './builders/insert';
export * from './builders/delete';
export * from './builders/update';
export * from './metadata';
export * from './compiler';
export * from './modules';
export * from './relational';
export * from './logger';
export * from './client';
export { t, defineTable, table, view, defineView, materializedView, defineMaterializedView, dictionary, defineDictionary, defineProjection, detectMaterializedViewDrift, extractMVQuery, createMigrationBridge, generateBlueGreenMigration, relations, type ColumnBuilder, type EnhancedTableOptions } from './schema-builder';
export { sql } from './expressions';
export { generateSelectSchema, generateInsertSchema } from './codegen/zod';
export { BinaryWriter, createBinaryEncoder, serializeRowBinary, serializeRowsBinary, buildBinaryConfig, type BinaryEncoder, type BinarySerializationConfig, } from './utils/binary-serializer';
export { SyncBinarySerializer, BinaryWorkerPool, type BinaryWorkerPoolOptions, } from './utils/binary-worker-pool';
/**
 * Load housekit.config.js/ts and create a client by name.
 */
export declare function createClientFromConfig(databaseName?: string): Promise<HousekitClient>;
export type HousekitClient = ReturnType<typeof createClientFromConfigObject>;
export declare function createClient(): Promise<HousekitClient>;
export declare function createClient(config: ClientConfigWithSchema): HousekitClient;
export declare function createClient(databaseName: string): Promise<HousekitClient>;
export declare function tableExists(client: HousekitClient, tableName: string): Promise<boolean>;
export declare function ensureTable<TCols extends TableColumns>(client: HousekitClient, table: TableDefinition<TCols>): Promise<void>;
export declare function dropTable(client: HousekitClient, tableName: string, options?: {
    ifExists?: boolean;
}): Promise<void>;
/**
 * Create multiple ClickHouse clients for multi-database setups
 * @example
 * const clients = createClients({
 *   analytics: { url: 'http://localhost:8123', database: 'analytics' },
 *   logs: { url: 'http://localhost:8123', database: 'logs' }
 * });
 *
 * await clients.analytics.select().from(events);
 * await clients.logs.insert(logTable).values({...});
 */
export declare function createClients<T extends Record<string, ClientConfigWithSchema>>(configs: T): Record<keyof T, HousekitClient>;
/**
 * Close all clients in a multi-database setup
 */
export declare function closeAllClients(clients: Record<string, HousekitClient>): Promise<void>;
import { defineTable, defineProjection, detectMaterializedViewDrift, extractMVQuery, createMigrationBridge, generateBlueGreenMigration, relations } from './schema-builder';
import { sql } from './expressions';
import { deriveTable } from './table';
import { generateSelectSchema, generateInsertSchema } from './codegen/zod';
/**
 * Optional default export for users who prefer this style.
 * Named exports are recommended for better tree-shaking.
 *
 * @example
 * ```typescript
 * // Named exports (recommended)
 * import { table, t, Engine } from '@housekit/orm';
 *
 * // Default export (alternative)
 * import housekit from '@housekit/orm';
 * const users = housekit.table('users', { ... });
 * ```
 */
declare const _default: {
    t: {
        int8: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        int16: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        integer: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        int32: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        int64: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        int128: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        int256: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint8: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint16: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint32: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint64: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint128: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        uint256: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        float32: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        float: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        float64: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        bfloat16: (name: string) => import("./column").ClickHouseColumn<number, true, false>;
        decimal: (name: string, precision?: number, scale?: number) => import("./column").ClickHouseColumn<number, true, false>;
        decimal32: (name: string, scale?: number) => import("./column").ClickHouseColumn<number, true, false>;
        decimal64: (name: string, scale?: number) => import("./column").ClickHouseColumn<number, true, false>;
        decimal128: (name: string, scale?: number) => import("./column").ClickHouseColumn<number, true, false>;
        decimal256: (name: string, scale?: number) => import("./column").ClickHouseColumn<number, true, false>;
        text: (name: string) => import("./column").ClickHouseColumn<string, true, false>;
        string: (name: string) => import("./column").ClickHouseColumn<string, true, false>;
        fixedString: (name: string, length: number) => import("./column").ClickHouseColumn<string, true, false>;
        varchar: (name: string, opts?: {
            length?: number;
        }) => import("./column").ClickHouseColumn<string, true, false>;
        date: (name: string) => import("./column").ClickHouseColumn<string | Date, true, false>;
        date32: (name: string) => import("./column").ClickHouseColumn<string | Date, true, false>;
        timestamp: (name: string, timezone?: string) => import("./column").ClickHouseColumn<string | Date, true, false>;
        datetime: (name: string, timezone?: string) => import("./column").ClickHouseColumn<string | Date, true, false>;
        datetime64: (name: string, precision?: number, timezone?: string) => import("./column").ClickHouseColumn<string | Date, true, false>;
        boolean: (name: string) => import("./column").ClickHouseColumn<boolean, true, false>;
        bool: (name: string) => import("./column").ClickHouseColumn<boolean, true, false>;
        uuid: (name: string) => import("./column").ClickHouseColumn<string, true, false>;
        ipv4: (name: string) => import("./column").ClickHouseColumn<string, true, false>;
        ipv6: (name: string) => import("./column").ClickHouseColumn<string, true, false>;
        array: <T>(col: import("./column").ClickHouseColumn<T>) => import("./column").ClickHouseColumn<T[], true, false>;
        tuple: (name: string, types: string[]) => import("./column").ClickHouseColumn<any, true, false>;
        map: (name: string, keyType?: string, valueType?: string) => import("./column").ClickHouseColumn<Record<string, any>, true, false>;
        nested: (name: string, fields: Record<string, string>) => import("./column").ClickHouseColumn<any, true, false>;
        json: <TSchema = Record<string, any>>(name: string) => import("./column").ClickHouseColumn<TSchema, false, false>;
        dynamic: (name: string, maxTypes?: number) => import("./column").ClickHouseColumn<any, true, false>;
        lowCardinality: <T, TNotNull extends boolean, TAutoGenerated extends boolean>(col: import("./column").ClickHouseColumn<T, TNotNull, TAutoGenerated>) => import("./column").ClickHouseColumn<T, TNotNull, TAutoGenerated>;
        aggregateFunction: (name: string, funcName: string, ...argTypes: string[]) => import("./column").ClickHouseColumn<any, true, false>;
        simpleAggregateFunction: (name: string, funcName: string, argType: string) => import("./column").ClickHouseColumn<any, true, false>;
        point: (name: string) => import("./column").ClickHouseColumn<[number, number], true, false>;
        ring: (name: string) => import("./column").ClickHouseColumn<[number, number][], true, false>;
        polygon: (name: string) => import("./column").ClickHouseColumn<[number, number][][], true, false>;
        multiPolygon: (name: string) => import("./column").ClickHouseColumn<[number, number][][][], true, false>;
        enum: (name: string, values: readonly string[]) => import("./column").ClickHouseColumn<string, false, false>;
    };
    table: typeof defineTable;
    defineTable: typeof defineTable;
    view: typeof import("./table").chView;
    defineView: typeof import("./table").chView;
    materializedView: typeof import("./materialized-views").chMaterializedView;
    defineMaterializedView: typeof import("./materialized-views").chMaterializedView;
    dictionary: typeof import("./dictionary").chDictionary;
    defineDictionary: typeof import("./dictionary").chDictionary;
    defineProjection: typeof defineProjection;
    relations: typeof relations;
    createClient: typeof createClient;
    createClients: typeof createClients;
    closeAllClients: typeof closeAllClients;
    Engine: {
        MergeTree: (options?: Omit<import("./engines").MergeTreeConfig, "type">) => import("./engines").MergeTreeConfig;
        ReplacingMergeTree: (versionColumn?: string, isDeletedColumn?: string, options?: Omit<import("./engines").ReplacingMergeTreeConfig, "type" | "versionColumn" | "isDeletedColumn">) => import("./engines").ReplacingMergeTreeConfig;
        SummingMergeTree: (columns?: string[], options?: Omit<import("./engines").SummingMergeTreeConfig, "type" | "columns">) => import("./engines").SummingMergeTreeConfig;
        AggregatingMergeTree: (options?: Omit<import("./engines").AggregatingMergeTreeConfig, "type">) => import("./engines").AggregatingMergeTreeConfig;
        CollapsingMergeTree: (signColumn: string, options?: Omit<import("./engines").CollapsingMergeTreeConfig, "type" | "signColumn">) => import("./engines").CollapsingMergeTreeConfig;
        VersionedCollapsingMergeTree: (signColumn: string, versionColumn: string, options?: Omit<import("./engines").VersionedCollapsingMergeTreeConfig, "type" | "signColumn" | "versionColumn">) => import("./engines").VersionedCollapsingMergeTreeConfig;
        GraphiteMergeTree: (configSection: string, options?: Omit<import("./engines").GraphiteMergeTreeConfig, "type" | "configSection">) => import("./engines").GraphiteMergeTreeConfig;
        ReplicatedMergeTree: (config?: Omit<import("./engines").ReplicatedMergeTreeConfig, "type">) => import("./engines").ReplicatedMergeTreeConfig;
        Buffer: <T extends TableColumns>(targetTable: TableDefinition<T>, opts: {
            minRows: number;
            maxRows: number;
            layers?: number;
            minTime?: number;
            maxTime?: number;
            minBytes?: number;
            maxBytes?: number;
        }) => import("./engines").BufferConfig;
        BufferExplicit: (config: Omit<import("./engines").BufferConfig, "type">) => import("./engines").BufferConfig;
        Distributed: (config: Omit<import("./engines").DistributedConfig, "type">) => import("./engines").DistributedConfig;
        Null: () => import("./engines").NullConfig;
        Log: () => import("./engines").LogConfig;
        TinyLog: () => import("./engines").TinyLogConfig;
        Memory: (config?: Omit<import("./engines").MemoryConfig, "type">) => import("./engines").MemoryConfig;
        Join: (strictness: import("./engines").JoinConfig["strictness"], joinType: import("./engines").JoinConfig["joinType"], keys: string[]) => import("./engines").JoinConfig;
        Dictionary: (dictionaryName: string) => import("./engines").DictionaryConfig;
        File: (format: string, compression?: import("./engines").FileConfig["compression"]) => import("./engines").FileConfig;
        URL: (url: string, format: string, compression?: import("./engines").URLConfig["compression"]) => import("./engines").URLConfig;
        S3: (config: Omit<import("./engines").S3Config, "type">) => import("./engines").S3Config;
        Kafka: (config: Omit<import("./engines").KafkaConfig, "type">) => import("./engines").KafkaConfig;
        PostgreSQL: (config: Omit<import("./engines").PostgreSQLConfig, "type">) => import("./engines").PostgreSQLConfig;
        MySQL: (config: Omit<import("./engines").MySQLConfig, "type">) => import("./engines").MySQLConfig;
    };
    sql: typeof sql;
    index: (name: string) => {
        on: (...cols: import("./column").ClickHouseColumn[]) => {
            type: (type: import("./table").IndexDefinition["type"], granularity?: number) => import("./table").IndexDefinition;
        };
    };
    projection: (name: string, query: string) => import("./table").ProjectionDefinition;
    deriveTable: typeof deriveTable;
    detectMaterializedViewDrift: typeof detectMaterializedViewDrift;
    extractMVQuery: typeof extractMVQuery;
    createMigrationBridge: typeof createMigrationBridge;
    generateBlueGreenMigration: typeof generateBlueGreenMigration;
    generateSelectSchema: typeof generateSelectSchema;
    generateInsertSchema: typeof generateInsertSchema;
};
export default _default;
