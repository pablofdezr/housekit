import { ClickHouseColumn, ColumnMeta } from './column';

// Type helpers
export type JsonValue = Record<string, any> | any[];

// =============================================================================
// NATIVE CLICKHOUSE DATA TYPES
// =============================================================================
// These map directly to ClickHouse's native data types
// Reference: https://clickhouse.com/docs/en/sql-reference/data-types

// --- Integer Types ---
export const int8 = (name: string) => new ClickHouseColumn<number>(name, 'Int8');
export const int16 = (name: string) => new ClickHouseColumn<number>(name, 'Int16');
export const integer = (name: string) => new ClickHouseColumn<number>(name, 'Int32');
export const int32 = integer; // Native alias
export const int64 = (name: string) => new ClickHouseColumn<number>(name, 'Int64');
/**
 * ⚠️ Advanced: Very wide integer type (128-bit).
 * Use only if you need to store numbers larger than 2^63-1.
 * For most cases, `int64` is sufficient.
 */
export const int128 = (name: string) => new ClickHouseColumn<number>(name, 'Int128');

/**
 * ⚠️ Advanced: Extremely wide integer type (256-bit).
 * Use only if you need to store numbers larger than 2^127-1.
 * For most cases, `int64` is sufficient.
 */
export const int256 = (name: string) => new ClickHouseColumn<number>(name, 'Int256');

export const uint8 = (name: string) => new ClickHouseColumn<number>(name, 'UInt8');
export const uint16 = (name: string) => new ClickHouseColumn<number>(name, 'UInt16');
export const uint32 = (name: string) => new ClickHouseColumn<number>(name, 'UInt32');
export const uint64 = (name: string) => new ClickHouseColumn<number>(name, 'UInt64');
/**
 * ⚠️ Advanced: Very wide unsigned integer type (128-bit).
 * Use only if you need to store numbers larger than 2^64-1.
 * For most cases, `uint64` is sufficient.
 */
export const uint128 = (name: string) => new ClickHouseColumn<number>(name, 'UInt128');

/**
 * ⚠️ Advanced: Extremely wide unsigned integer type (256-bit).
 * Use only if you need to store numbers larger than 2^128-1.
 * For most cases, `uint64` is sufficient.
 */
export const uint256 = (name: string) => new ClickHouseColumn<number>(name, 'UInt256');

// --- Floating Point Types ---
export const float32 = (name: string) => new ClickHouseColumn<number>(name, 'Float32');
export const float = (name: string) => new ClickHouseColumn<number>(name, 'Float64');
export const float64 = float; // Native alias
/**
 * ⚠️ Advanced: Brain Floating Point (16-bit).
 * Primarily used for machine learning applications.
 * Lower precision than `float32`. Use only if you know exactly why.
 */
export const bfloat16 = (name: string) => new ClickHouseColumn<number>(name, 'BFloat16');

// --- Decimal Types ---
export const decimal = (name: string, precision = 18, scale = 4) =>
    new ClickHouseColumn<number>(name, `Decimal(${precision}, ${scale})`);
export const decimal32 = (name: string, scale = 4) =>
    new ClickHouseColumn<number>(name, `Decimal32(${scale})`);
export const decimal64 = (name: string, scale = 4) =>
    new ClickHouseColumn<number>(name, `Decimal64(${scale})`);
/**
 * ⚠️ Advanced: High precision decimal.
 * Use only if you need more precision than `decimal64`.
 */
export const decimal128 = (name: string, scale = 4) =>
    new ClickHouseColumn<number>(name, `Decimal128(${scale})`);

/**
 * ⚠️ Advanced: Extreme precision decimal.
 * Use only if you need more precision than `decimal128`.
 */
export const decimal256 = (name: string, scale = 4) =>
    new ClickHouseColumn<number>(name, `Decimal256(${scale})`);

// --- String Types ---
export const text = (name: string) => new ClickHouseColumn<string>(name, 'String');
export const string = text; // Native alias
export const fixedString = (name: string, length: number) =>
    new ClickHouseColumn<string>(name, `FixedString(${length})`);

