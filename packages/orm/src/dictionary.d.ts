/**
 * HouseKit Dictionary DSL - Type-Safe ClickHouse Dictionaries
 *
 * Dictionaries are ClickHouse's way of doing ultra-fast key-value lookups.
 * They're loaded into memory and are much faster than JOINs for lookup tables.
 *
 * Standard ORMs often lack concept of dictionaries - this is a significant advantage for HouseKit.
 */
import { type TableColumns } from './table';
import { type SQLExpression } from './expressions';
/**
 * Dictionary source from ClickHouse table
 */
export interface ClickHouseSource {
    type: 'clickhouse';
    /** Database name (optional, defaults to current) */
    database?: string;
    /** Table name */
    table: string;
    /** Custom query (alternative to table) */
    query?: string;
    /** Invalidate query - returns value that changes when dictionary should be reloaded */
    invalidateQuery?: string;
    /** Update field - only reload rows where this field changed */
    updateField?: string;
}
/**
 * Dictionary source from MySQL
 */
export interface MySQLSource {
    type: 'mysql';
    host: string;
    port: number;
    database: string;
    table: string;
    user: string;
    password: string;
    query?: string;
    invalidateQuery?: string;
}
/**
 * Dictionary source from PostgreSQL
 */
export interface PostgreSQLSource {
    type: 'postgresql';
    host: string;
    port: number;
    database: string;
    table: string;
    user: string;
    password: string;
    query?: string;
    invalidateQuery?: string;
}
/**
 * Dictionary source from HTTP endpoint
 */
export interface HTTPSource {
    type: 'http';
    url: string;
    format: 'TabSeparated' | 'CSV' | 'JSONEachRow' | string;
    credentials?: {
        user: string;
        password: string;
    };
    headers?: Record<string, string>;
}
/**
 * Dictionary source from executable
 */
export interface ExecutableSource {
    type: 'executable';
    command: string;
    format: 'TabSeparated' | 'CSV' | 'JSONEachRow' | string;
    /** Send dictionary content to stdin for pool updates */
    sendInitalTables?: boolean;
}
/**
 * Dictionary source from file
 */
export interface FileSource {
    type: 'file';
    path: string;
    format: 'TabSeparated' | 'CSV' | 'JSONEachRow' | string;
}
/**
 * Union of all dictionary source types
 */
export type DictionarySource = ClickHouseSource | MySQLSource | PostgreSQLSource | HTTPSource | ExecutableSource | FileSource;
/**
 * Flat layout - for small dictionaries with numeric keys (0 to N)
 * Extremely fast but memory intensive for sparse keys
 */
export interface FlatLayout {
    type: 'flat';
    /** Initial array size */
    initialArraySize?: number;
    /** Max array size - will fail if key exceeds this */
    maxArraySize?: number;
}
/**
 * Hashed layout - for dictionaries with any key type
 * Good balance of speed and memory for most use cases
 */
export interface HashedLayout {
    type: 'hashed';
    /** Pre-allocate memory for this many elements */
    preallocate?: number;
}
/**
 * Sparse hashed layout - uses less memory than hashed for sparse data
 */
export interface SparseHashedLayout {
    type: 'sparse_hashed';
    preallocate?: number;
}
/**
 * Complex key hashed - for dictionaries with composite keys
 */
export interface ComplexKeyHashedLayout {
    type: 'complex_key_hashed';
    preallocate?: number;
}
/**
 * Range hashed - for time-range lookups
 * Key + validity range (start/end dates)
 */
export interface RangeHashedLayout {
    type: 'range_hashed';
    /** Column containing range start */
    rangeMin: string;
    /** Column containing range end */
    rangeMax: string;
}
/**
 * Cache layout - LRU cache for very large dictionaries
 * Only stores recently accessed values
 */
export interface CacheLayout {
    type: 'cache';
    /** Cache size in cells */
    sizeInCells: number;
}
/**
 * IP Trie layout - optimized for IP address lookups
 * Uses CIDR notation
 */
export interface IPTrieLayout {
    type: 'ip_trie';
}
/**
 * Direct layout - stores data in a linear array indexed by key
 */
export interface DirectLayout {
    type: 'direct';
}
/**
 * Union of all layout types
 */
export type DictionaryLayout = FlatLayout | HashedLayout | SparseHashedLayout | ComplexKeyHashedLayout | RangeHashedLayout | CacheLayout | IPTrieLayout | DirectLayout;
/**
 * Lifetime configuration for dictionary reload
 */
export interface DictionaryLifetime {
    /** Minimum seconds before checking for updates */
    min: number;
    /** Maximum seconds before forcing reload */
    max: number;
}
/**
 * Primary/ID key configuration
 */
export interface DictionaryKey {
    /** Key columns */
    columns: string[];
    /** Whether key is hierarchical */
    isHierarchical?: boolean;
}
/**
 * Full dictionary configuration
 */
export interface DictionaryOptions<TCols extends TableColumns> {
    /** Data source configuration */
    source: DictionarySource;
    /** Memory layout */
    layout: DictionaryLayout;
    /** Reload lifetime */
    lifetime: number | DictionaryLifetime;
    /** Primary key column(s) */
    primaryKey: keyof TCols | (keyof TCols)[];
    /** Cluster to create dictionary on */
    onCluster?: string;
}
/**
 * Dictionary definition with helper methods
 */
export interface DictionaryDefinition<TCols extends TableColumns> {
    $dict: string;
    $columns: TCols;
    $options: DictionaryOptions<TCols>;
    /**
     * Get a value from the dictionary using dictGet
     *
     * @example
     * ```typescript
     * // Get user's country by ID
     * userDict.get('country', userId)
     * // Generates: dictGet('user_dict', 'country', user_id)
     * ```
     */
    get<TCol extends keyof TCols & string>(column: TCol, ...keyValues: (SQLExpression | string | number)[]): SQLExpression;
    /**
     * Get a value with a default if key not found
     */
    getOrDefault<TCol extends keyof TCols & string>(column: TCol, defaultValue: any, ...keyValues: (SQLExpression | string | number)[]): SQLExpression;
    /**
     * Check if a key exists in the dictionary
     */
    has(...keyValues: (SQLExpression | string | number)[]): SQLExpression;
    /**
     * Get child keys for hierarchical dictionaries
     */
    getChildren(...keyValues: (SQLExpression | string | number)[]): SQLExpression;
    /**
     * Get ancestor at level N for hierarchical dictionaries
     */
    getAncestor(keyValue: SQLExpression | string | number, level: number): SQLExpression;
    /**
     * Generate CREATE DICTIONARY statement
     */
    toSQL(): string;
}
/**
 * Create a type-safe ClickHouse dictionary definition.
 *
 * @example
 * ```typescript
 * import { chDictionary, uint32, text, Engine } from '@housekit/orm';
 *
 * // Define a user lookup dictionary
 * const userDict = chDictionary('user_dict', {
 *   id: uint32('id'),
 *   name: text('name'),
 *   country: text('country'),
 * }, {
 *   source: {
 *     type: 'clickhouse',
 *     table: 'users',
 *   },
 *   layout: { type: 'hashed' },
 *   lifetime: 3600, // Reload every hour
 *   primaryKey: 'id',
 * });
 *
 * // Use in queries - much faster than JOIN!
 * const query = db.select({
 *   eventType: events.event_type,
 *   userName: userDict.get('name', events.user_id),
 *   userCountry: userDict.get('country', events.user_id),
 * }).from(events);
 * ```
 */
export declare function chDictionary<TCols extends TableColumns>(name: string, columns: TCols, options: DictionaryOptions<TCols>): DictionaryDefinition<TCols>;
