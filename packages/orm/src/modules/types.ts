export type JsonValue = Record<string, any> | any[];

import { ClickHouseColumn } from '../column';
import { sql } from '../expressions';

// =============================================================================
// TYPE HELPERS FOR COMMON COMBINATIONS
// =============================================================================

/**
 * Low cardinality string column (very common for dimensions)
 * @param name - Column name
 */
export function lowCardinalityString(name: string): ClickHouseColumn<string> {
    return new ClickHouseColumn<string>(name, 'LowCardinality(String)');
}

/**
 * Low cardinality nullable string column
 * @param name - Column name
 */
export function lowCardinalityNullableString(name: string): ClickHouseColumn<string | null> {
    return new ClickHouseColumn<string | null>(name, 'LowCardinality(Nullable(String))', true);
}

/**
 * Nullable JSON column
 * @param name - Column name
 */
export function nullableJson(name: string): ClickHouseColumn<JsonValue | null> {
    return new ClickHouseColumn<JsonValue | null>(name, 'Nullable(JSON)', true, { isJson: true });
}

/**
 * Low cardinality JSON column
 * @param name - Column name
 */
export function lowCardinalityJson(name: string): ClickHouseColumn<JsonValue> {
    return new ClickHouseColumn<JsonValue>(name, 'LowCardinality(JSON)', false, { isJson: true });
}

/**
 * Low cardinality nullable JSON column
 * @param name - Column name
 */
export function lowCardinalityNullableJson(name: string): ClickHouseColumn<JsonValue | null> {
    return new ClickHouseColumn<JsonValue | null>(name, 'LowCardinality(Nullable(JSON))', true, { isJson: true });
}

// =============================================================================
// ENUM HELPERS WITH BETTER TYPE SAFETY
// =============================================================================

/**
 * Create an Enum8 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export function enum8<T extends string>(
    name: string,
    values: readonly T[]
): ClickHouseColumn<T> {
    const enumDef = values.map((v, i) => `'${v}'=${i}`).join(', ');
    return new ClickHouseColumn<T>(name, `Enum8(${enumDef})`, false, { enumValues: values as readonly string[] });
}

/**
 * Create a nullable Enum8 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export function nullableEnum8<T extends string>(
    name: string,
    values: readonly T[]
): ClickHouseColumn<T | null> {
    const enumDef = values.map((v, i) => `'${v}'=${i}`).join(', ');
    return new ClickHouseColumn<T | null>(name, `Nullable(Enum8(${enumDef}))`, true, { enumValues: values as readonly string[] });
}

/**
 * Create an Enum16 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export function enum16<T extends string>(
    name: string,
    values: readonly T[]
): ClickHouseColumn<T> {
    const enumDef = values.map((v, i) => `'${v}'=${i}`).join(', ');
    return new ClickHouseColumn<T>(name, `Enum16(${enumDef})`, false, { enumValues: values as readonly string[] });
}

/**
 * Create a nullable Enum16 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export function nullableEnum16<T extends string>(
    name: string,
    values: readonly T[]
): ClickHouseColumn<T | null> {
    const enumDef = values.map((v, i) => `'${v}'=${i}`).join(', ');
    return new ClickHouseColumn<T | null>(name, `Nullable(Enum16(${enumDef}))`, true, { enumValues: values as readonly string[] });
}

// =============================================================================
// ARRAY TYPE HELPERS
// =============================================================================

/**
 * Array of strings with low cardinality
 * @param name - Column name
 */
export function lowCardinalityStringArray(name: string): ClickHouseColumn<string[]> {
    return new ClickHouseColumn<string[]>(name, 'Array(LowCardinality(String))');
}

/**
 * Nullable array of strings
 * @param name - Column name
 */
export function nullableStringArray(name: string): ClickHouseColumn<string[] | null> {
    return new ClickHouseColumn<string[] | null>(name, 'Nullable(Array(String))', true);
}

/**
 * Array of nullable strings
 * @param name - Column name
 */
export function stringNullableArray(name: string): ClickHouseColumn<(string | null)[]> {
    return new ClickHouseColumn<(string | null)[]>(name, 'Array(Nullable(String))');
}

/**
 * Array of integers with low cardinality
 * @param name - Column name
 */
export function lowCardinalityInt32Array(name: string): ClickHouseColumn<number[]> {
    return new ClickHouseColumn<number[]>(name, 'Array(LowCardinality(Int32))');
}

// =============================================================================
// COMMON BUSINESS TYPE HELPERS
// =============================================================================

/**
 * Email column (low cardinality string)
 * @param name - Column name
 */
export function email(name: string): ClickHouseColumn<string> {
    return lowCardinalityString(name);
}

/**
 * Nullable email column
 * @param name - Column name
 */