// --- Date and Time Types ---
export const date = (name: string) => new ClickHouseColumn<Date | string>(name, 'Date');
export const date32 = (name: string) => new ClickHouseColumn<Date | string>(name, 'Date32');
export const timestamp = (name: string, timezone?: string) =>
    new ClickHouseColumn<Date | string>(name, timezone ? `DateTime('${timezone}')` : 'DateTime');
export const datetime = timestamp; // Native alias
export const datetime64 = (name: string, precision = 3, timezone?: string) =>
    new ClickHouseColumn<Date | string>(name, timezone ? `DateTime64(${precision}, '${timezone}')` : `DateTime64(${precision})`);

// --- Boolean Type ---
export const boolean = (name: string) => new ClickHouseColumn<boolean>(name, 'Bool');
export const bool = boolean; // Native alias

// --- UUID Type ---
export const uuid = (name: string) => new ClickHouseColumn<string>(name, 'UUID');

// --- IP Address Types ---
export const ipv4 = (name: string) => new ClickHouseColumn<string>(name, 'IPv4');
export const ipv6 = (name: string) => new ClickHouseColumn<string>(name, 'IPv6');

// --- Enum Types ---
// Note: enum8 and enum16 are exported from modules/types.ts for better type safety

// --- Composite Types ---
export const array = <T>(col: ClickHouseColumn<T>) => {
    const isInnerComposite = col.type.startsWith('Array(') || col.type.startsWith('Map(') || col.type.startsWith('Tuple(');
    const innerType = (col.isNull && !isInnerComposite) ? `Nullable(${col.type})` : col.type;
    return new ClickHouseColumn<T[]>(col.name, `Array(${innerType})`);
};

export const tuple = (name: string, types: string[]) => {
    if (!Array.isArray(types)) {
        throw new Error(`tuple() expects an array of types, but received: ${typeof types}`);
    }
    return new ClickHouseColumn<any>(name, `Tuple(${types.join(', ')})`);
};

export const map = (name: string, keyType = 'String', valueType = 'String') =>
    new ClickHouseColumn<Record<string, any>>(name, `Map(${keyType}, ${valueType})`);

export const nested = (name: string, fields: Record<string, string>) => {
    const fieldDefs = Object.entries(fields).map(([k, v]) => `${k} ${v}`).join(', ');
    return new ClickHouseColumn<any>(name, `Nested(${fieldDefs})`);
};

// --- Special Wrapper Types ---
export const nullable = <T, TNotNull extends boolean, TAutoGenerated extends boolean>(col: ClickHouseColumn<T, TNotNull, TAutoGenerated>) =>
    col.nullable();

export const lowCardinality = <T, TNotNull extends boolean, TAutoGenerated extends boolean>(col: ClickHouseColumn<T, TNotNull, TAutoGenerated>) => {
    return col.clone<TNotNull, TAutoGenerated>({ type: `LowCardinality(${col.type})` });
};

// --- JSON Types ---
export const json = <TSchema = JsonValue>(name: string) =>
    new ClickHouseColumn<TSchema, false>(name, 'JSON', true, { isJson: true });

/**
 * ⚠️ Advanced: Dynamic typing (experimental/niche).
 * Allows storing values of different types in the same column.
 * This is still evolving in ClickHouse. Use with caution.
 */
export const dynamic = (name: string, maxTypes?: number) =>
    new ClickHouseColumn<any>(name, maxTypes ? `Dynamic(max_types=${maxTypes})` : 'Dynamic');

// --- Aggregate Function Types ---
export const aggregateFunction = (name: string, funcName: string, ...argTypes: string[]) =>
    new ClickHouseColumn<any>(name, `AggregateFunction(${funcName}${argTypes.length > 0 ? ', ' + argTypes.join(', ') : ''})`);

export const simpleAggregateFunction = (name: string, funcName: string, argType: string) =>
    new ClickHouseColumn<any>(name, `SimpleAggregateFunction(${funcName}, ${argType})`);

