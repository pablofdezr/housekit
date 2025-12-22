/**
 * HouseKit Schema Builder - Fluent API for Table Definitions
 *
 * This module provides a modern fluent syntax for defining tables using
 * a builder function pattern instead of individual imports.
 *
 * @example
 * ```typescript
 * import { defineTable, t } from '@housekit/orm';
 *
 * // Using the builder function pattern
 * export const users = defineTable('users', (t) => ({
 *     id: t.uuid('id').primaryKey(),
 *     name: t.string('name'),
 *     email: t.string('email'),
 *     age: t.int32('age').nullable(),
 *     createdAt: t.datetime('created_at').default('now()'),
 * }), { engine: Engine.MergeTree(), orderBy: 'createdAt' });
 * ```
 */
import { ClickHouseColumn } from './column';
import { chView, type TableOptions, type TableDefinition, type RelationDefinition, index, projection } from './table';
import { chMaterializedView, detectMaterializedViewDrift, extractMVQuery, createMigrationBridge, generateBlueGreenMigration } from './materialized-views';
export { detectMaterializedViewDrift, extractMVQuery, createMigrationBridge, generateBlueGreenMigration };
import { chDictionary } from './dictionary';
import { chProjection } from './materialized-views';
import { EngineConfiguration } from './engines';
export { index };
/**
 * Enhanced table options with column key references for orderBy, partitionBy, etc.
 */
export type EnhancedTableOptions<TColKeys extends string = string> = Omit<TableOptions, 'orderBy' | 'partitionBy' | 'primaryKey' | 'sampleBy' | 'deduplicateBy' | 'versionColumn' | 'logicalPrimaryKey' | 'engine'> & {
    engine: EngineConfiguration;
    customEngine?: string;
    /**
     * Column(s) for ORDER BY. Can use column keys from your definition.
     * @example orderBy: 'timestamp' or orderBy: ['user_id', 'timestamp']
     */
    orderBy?: TColKeys | TColKeys[] | string | string[];
    /**
     * Column(s) for PARTITION BY. Can use column keys from your definition.
     */
    partitionBy?: TColKeys | TColKeys[] | string | string[];
    /**
     * Column(s) for PRIMARY KEY. Can use column keys from your definition.
     */
    primaryKey?: TColKeys | TColKeys[] | string | string[];
    /**
     * Column(s) for SAMPLE BY. Can use column keys from your definition.
     */
    sampleBy?: TColKeys | TColKeys[] | string | string[];
    /**
     * Column(s) for deduplication (ReplacingMergeTree).
     */
    deduplicateBy?: TColKeys | TColKeys[] | string | string[];
    /**
     * Version column for ReplacingMergeTree.
     */
    versionColumn?: TColKeys | string;
    /**
     * Logical primary key (for documentation, not enforced).
     */
    logicalPrimaryKey?: TColKeys | TColKeys[] | string | string[];
};
/**
 * ClickHouse data types builder.
 * All columns are NOT NULL by default, following ClickHouse philosophy.
 */