export function nullableEmail(name: string): ClickHouseColumn<string | null> {
    return lowCardinalityNullableString(name);
}

/**
 * Phone number column (low cardinality string)
 * @param name - Column name
 */
export function phone(name: string): ClickHouseColumn<string> {
    return lowCardinalityString(name);
}

/**
 * Nullable phone number column
 * @param name - Column name
 */
export function nullablePhone(name: string): ClickHouseColumn<string | null> {
    return lowCardinalityNullableString(name);
}

/**
 * Country code column (Enum8 with common country codes)
 * @param name - Column name
 */
export function countryCode(name: string): ClickHouseColumn<string> {
    return enum8(name, ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'AU', 'RU', 'KR', 'OTHER']);
}

/**
 * Nullable country code column
 * @param name - Column name
 */
export function nullableCountryCode(name: string): ClickHouseColumn<string | null> {
    return nullableEnum8(name, ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'AU', 'RU', 'KR', 'OTHER']);
}

/**
 * Status column (Enum8 with common statuses)
 * @param name - Column name
 */
export function status<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T> {
    return enum8(name, values);
}

/**
 * Nullable status column
 * @param name - Column name
 * @param values - Array of possible status values
 */
export function nullableStatus<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T | null> {
    return nullableEnum8(name, values);
}

/**
 * Common status values for reference
 */
export const COMMON_STATUSES = {
    ACTIVE: 'active' as const,
    INACTIVE: 'inactive' as const,
    PENDING: 'pending' as const,
    COMPLETED: 'completed' as const,
    FAILED: 'failed' as const,
    CANCELLED: 'cancelled' as const,
    DRAFT: 'draft' as const,
    PUBLISHED: 'published' as const,
    ARCHIVED: 'archived' as const,
    DELETED: 'deleted' as const,
} as const;

/**
 * Create a status column with common predefined values
 * @param name - Column name
 * @param customValues - Optional custom status values
 */
export function commonStatus(
    name: string,
    customValues?: readonly string[]
): ClickHouseColumn<string> {
    const values = customValues || Object.values(COMMON_STATUSES);
    return enum8(name, values);
}

/**
 * Create a nullable status column with common predefined values
 * @param name - Column name
 * @param customValues - Optional custom status values
 */
export function nullableCommonStatus(
    name: string,
    customValues?: readonly string[]
): ClickHouseColumn<string | null> {
    const values = customValues || Object.values(COMMON_STATUSES);
    return nullableEnum8(name, values);
}

// =============================================================================
// TIMESTAMP HELPERS
// =============================================================================

/**
 * Created at timestamp column (DateTime with default now())
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export function createdAt(name: string = 'created_at', timezone?: string): ClickHouseColumn<string> {
    const col = new ClickHouseColumn<string>(name, timezone ? `DateTime('${timezone}')` : 'DateTime');
    return col.default(sql`now()`);
}

/**
 * Updated at timestamp column (DateTime with default now() and on update)
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export function updatedAt(name: string = 'updated_at', timezone?: string): ClickHouseColumn<string> {
    const col = new ClickHouseColumn<string>(name, timezone ? `DateTime('${timezone}')` : 'DateTime');
    return col.default(sql`now()`);
}

/**
 * Deleted at timestamp column (nullable DateTime for soft deletes)
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export function deletedAt(name: string = 'deleted_at', timezone?: string): ClickHouseColumn<string | null> {
    const col = new ClickHouseColumn<string | null>(name, timezone ? `DateTime('${timezone}')` : 'DateTime', true);
    return col.nullable();
}

// =============================================================================
// ID HELPERS
// =============================================================================

/**
 * Auto-generated UUID primary key
 * @param name - Column name
 */
export function uuidPrimaryKey(name: string = 'id'): ClickHouseColumn<string> {
    return new ClickHouseColumn<string>(name, 'UUID').autoGenerate().primaryKey();
}

/**
 * Auto-generated UUID primary key with low cardinality (for distributed systems)
 * @param name - Column name
 */
export function lowCardinalityUuidPrimaryKey(name: string = 'id'): ClickHouseColumn<string> {
    const col = new ClickHouseColumn<string>(name, 'LowCardinality(UUID)');
    return col.autoGenerate().primaryKey();
}

/**
 * Sequential integer primary key
 * @param name - Column name
 */
export function int32PrimaryKey(name: string = 'id'): ClickHouseColumn<number> {
    return new ClickHouseColumn<number>(name, 'Int32').primaryKey();
}

/**
 * Sequential big integer primary key
 * @param name - Column name
 */
export function int64PrimaryKey(name: string = 'id'): ClickHouseColumn<number> {
    return new ClickHouseColumn<number>(name, 'Int64').primaryKey();
}