export type JsonValue = Record<string, any> | any[];
import { ClickHouseColumn } from '../column';
/**
 * Low cardinality string column (very common for dimensions)
 * @param name - Column name
 */
export declare function lowCardinalityString(name: string): ClickHouseColumn<string>;
/**
 * Low cardinality nullable string column
 * @param name - Column name
 */
export declare function lowCardinalityNullableString(name: string): ClickHouseColumn<string | null>;
/**
 * Nullable JSON column
 * @param name - Column name
 */
export declare function nullableJson(name: string): ClickHouseColumn<JsonValue | null>;
/**
 * Low cardinality JSON column
 * @param name - Column name
 */
export declare function lowCardinalityJson(name: string): ClickHouseColumn<JsonValue>;
/**
 * Low cardinality nullable JSON column
 * @param name - Column name
 */
export declare function lowCardinalityNullableJson(name: string): ClickHouseColumn<JsonValue | null>;
/**
 * Create an Enum8 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export declare function enum8<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T>;
/**
 * Create a nullable Enum8 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export declare function nullableEnum8<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T | null>;
/**
 * Create an Enum16 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export declare function enum16<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T>;
/**
 * Create a nullable Enum16 column with TypeScript union type support
 * @param name - Column name
 * @param values - Array of possible values
 */
export declare function nullableEnum16<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T | null>;
/**
 * Array of strings with low cardinality
 * @param name - Column name
 */
export declare function lowCardinalityStringArray(name: string): ClickHouseColumn<string[]>;
/**
 * Nullable array of strings
 * @param name - Column name
 */
export declare function nullableStringArray(name: string): ClickHouseColumn<string[] | null>;
/**
 * Array of nullable strings
 * @param name - Column name
 */
export declare function stringNullableArray(name: string): ClickHouseColumn<(string | null)[]>;
/**
 * Array of integers with low cardinality
 * @param name - Column name
 */
export declare function lowCardinalityInt32Array(name: string): ClickHouseColumn<number[]>;
/**
 * Email column (low cardinality string)
 * @param name - Column name
 */
export declare function email(name: string): ClickHouseColumn<string>;
/**
 * Nullable email column
 * @param name - Column name
 */
export declare function nullableEmail(name: string): ClickHouseColumn<string | null>;
/**
 * Phone number column (low cardinality string)
 * @param name - Column name
 */
export declare function phone(name: string): ClickHouseColumn<string>;
/**
 * Nullable phone number column
 * @param name - Column name
 */
export declare function nullablePhone(name: string): ClickHouseColumn<string | null>;
/**
 * Country code column (Enum8 with common country codes)
 * @param name - Column name
 */
export declare function countryCode(name: string): ClickHouseColumn<string>;
/**
 * Nullable country code column
 * @param name - Column name
 */
export declare function nullableCountryCode(name: string): ClickHouseColumn<string | null>;
/**
 * Status column (Enum8 with common statuses)
 * @param name - Column name
 */
export declare function status<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T>;
/**
 * Nullable status column
 * @param name - Column name
 * @param values - Array of possible status values
 */
export declare function nullableStatus<T extends string>(name: string, values: readonly T[]): ClickHouseColumn<T | null>;
/**
 * Common status values for reference
 */
export declare const COMMON_STATUSES: {
    readonly ACTIVE: "active";
    readonly INACTIVE: "inactive";
    readonly PENDING: "pending";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
    readonly DRAFT: "draft";
    readonly PUBLISHED: "published";
    readonly ARCHIVED: "archived";
    readonly DELETED: "deleted";
};
/**
 * Create a status column with common predefined values
 * @param name - Column name
 * @param customValues - Optional custom status values
 */
export declare function commonStatus(name: string, customValues?: readonly string[]): ClickHouseColumn<string>;
/**
 * Create a nullable status column with common predefined values
 * @param name - Column name
 * @param customValues - Optional custom status values
 */
export declare function nullableCommonStatus(name: string, customValues?: readonly string[]): ClickHouseColumn<string | null>;
/**
 * Created at timestamp column (DateTime with default now())
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export declare function createdAt(name?: string, timezone?: string): ClickHouseColumn<string>;
/**
 * Updated at timestamp column (DateTime with default now() and on update)
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export declare function updatedAt(name?: string, timezone?: string): ClickHouseColumn<string>;
/**
 * Deleted at timestamp column (nullable DateTime for soft deletes)
 * @param name - Column name
 * @param timezone - Optional timezone
 */
export declare function deletedAt(name?: string, timezone?: string): ClickHouseColumn<string | null>;
/**
 * Auto-generated UUID primary key
 * @param name - Column name
 */
export declare function uuidPrimaryKey(name?: string): ClickHouseColumn<string>;
/**
 * Auto-generated UUID primary key with low cardinality (for distributed systems)
 * @param name - Column name
 */
export declare function lowCardinalityUuidPrimaryKey(name?: string): ClickHouseColumn<string>;
/**
 * Sequential integer primary key
 * @param name - Column name
 */
export declare function int32PrimaryKey(name?: string): ClickHouseColumn<number>;
/**
 * Sequential big integer primary key
 * @param name - Column name
 */
export declare function int64PrimaryKey(name?: string): ClickHouseColumn<number>;
