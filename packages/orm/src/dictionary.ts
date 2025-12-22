/**
 * HouseKit Dictionary DSL - Type-Safe ClickHouse Dictionaries
 * 
 * Dictionaries are ClickHouse's way of doing ultra-fast key-value lookups.
 * They're loaded into memory and are much faster than JOINs for lookup tables.
 * 
 * Standard ORMs often lack concept of dictionaries - this is a significant advantage for HouseKit.
 */

import { ClickHouseColumn } from './column';
import { type TableDefinition, type TableColumns, type TableOptions } from './table';
import { sql, type SQLExpression } from './expressions';

// ============================================================================
// Dictionary Source Types
// ============================================================================

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
export type DictionarySource =
    | ClickHouseSource
    | MySQLSource
    | PostgreSQLSource
    | HTTPSource
    | ExecutableSource
    | FileSource;

// ============================================================================
// Dictionary Layout Types
// ============================================================================

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
export type DictionaryLayout =
    | FlatLayout
    | HashedLayout
    | SparseHashedLayout
    | ComplexKeyHashedLayout
    | RangeHashedLayout
    | CacheLayout
    | IPTrieLayout
    | DirectLayout;

// ============================================================================
// Dictionary Configuration
// ============================================================================

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

// ============================================================================
// Dictionary Definition Type
// ============================================================================

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
    get<TCol extends keyof TCols & string>(
        column: TCol,
        ...keyValues: (SQLExpression | string | number)[]
    ): SQLExpression;

    /**
     * Get a value with a default if key not found
     */
    getOrDefault<TCol extends keyof TCols & string>(
        column: TCol,
        defaultValue: any,
        ...keyValues: (SQLExpression | string | number)[]
    ): SQLExpression;

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
    getAncestor(
        keyValue: SQLExpression | string | number,
        level: number
    ): SQLExpression;

    /**
     * Generate CREATE DICTIONARY statement
     */
    toSQL(): string;
}

// ============================================================================
// Factory Function
// ============================================================================

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
export function chDictionary<TCols extends TableColumns>(
    name: string,
    columns: TCols,
    options: DictionaryOptions<TCols>
): DictionaryDefinition<TCols> {
    // Normalize primary key to array
    const primaryKeys = Array.isArray(options.primaryKey)
        ? options.primaryKey
        : [options.primaryKey];

    // Helper to format key values for dictGet
    const formatKeyValues = (keyValues: (SQLExpression | string | number)[]): string => {
        const parts = keyValues.map((v, i) => {
            if (typeof v === 'string') {
                return `'${v}'`;
            } else if (typeof v === 'number') {
                return String(v);
            } else {
                // SQLExpression
                const result = v.toSQL();
                return result.sql;
            }
        });

        // For composite keys, wrap in tuple
        return primaryKeys.length > 1 ? `(${parts.join(', ')})` : parts[0];
    };

    const definition: DictionaryDefinition<TCols> = {
        $dict: name,
        $columns: columns,
        $options: options,

        get<TCol extends keyof TCols & string>(
            column: TCol,
            ...keyValues: (SQLExpression | string | number)[]
        ): SQLExpression {
            const keyStr = formatKeyValues(keyValues);
            return sql`dictGet('${name}', '${column}', ${sql.raw(keyStr)})` as SQLExpression;
        },

        getOrDefault<TCol extends keyof TCols & string>(
            column: TCol,
            defaultValue: any,
            ...keyValues: (SQLExpression | string | number)[]
        ): SQLExpression {
            const keyStr = formatKeyValues(keyValues);
            const defaultStr = typeof defaultValue === 'string' ? `'${defaultValue}'` : String(defaultValue);
            return sql`dictGetOrDefault('${name}', '${column}', ${sql.raw(keyStr)}, ${sql.raw(defaultStr)})` as SQLExpression;
        },

        has(...keyValues: (SQLExpression | string | number)[]): SQLExpression {
            const keyStr = formatKeyValues(keyValues);
            return sql`dictHas('${name}', ${sql.raw(keyStr)})` as SQLExpression;
        },

        getChildren(...keyValues: (SQLExpression | string | number)[]): SQLExpression {
            const keyStr = formatKeyValues(keyValues);
            return sql`dictGetChildren('${name}', ${sql.raw(keyStr)})` as SQLExpression;
        },

        getAncestor(
            keyValue: SQLExpression | string | number,
            level: number
        ): SQLExpression {
            const keyStr = formatKeyValues([keyValue]);
            return sql`dictGetHierarchy('${name}', ${sql.raw(keyStr)})[${level}]` as SQLExpression;
        },

        toSQL(): string {
            const parts: string[] = [];

            // CREATE DICTIONARY
            parts.push(`CREATE DICTIONARY IF NOT EXISTS \`${name}\``);

            // ON CLUSTER
            if (options.onCluster) {
                parts.push(`ON CLUSTER ${options.onCluster}`);
            }

            // Columns definition
            const colDefs = Object.entries(columns).map(([key, col]) => {
                const column = col as ClickHouseColumn;
                const isPrimaryKey = primaryKeys.includes(key as keyof TCols);
                return `\`${column.name}\` ${column.type}${isPrimaryKey ? '' : ' DEFAULT \'\''}`;
            });
            parts.push(`(${colDefs.join(', ')})`);

            // PRIMARY KEY
            const pkCols = primaryKeys.map(k => `\`${String(k)}\``).join(', ');
            parts.push(`PRIMARY KEY ${primaryKeys.length > 1 ? `(${pkCols})` : pkCols}`);

            // SOURCE
            parts.push(`SOURCE(${renderSource(options.source)})`);

            // LAYOUT
            parts.push(`LAYOUT(${renderLayout(options.layout)})`);

            // LIFETIME
            const lifetime = typeof options.lifetime === 'number'
                ? { min: options.lifetime, max: options.lifetime }
                : options.lifetime;
            parts.push(`LIFETIME(MIN ${lifetime.min} MAX ${lifetime.max})`);

            return parts.join(' ');
        }
    };

    return definition;
}

