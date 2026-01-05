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
import {
    chTable,
    chView,
    type TableOptions,
    type TableDefinition,
    type TableColumns,
    type RelationDefinition,
    index,
    projection
} from './table';
import {
    chMaterializedView,
    detectMaterializedViewDrift,
    extractMVQuery,
    createMigrationBridge,
    generateBlueGreenMigration
} from './materialized-views';
export { detectMaterializedViewDrift, extractMVQuery, createMigrationBridge, generateBlueGreenMigration };
import { chDictionary } from './dictionary';
import { chProjection } from './materialized-views';
import { EngineConfiguration } from './engines';

export { index };

/**
 * Enhanced table options with column key references for orderBy, partitionBy, etc.
 */
export type EnhancedTableOptions<TColKeys extends string = string> = Omit<
    TableOptions,
    'orderBy' | 'partitionBy' | 'primaryKey' | 'sampleBy' | 'deduplicateBy' | 'versionColumn' | 'logicalPrimaryKey' | 'engine'
> & {
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

// =============================================================================
// Column Builder Object
// =============================================================================

/**
 * ClickHouse data types builder.
 * All columns are NOT NULL by default, following ClickHouse philosophy.
 */
function primaryUuid(): { id: ClickHouseColumn<string, true, true> };
function primaryUuid<TName extends string>(name: TName): { [K in TName]: ClickHouseColumn<string, true, true> };
function primaryUuid<TName extends string>(name?: TName) {
    const colName = (name ?? 'id') as TName;
    const column = new ClickHouseColumn<string>(colName, 'UUID')
        .autoGenerate()
        .primaryKey()
        .default('generateUUIDv4()');
    return {
        [colName]: column
    } as { [K in TName]: typeof column };
}

function primaryUuidV7(): { id: ClickHouseColumn<string, true, true> };
function primaryUuidV7<TName extends string>(name: TName): { [K in TName]: ClickHouseColumn<string, true, true> };
function primaryUuidV7<TName extends string>(name?: TName) {
    const colName = (name ?? 'id') as TName;
    const column = new ClickHouseColumn<string>(colName, 'UUID')
        .autoGenerate({ version: 7 })
        .primaryKey()
        .default('generateUUIDv7()');
    return {
        [colName]: column
    } as { [K in TName]: typeof column };
}

export const t = {
    // --- Integer Types ---
    int8: (name: string) => new ClickHouseColumn<number>(name, 'Int8'),
    int16: (name: string) => new ClickHouseColumn<number>(name, 'Int16'),
    integer: (name: string) => new ClickHouseColumn<number>(name, 'Int32'),
    /**
     * Int32 type. Signed 32-bit integer.
     * @range -2147483648 to 2147483647
     */
    int32: (name: string) => new ClickHouseColumn<number>(name, 'Int32'),
    int64: (name: string) => new ClickHouseColumn<number>(name, 'Int64'),
    int128: (name: string) => new ClickHouseColumn<number>(name, 'Int128'),
    int256: (name: string) => new ClickHouseColumn<number>(name, 'Int256'),

    uint8: (name: string) => new ClickHouseColumn<number>(name, 'UInt8'),
    uint16: (name: string) => new ClickHouseColumn<number>(name, 'UInt16'),
    uint32: (name: string) => new ClickHouseColumn<number>(name, 'UInt32'),
    uint64: (name: string) => new ClickHouseColumn<number>(name, 'UInt64'),
    uint128: (name: string) => new ClickHouseColumn<number>(name, 'UInt128'),
    uint256: (name: string) => new ClickHouseColumn<number>(name, 'UInt256'),

    // --- Floating Point Types ---
    float32: (name: string) => new ClickHouseColumn<number>(name, 'Float32'),
    float: (name: string) => new ClickHouseColumn<number>(name, 'Float64'),
    float64: (name: string) => new ClickHouseColumn<number>(name, 'Float64'),
    bfloat16: (name: string) => new ClickHouseColumn<number>(name, 'BFloat16'),

    // --- Decimal Types ---
    decimal: (name: string, precision = 18, scale = 4) =>
        new ClickHouseColumn<number>(name, `Decimal(${precision}, ${scale})`),
    decimal32: (name: string, scale = 4) =>
        new ClickHouseColumn<number>(name, `Decimal32(${scale})`),
    decimal64: (name: string, scale = 4) =>
        new ClickHouseColumn<number>(name, `Decimal64(${scale})`),
    decimal128: (name: string, scale = 4) =>
        new ClickHouseColumn<number>(name, `Decimal128(${scale})`),
    decimal256: (name: string, scale = 4) =>
        new ClickHouseColumn<number>(name, `Decimal256(${scale})`),

    // --- String Types ---
    text: (name: string) => new ClickHouseColumn<string>(name, 'String'),
    string: (name: string) => new ClickHouseColumn<string>(name, 'String'),
    fixedString: (name: string, length: number) =>
        new ClickHouseColumn<string>(name, `FixedString(${length})`),
    varchar: (name: string, opts?: { length?: number }) =>
        opts?.length
            ? new ClickHouseColumn<string>(name, `FixedString(${opts.length})`)
            : new ClickHouseColumn<string>(name, 'String'),

    // --- Date and Time Types ---
    date: (name: string) => new ClickHouseColumn<Date | string>(name, 'Date'),
    date32: (name: string) => new ClickHouseColumn<Date | string>(name, 'Date32'),
    timestamp: (name: string, timezone?: string) =>
        new ClickHouseColumn<Date | string>(name, timezone ? `DateTime('${timezone}')` : 'DateTime'),
    /**
     * DateTime type. Stores date and time.
     * @param timezone - Optional. Example: 'UTC', 'Europe/Madrid'
     */
    datetime: (name: string, timezone?: string) =>
        new ClickHouseColumn<Date | string>(name, timezone ? `DateTime('${timezone}')` : 'DateTime'),
    datetime64: (name: string, precision = 3, timezone?: string) =>
        new ClickHouseColumn<Date | string>(
            name,
            timezone ? `DateTime64(${precision}, '${timezone}')` : `DateTime64(${precision})`
        ),

    // --- Boolean Type ---
    boolean: (name: string) => new ClickHouseColumn<boolean>(name, 'Bool'),
    bool: (name: string) => new ClickHouseColumn<boolean>(name, 'Bool'),

    // --- UUID Type ---
    uuid: (name: string) => new ClickHouseColumn<string>(name, 'UUID'),

    // --- IP Address Types ---
    ipv4: (name: string) => new ClickHouseColumn<string>(name, 'IPv4'),
    ipv6: (name: string) => new ClickHouseColumn<string>(name, 'IPv6'),

    // --- Composite Types ---
    array: <T>(col: ClickHouseColumn<T>) => {
        const isInnerComposite = col.type.startsWith('Array(') || col.type.startsWith('Map(') || col.type.startsWith('Tuple(');
        const innerType = (col.isNull && !isInnerComposite) ? `Nullable(${col.type})` : col.type;
        return new ClickHouseColumn<T[]>(col.name, `Array(${innerType})`);
    },

    tuple: (name: string, types: string[]) => {
        if (!Array.isArray(types)) {
            throw new Error(`tuple() expects an array of types, but received: ${typeof types}`);
        }
        return new ClickHouseColumn<any>(name, `Tuple(${types.join(', ')})`);
    },

    map: (name: string, keyType = 'String', valueType = 'String') =>
        new ClickHouseColumn<Record<string, any>>(name, `Map(${keyType}, ${valueType})`),

    nested: (name: string, fields: Record<string, string>) => {
        const fieldDefs = Object.entries(fields).map(([k, v]) => `${k} ${v}`).join(', ');
        return new ClickHouseColumn<any>(name, `Nested(${fieldDefs})`);
    },

    // --- JSON Types ---
    json: <TSchema = Record<string, any>>(name: string) =>
        new ClickHouseColumn<TSchema, false>(name, 'JSON', true, { isJson: true }),

    // --- Special Types ---
    dynamic: (name: string, maxTypes?: number) =>
        new ClickHouseColumn<any>(name, maxTypes ? `Dynamic(max_types=${maxTypes})` : 'Dynamic'),

    /**
     * LowCardinality type. Optimizes columns with few unique values 
     * (typically < 10,000) for ultra-fast reading.
     * @see https://clickhouse.com/docs/en/sql-reference/data-types/lowcardinality
     */
    lowCardinality: <T, TNotNull extends boolean, TAutoGenerated extends boolean>(
        col: ClickHouseColumn<T, TNotNull, TAutoGenerated>
    ) => col.clone<TNotNull, TAutoGenerated>({ type: `LowCardinality(${col.type})` }),

    // --- Aggregate Function Types ---
    aggregateFunction: (name: string, funcName: string, ...argTypes: string[]) =>
        new ClickHouseColumn<any>(name, `AggregateFunction(${funcName}${argTypes.length > 0 ? ', ' + argTypes.join(', ') : ''})`),

    simpleAggregateFunction: (name: string, funcName: string, argType: string) =>
        new ClickHouseColumn<any>(name, `SimpleAggregateFunction(${funcName}, ${argType})`),

    // --- Geo Types ---
    point: (name: string) => new ClickHouseColumn<[number, number]>(name, 'Point'),
    ring: (name: string) => new ClickHouseColumn<Array<[number, number]>>(name, 'Ring'),
    polygon: (name: string) => new ClickHouseColumn<Array<Array<[number, number]>>>(name, 'Polygon'),
    multiPolygon: (name: string) => new ClickHouseColumn<Array<Array<Array<[number, number]>>>>(name, 'MultiPolygon'),

    // --- Enum Type ---
    enum: (name: string, values: readonly string[]) =>
        new ClickHouseColumn<string, false>(name, 'String', true, { enumValues: values }),

    // --- Presets ---

    /**
     * Adds 'created_at' and 'updated_at' columns with default now().
     */
    timestamps: () => ({
        created_at: new ClickHouseColumn<Date | string>('created_at', 'DateTime').default('now()'),
        updated_at: new ClickHouseColumn<Date | string>('updated_at', 'DateTime').default('now()'),
    }),

    /**
     * Adds a standard UUID primary key column (default: 'id').
     */
    primaryUuid,
    /**
     * Adds a UUID v7 primary key column (default: 'id').
     */
    primaryUuidV7,

    /**
     * Adds 'is_deleted' and 'deleted_at' columns for soft deletes.
     */
    softDeletes: () => ({
        is_deleted: new ClickHouseColumn<boolean>('is_deleted', 'Bool').default(false),
        deleted_at: new ClickHouseColumn<Date | string>('deleted_at', 'DateTime').nullable(),
    }),
};

// Type for the builder object
export type ColumnBuilder = typeof t;

// =============================================================================
// Table Definition with Callback Pattern
// =============================================================================

/**
 * Define a strongly-typed ClickHouse table.
 * 
 * @param name - Physical table name in ClickHouse.
 * @param columns - Column definition object or callback using `t` builder.
 * @param options - Engine configuration, sorting keys, partitioning, etc.
 */
export function defineTable<T extends Record<string, ClickHouseColumn<any, any, any>>>(
    tableName: string,
    columnsOrCallback: T | ((t: ColumnBuilder) => T),
    options: EnhancedTableOptions<keyof T & string>
): TableDefinition<T, TableOptions> {
    // Resolve columns
    const columns = typeof columnsOrCallback === 'function'
        ? columnsOrCallback(t)
        : columnsOrCallback;

    return chTable(tableName, columns, options as TableOptions);
}

/**
 * Aliases for modern API - providing both short and explicit naming.
 * 
 * NOTE: defineTable is the preferred explicit naming for library consistency,
 * while 'table' is provided as a shorthand similar to other ORMs.
 */
export const table = defineTable;
export const view = chView;
export const defineView = chView;
export const defineMaterializedView = chMaterializedView;
export const materializedView = chMaterializedView;
export const dictionary = chDictionary;
export const defineDictionary = chDictionary;
export { projection };
export { chProjection as defineProjection };

// =============================================================================
// Relation Builders
// =============================================================================

/**
 * Define relations for a table using a callback pattern.
 */
export function relations<
    TTable extends TableDefinition<any>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    relationsBuilder: (helpers: {
        one: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config: { fields: ClickHouseColumn<any, any, any>[]; references: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
        many: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config?: { fields?: ClickHouseColumn<any, any, any>[]; references?: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
    }) => TRelations
): asserts table is TTable & { $relations: TRelations };
export function relations<
    TTable extends TableDefinition<any>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    relationsBuilder: (helpers: {
        one: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config: { fields: ClickHouseColumn<any, any, any>[]; references: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
        many: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config?: { fields?: ClickHouseColumn<any, any, any>[]; references?: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
    }) => TRelations
): TRelations;
export function relations<
    TTable extends TableDefinition<any>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    relationsBuilder: (helpers: {
        one: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config: { fields: ClickHouseColumn<any, any, any>[]; references: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
        many: <TTarget extends TableDefinition<any>>(
            table: TTarget,
            config?: { fields?: ClickHouseColumn<any, any, any>[]; references?: ClickHouseColumn<any, any, any>[] }
        ) => RelationDefinition<TTarget>;
    }) => TRelations
): TRelations {
    const helpers = {
        one: (targetTable: TableDefinition<any>, config: { fields: ClickHouseColumn[]; references: ClickHouseColumn[] }): RelationDefinition => ({
            relation: 'one',
            name: '', // Will be set from key
            table: targetTable,
            fields: config.fields,
            references: config.references,
        }),
        many: (targetTable: TableDefinition<any>, config?: { fields?: ClickHouseColumn[]; references?: ClickHouseColumn[] }): RelationDefinition => ({
            relation: 'many',
            name: '', // Will be set from key
            table: targetTable,
            fields: config?.fields,
            references: config?.references,
        }),
    };

    const rels = relationsBuilder(helpers);

    // Set relation names from the object keys
    for (const [name, rel] of Object.entries(rels)) {
        rel.name = name;
    }

    // Attach relations to the table definition
    (table as any).$relations = rels;

    return rels;
}
