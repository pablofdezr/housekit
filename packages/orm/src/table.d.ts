import { ClickHouseColumn } from './column';
import { TTLRule } from './data-types';
import { EngineConfiguration } from './engines';
import { type MetadataVersion } from './metadata';
export interface TableOptions {
    /**
     * ClickHouse table engine configuration.
     *
     * // Raw string (escape hatch)
     * customEngine: 'MergeTree()'
     * ```
     */
    engine?: EngineConfiguration;
    customEngine?: string;
    orderBy?: string | string[];
    partitionBy?: string | string[];
    primaryKey?: string | string[];
    logicalPrimaryKey?: string | string[];
    ttl?: TTLRule | TTLRule[] | string;
    appendOnly?: boolean;
    deduplicateBy?: string | string[];
    versionColumn?: string;
    externallyManaged?: boolean;
    sampleBy?: string | string[];
    onCluster?: string;
    shardKey?: string | string[];
    materializedView?: {
        name: string;
        toTable: string;
        query: string;
        populate?: boolean;
    };
    defaultFinal?: boolean;
    metadataVersion?: MetadataVersion;
    readOnly?: boolean;
    indices?: IndexDefinition[];
    projections?: ProjectionDefinition[];
    asyncInsert?: boolean;
}
export type IndexDefinition = {
    name: string;
    cols: ClickHouseColumn[];
    type: 'minmax' | 'set' | 'bloom_filter';
    granularity?: number;
};
export type ProjectionDefinition = {
    name: string;
    query: string;
};
export declare const index: (name: string) => {
    on: (...cols: ClickHouseColumn[]) => {
        type: (type: IndexDefinition["type"], granularity?: number) => IndexDefinition;
    };
};
export declare const projection: (name: string, query: string) => ProjectionDefinition;
export type RelationDefinition = {
    relation: 'one';
    name: string;
    table: TableDefinition<any>;
    fields: ClickHouseColumn[];
    references: ClickHouseColumn[];
} | {
    relation: 'many';
    name: string;
    table: TableDefinition<any>;
    fields?: ClickHouseColumn[];
    references?: ClickHouseColumn[];
};
export type TableColumns = Record<string, ClickHouseColumn<any, any, any>>;
export type TableRow<TCols extends TableColumns> = {
    [K in keyof TCols]: TCols[K] extends ClickHouseColumn<infer T, infer NotNull, any> ? NotNull extends true ? T : T | null : never;
};
export type TableInsert<TCols extends TableColumns> = {
    [K in keyof TCols as TCols[K] extends ClickHouseColumn<any, infer NotNull, infer Auto> ? NotNull extends true ? Auto extends true ? never : K : never : never]: TCols[K] extends ClickHouseColumn<infer T, any, any> ? T : never;
} & Partial<{
    [K in keyof TCols as TCols[K] extends ClickHouseColumn<any, infer NotNull, infer Auto> ? NotNull extends true ? Auto extends true ? K : never : K : never]: TCols[K] extends ClickHouseColumn<infer T, any, any> ? T : never;
}>;
type GetColumnType<T extends ClickHouseColumn> = T extends ClickHouseColumn<infer Type, infer IsNotNull, any> ? IsNotNull extends true ? Type : Type | null : never;
export type InferSelectModel<T extends {
    $columns: TableColumns;
}> = {
    [K in keyof T['$columns']]: GetColumnType<T['$columns'][K]>;
};
export type InferInsertModel<T extends {
    $columns: TableColumns;
}> = TableInsert<T['$columns']>;
export type TableDefinition<TCols extends TableColumns, TOptions = TableOptions> = {
    $table: string;
    $columns: TCols;
    $options: TOptions;
    $relations?: Record<string, RelationDefinition>;
    toSQL(): string;
    toSQLs?(): string[];
    as(alias: string): TableDefinition<TCols, TOptions>;
    $inferSelect?: InferSelectModel<{
        $columns: TCols;
    }>;
    $inferInsert?: InferInsertModel<{
        $columns: TCols;
    }>;
} & TCols;
export interface VersionedMeta {
    baseName: string;
    version: string | number;
    aliasName?: string;
}
type CommonViewOptions = {
    onCluster?: string;
    orReplace?: boolean;
};
export interface ViewOptions extends CommonViewOptions {
    kind?: 'view';
}
export interface MaterializedViewOptions extends CommonViewOptions {
    kind?: 'materializedView';
    toTable?: string;
    engine?: EngineConfiguration;
    populate?: boolean;
}
export declare function chTable<T extends Record<string, ClickHouseColumn<any, any, any>>>(tableName: string, columns: T, options?: TableOptions): TableDefinition<T, TableOptions>;
export declare function chView<T extends Record<string, ClickHouseColumn<any, any, any>>>(name: string, columns: T, options: ViewOptions & {
    query: string;
}): TableDefinition<T, ViewOptions & {
    kind: 'view';
    query: string;
}> & {
    toSQLs: () => string[];
};
export declare function chView<T extends Record<string, ClickHouseColumn<any, any, any>>>(name: string, columns: T, query: string, options?: ViewOptions): TableDefinition<T, ViewOptions & {
    kind: 'view';
    query: string;
}> & {
    toSQLs: () => string[];
};
/**
 * Define a reusable set of columns with type inference.
 */
export declare function defineColumns<T extends TableColumns>(cols: T): T;
/**
 * Compose column sets, throwing on duplicate keys to avoid accidental overrides.
 */
export declare function extendColumns<Base extends TableColumns, Extra extends TableColumns>(base: Base, extra: Extra): Base & Extra;
/**
 * Define a versioned table (e.g., base_v2) with optional view alias to point to the latest version.
 */
export declare function versionedTable<T extends TableColumns>(baseName: string, version: string | number, columns: T, options?: TableOptions & {
    latestAlias?: boolean;
    aliasName?: string;
}): TableDefinition<T> & {
    $versionMeta: VersionedMeta;
    toSQLs: () => string[];
};
/**
 * Define a derived (aggregated) table with a backing table and materialized view.
 */
export declare function deriveTable<T extends TableColumns>(source: TableDefinition<T>, config: {
    name: string;
    groupBy: string | string[];
    aggregates: Record<string, string>;
    options?: TableOptions;
}): TableDefinition<any> & {
    toSQLs: () => string[];
};
/**
 * Render CREATE statements for preview.
 */
export declare function renderSchema(def: TableDefinition<any>): any;
/**
 * Generate a TypeScript type from a table definition (best effort mapping).
 */
export declare function generateTypes<T extends TableColumns>(def: TableDefinition<T>, typeName?: string): string;
export {};