// ============================================================================
// SQL Rendering Helpers
// ============================================================================

function renderSource(source: DictionarySource): string {
    switch (source.type) {
        case 'clickhouse': {
            const parts: string[] = [];
            if (source.database) parts.push(`DB '${source.database}'`);
            if (source.table) parts.push(`TABLE '${source.table}'`);
            if (source.query) parts.push(`QUERY '${source.query}'`);
            if (source.invalidateQuery) parts.push(`INVALIDATE_QUERY '${source.invalidateQuery}'`);
            if (source.updateField) parts.push(`UPDATE_FIELD ${source.updateField}`);
            return `CLICKHOUSE(${parts.join(' ')})`;
        }

        case 'mysql': {
            const parts = [
                `HOST '${source.host}'`,
                `PORT ${source.port}`,
                `DB '${source.database}'`,
                `TABLE '${source.table}'`,
                `USER '${source.user}'`,
                `PASSWORD '${source.password}'`
            ];
            if (source.query) parts.push(`QUERY '${source.query}'`);
            return `MYSQL(${parts.join(' ')})`;
        }

        case 'postgresql': {
            const parts = [
                `HOST '${source.host}'`,
                `PORT ${source.port}`,
                `DB '${source.database}'`,
                `TABLE '${source.table}'`,
                `USER '${source.user}'`,
                `PASSWORD '${source.password}'`
            ];
            if (source.query) parts.push(`QUERY '${source.query}'`);
            return `POSTGRESQL(${parts.join(' ')})`;
        }

        case 'http': {
            const parts = [`URL '${source.url}'`, `FORMAT ${source.format}`];
            if (source.credentials) {
                parts.push(`USER '${source.credentials.user}'`);
                parts.push(`PASSWORD '${source.credentials.password}'`);
            }
            return `HTTP(${parts.join(' ')})`;
        }

        case 'executable': {
            return `EXECUTABLE(COMMAND '${source.command}' FORMAT ${source.format})`;
        }

        case 'file': {
            return `FILE(PATH '${source.path}' FORMAT ${source.format})`;
        }

        default:
            throw new Error(`Unknown dictionary source type: ${(source as any).type}`);
    }
}

function renderLayout(layout: DictionaryLayout): string {
    switch (layout.type) {
        case 'flat': {
            const opts: string[] = [];
            if (layout.initialArraySize) opts.push(`INITIAL_ARRAY_SIZE ${layout.initialArraySize}`);
            if (layout.maxArraySize) opts.push(`MAX_ARRAY_SIZE ${layout.maxArraySize}`);
            return opts.length > 0 ? `FLAT(${opts.join(' ')})` : 'FLAT()';
        }

        case 'hashed':
            return layout.preallocate ? `HASHED(PREALLOCATE ${layout.preallocate})` : 'HASHED()';

        case 'sparse_hashed':
            return layout.preallocate ? `SPARSE_HASHED(PREALLOCATE ${layout.preallocate})` : 'SPARSE_HASHED()';

        case 'complex_key_hashed':
            return layout.preallocate ? `COMPLEX_KEY_HASHED(PREALLOCATE ${layout.preallocate})` : 'COMPLEX_KEY_HASHED()';

        case 'range_hashed':
            return `RANGE_HASHED(RANGE_MIN ${layout.rangeMin} RANGE_MAX ${layout.rangeMax})`;

        case 'cache':
            return `CACHE(SIZE_IN_CELLS ${layout.sizeInCells})`;

        case 'ip_trie':
            return 'IP_TRIE()';

        case 'direct':
            return 'DIRECT()';

        default:
            throw new Error(`Unknown dictionary layout type: ${(layout as any).type}`);
    }
}