// --- Geo Types ---
export const point = (name: string) => new ClickHouseColumn<[number, number]>(name, 'Point');
export const ring = (name: string) => new ClickHouseColumn<Array<[number, number]>>(name, 'Ring');
export const polygon = (name: string) => new ClickHouseColumn<Array<Array<[number, number]>>>(name, 'Polygon');
export const multiPolygon = (name: string) => new ClickHouseColumn<Array<Array<Array<[number, number]>>>>(name, 'MultiPolygon');

export const varchar = (name: string, opts?: { length?: number }) => {
    // ClickHouse doesn't have VARCHAR, map to String or FixedString
    return opts?.length ? fixedString(name, opts.length) : text(name);
};

// Enum with validation metadata
export const enumType = (name: string, values: readonly string[]) =>
    new ClickHouseColumn<string, false>(name, 'String', true, { enumValues: values });

// TTL Helpers
export interface TTLRule {
    expression: string;
    action?: 'DELETE' | 'TO DISK' | 'TO VOLUME';
    target?: string;
}

export const ttl = {
    /**
     * Delete rows after a time interval
     * @example ttl.delete(events.timestamp, { days: 30 })
     */
    delete: (column: ClickHouseColumn, interval: { days?: number; hours?: number; months?: number; years?: number }): TTLRule => {
        const intervalStr = formatInterval(interval);
        return {
            expression: `${column.name} + INTERVAL ${intervalStr}`,
            action: 'DELETE'
        };
    },

    /**
     * Move rows to cold storage after a time interval
     * @example ttl.toDisk(events.timestamp, { days: 7 }, 'cold_storage')
     */
    toDisk: (column: ClickHouseColumn, interval: { days?: number; hours?: number; months?: number; years?: number }, disk: string): TTLRule => {
        const intervalStr = formatInterval(interval);
        return {
            expression: `${column.name} + INTERVAL ${intervalStr}`,
            action: 'TO DISK',
            target: disk
        };
    },

    /**
     * Move rows to a volume after a time interval
     * @example ttl.toVolume(events.timestamp, { days: 30 }, 'archive')
     */
    toVolume: (column: ClickHouseColumn, interval: { days?: number; hours?: number; months?: number; years?: number }, volume: string): TTLRule => {
        const intervalStr = formatInterval(interval);
        return {
            expression: `${column.name} + INTERVAL ${intervalStr}`,
            action: 'TO VOLUME',
            target: volume
        };
    },

    /**
     * Custom TTL expression
     * @example ttl.custom('created_at + INTERVAL 1 YEAR')
     */
    custom: (expression: string): TTLRule => {
        return { expression };
    },

    /**
     * Combine multiple TTL rules (tiered storage)
     * @example ttl.tiered(events.timestamp, [
     *   { days: 7, action: 'toDisk', target: 'cold' },
     *   { days: 30, action: 'delete' }
     * ])
     */
    tiered: (
        column: ClickHouseColumn,
        tiers: Array<{
            days?: number;
            hours?: number;
            months?: number;
            years?: number;
            action: 'delete' | 'toDisk' | 'toVolume';
            target?: string;
        }>
    ): TTLRule[] => {
        return tiers.map(tier => {
            const intervalStr = formatInterval(tier);
            const rule: TTLRule = {
                expression: `${column.name} + INTERVAL ${intervalStr}`
            };

            if (tier.action === 'delete') {
                rule.action = 'DELETE';
            } else if (tier.action === 'toDisk' && tier.target) {
                rule.action = 'TO DISK';
                rule.target = tier.target;
            } else if (tier.action === 'toVolume' && tier.target) {
                rule.action = 'TO VOLUME';
                rule.target = tier.target;
            }

            return rule;
        });
    }
};

function formatInterval(interval: { days?: number; hours?: number; months?: number; years?: number }): string {
    if (interval.years) return `${interval.years} YEAR`;
    if (interval.months) return `${interval.months} MONTH`;
    if (interval.days) return `${interval.days} DAY`;
    if (interval.hours) return `${interval.hours} HOUR`;
    return '1 DAY';
}