export declare const t: {
    int8: (name: string) => ClickHouseColumn<number, true, false>;
    int16: (name: string) => ClickHouseColumn<number, true, false>;
    integer: (name: string) => ClickHouseColumn<number, true, false>;
    /**
     * Int32 type. Signed 32-bit integer.
     * @range -2147483648 to 2147483647
     */
    int32: (name: string) => ClickHouseColumn<number, true, false>;
    int64: (name: string) => ClickHouseColumn<number, true, false>;
    int128: (name: string) => ClickHouseColumn<number, true, false>;
    int256: (name: string) => ClickHouseColumn<number, true, false>;
    uint8: (name: string) => ClickHouseColumn<number, true, false>;
    uint16: (name: string) => ClickHouseColumn<number, true, false>;
    uint32: (name: string) => ClickHouseColumn<number, true, false>;
    uint64: (name: string) => ClickHouseColumn<number, true, false>;
    uint128: (name: string) => ClickHouseColumn<number, true, false>;
    uint256: (name: string) => ClickHouseColumn<number, true, false>;
    float32: (name: string) => ClickHouseColumn<number, true, false>;
    float: (name: string) => ClickHouseColumn<number, true, false>;
    float64: (name: string) => ClickHouseColumn<number, true, false>;
    bfloat16: (name: string) => ClickHouseColumn<number, true, false>;
    decimal: (name: string, precision?: number, scale?: number) => ClickHouseColumn<number, true, false>;
    decimal32: (name: string, scale?: number) => ClickHouseColumn<number, true, false>;
    decimal64: (name: string, scale?: number) => ClickHouseColumn<number, true, false>;
    decimal128: (name: string, scale?: number) => ClickHouseColumn<number, true, false>;
    decimal256: (name: string, scale?: number) => ClickHouseColumn<number, true, false>;
    text: (name: string) => ClickHouseColumn<string, true, false>;
    string: (name: string) => ClickHouseColumn<string, true, false>;
    fixedString: (name: string, length: number) => ClickHouseColumn<string, true, false>;
    varchar: (name: string, opts?: {
        length?: number;
    }) => ClickHouseColumn<string, true, false>;
    date: (name: string) => ClickHouseColumn<string | Date, true, false>;
    date32: (name: string) => ClickHouseColumn<string | Date, true, false>;
    timestamp: (name: string, timezone?: string) => ClickHouseColumn<string | Date, true, false>;
    /**
     * DateTime type. Stores date and time.
     * @param timezone - Optional. Example: 'UTC', 'Europe/Madrid'
     */
    datetime: (name: string, timezone?: string) => ClickHouseColumn<string | Date, true, false>;
    datetime64: (name: string, precision?: number, timezone?: string) => ClickHouseColumn<string | Date, true, false>;
    boolean: (name: string) => ClickHouseColumn<boolean, true, false>;
    bool: (name: string) => ClickHouseColumn<boolean, true, false>;
    uuid: (name: string) => ClickHouseColumn<string, true, false>;
    ipv4: (name: string) => ClickHouseColumn<string, true, false>;
    ipv6: (name: string) => ClickHouseColumn<string, true, false>;
    array: <T>(col: ClickHouseColumn<T>) => ClickHouseColumn<T[], true, false>;
    tuple: (name: string, types: string[]) => ClickHouseColumn<any, true, false>;
    map: (name: string, keyType?: string, valueType?: string) => ClickHouseColumn<Record<string, any>, true, false>;
    nested: (name: string, fields: Record<string, string>) => ClickHouseColumn<any, true, false>;
    json: <TSchema = Record<string, any>>(name: string) => ClickHouseColumn<TSchema, false, false>;
    dynamic: (name: string, maxTypes?: number) => ClickHouseColumn<any, true, false>;
    /**
     * LowCardinality type. Optimizes columns with few unique values
     * (typically < 10,000) for ultra-fast reading.
     * @see https://clickhouse.com/docs/en/sql-reference/data-types/lowcardinality
     */
    lowCardinality: <T, TNotNull extends boolean, TAutoGenerated extends boolean>(col: ClickHouseColumn<T, TNotNull, TAutoGenerated>) => ClickHouseColumn<T, TNotNull, TAutoGenerated>;
    aggregateFunction: (name: string, funcName: string, ...argTypes: string[]) => ClickHouseColumn<any, true, false>;
    simpleAggregateFunction: (name: string, funcName: string, argType: string) => ClickHouseColumn<any, true, false>;
    point: (name: string) => ClickHouseColumn<[number, number], true, false>;
    ring: (name: string) => ClickHouseColumn<[number, number][], true, false>;
    polygon: (name: string) => ClickHouseColumn<[number, number][][], true, false>;
    multiPolygon: (name: string) => ClickHouseColumn<[number, number][][][], true, false>;
    enum: (name: string, values: readonly string[]) => ClickHouseColumn<string, false, false>;
};
export type ColumnBuilder = typeof t;
/**
 * Define a strongly-typed ClickHouse table.
 *
 * @param name - Physical table name in ClickHouse.
 * @param columns - Column definition object or callback using `t` builder.
 * @param options - Engine configuration, sorting keys, partitioning, etc.
 */
export declare function defineTable<T extends Record<string, ClickHouseColumn<any, any, any>>>(tableName: string, columnsOrCallback: T | ((t: ColumnBuilder) => T), options: EnhancedTableOptions<keyof T & string>): TableDefinition<T, TableOptions>;
/**
 * Aliases for modern API - providing both short and explicit naming.
 *
 * NOTE: defineTable is the preferred explicit naming for library consistency,
 * while 'table' is provided as a shorthand similar to other ORMs.
 */
export declare const table: typeof defineTable;
export declare const view: typeof chView;
export declare const defineView: typeof chView;
export declare const defineMaterializedView: typeof chMaterializedView;
export declare const materializedView: typeof chMaterializedView;
export declare const dictionary: typeof chDictionary;
export declare const defineDictionary: typeof chDictionary;
export { projection };
export { chProjection as defineProjection };
/**
 * Define relations for a table using a callback pattern.
 */
export declare function relations<TTable extends TableDefinition<any>>(table: TTable, relationsBuilder: (helpers: {
    one: (table: TableDefinition<any>, config: {
        fields: ClickHouseColumn<any, any, any>[];
        references: ClickHouseColumn<any, any, any>[];
    }) => RelationDefinition;
    many: (table: TableDefinition<any>, config?: {
        fields?: ClickHouseColumn<any, any, any>[];
        references?: ClickHouseColumn<any, any, any>[];
    }) => RelationDefinition;
}) => Record<string, RelationDefinition>): Record<string, RelationDefinition>;
