/**
 * HouseKit External Data Sources - Type-Safe External Table Functions
 * 
 * ClickHouse can query external data sources directly in SQL.
 * These helpers create virtual table references that can be used in JOINs.
 * 
 * Standard ORMs often lack support for this - HouseKit's Data Gravity approach
 * moves computation to ClickHouse instead of downloading data to Node.js.
 */

import { ClickHouseColumn } from './column';
import { type TableDefinition, type TableColumns, type TableOptions } from './table';
import type { SQLExpression } from './expressions';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * External table that can be used in FROM/JOIN clauses
 */
export interface ExternalTableDefinition<TCols extends TableColumns = TableColumns> {
    $table: string;
    $columns: TCols;
    $options: TableOptions & { externallyManaged: true; kind: 'external' };
    /**
     * External tables don't have CREATE statements
     */
    toSQL(): string;
}

/**
 * S3 file format options
 */
export type S3Format =
    | 'CSV' | 'CSVWithNames'
    | 'TSV' | 'TabSeparated' | 'TabSeparatedWithNames'
    | 'JSONEachRow' | 'JSON' | 'JSONCompact'
    | 'Parquet' | 'ORC' | 'Arrow' | 'Avro'
    | 'Native';

/**
 * S3 compression options
 */
export type S3Compression = 'none' | 'gzip' | 'br' | 'xz' | 'zstd' | 'lz4' | 'bz2';

/**
 * S3 access configuration for external table functions
 */
export interface ExternalS3Config {
    /** S3 bucket URL with path pattern (supports wildcards) */
    url: string;
    /** AWS access key (optional if using IAM roles) */
    accessKeyId?: string;
    /** AWS secret key (optional if using IAM roles) */
    secretAccessKey?: string;
    /** File format */
    format?: S3Format;
    /** Structure definition for the file (e.g., 'id UInt32, name String') */
    structure?: string;
    /** Compression type */
    compression?: S3Compression;
}

/**
 * URL source configuration (for HTTP endpoints)
 */
export interface ExternalURLConfig {
    /** URL to fetch data from */
    url: string;
    /** File format */
    format: S3Format;
    /** Structure definition */
    structure?: string;
    /** HTTP headers */
    headers?: Record<string, string>;
}

/**
 * File source configuration (for local/mounted files)
 */
export interface ExternalFileConfig {
    /** File path pattern (supports wildcards) */
    path: string;
    /** File format */
    format: S3Format;
    /** Structure definition */
    structure?: string;
}

/**
 * HDFS configuration
 */
export interface HDFSConfig {
    /** HDFS URL */
    url: string;
    /** File format */
    format: S3Format;
    /** Structure definition */
    structure?: string;
}

/**
 * MySQL external table configuration
 */
export interface MySQLExternalConfig {
    host: string;
    port?: number;
    database: string;
    table: string;
    user: string;
    password: string;
}

/**
 * PostgreSQL external table configuration
 */
export interface PostgreSQLExternalConfig {
    host: string;
    port?: number;
    database: string;
    table: string | { schema: string; table: string };
    user: string;
    password: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an S3 external table reference for use in queries.
 * 
 * @example
 * ```typescript
 * import { s3, eq, sql } from '@housekit/orm';
 * 
 * // Define external S3 data
 * const externalUsers = s3({
 *   url: 's3://my-bucket/users/*.parquet',
 *   format: 'Parquet',
 * });
 * 
 * // Use in a JOIN - ClickHouse reads S3 directly!
 * const query = db.select({
 *   eventType: events.event_type,
 *   userName: sql`externalUsers.name`,
 * })
 * .from(events)
 * .innerJoin(externalUsers, eq(events.user_id, sql`externalUsers.id`));
 * ```
 */
export function s3<TCols extends TableColumns = {}>(
    config: ExternalS3Config,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const parts: string[] = [`'${config.url}'`];

    if (config.accessKeyId && config.secretAccessKey) {
        parts.push(`'${config.accessKeyId}'`);
        parts.push(`'${config.secretAccessKey}'`);
    }

    if (config.format) {
        parts.push(`'${config.format}'`);
    }

    if (config.structure) {
        parts.push(`'${config.structure}'`);
    }

    if (config.compression && config.compression !== 'none') {
        parts.push(`'${config.compression}'`);
    }

    const tableName = `s3(${parts.join(', ')})`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: ${tableName}`,
    };

    // Add columns as direct properties
    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create an S3 Cluster external table (for distributed reading)
 */
export function s3Cluster<TCols extends TableColumns = {}>(
    clusterName: string,
    config: ExternalS3Config,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const parts: string[] = [`'${clusterName}'`, `'${config.url}'`];

    if (config.accessKeyId && config.secretAccessKey) {
        parts.push(`'${config.accessKeyId}'`);
        parts.push(`'${config.secretAccessKey}'`);
    }

    if (config.format) {
        parts.push(`'${config.format}'`);
    }

    if (config.structure) {
        parts.push(`'${config.structure}'`);
    }

    const tableName = `s3Cluster(${parts.join(', ')})`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: ${tableName}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create a URL external table reference.
 */
export function url<TCols extends TableColumns = {}>(
    config: ExternalURLConfig,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const parts: string[] = [`'${config.url}'`, `'${config.format}'`];

    if (config.structure) {
        parts.push(`'${config.structure}'`);
    }

    const tableName = `url(${parts.join(', ')})`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: ${tableName}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create a File external table reference.
 */
export function file<TCols extends TableColumns = {}>(
    config: ExternalFileConfig,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const parts: string[] = [`'${config.path}'`, `'${config.format}'`];

    if (config.structure) {
        parts.push(`'${config.structure}'`);
    }

    const tableName = `file(${parts.join(', ')})`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: ${tableName}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create an HDFS external table reference.
 */
export function hdfs<TCols extends TableColumns = {}>(
    config: HDFSConfig,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const parts: string[] = [`'${config.url}'`, `'${config.format}'`];

    if (config.structure) {
        parts.push(`'${config.structure}'`);
    }

    const tableName = `hdfs(${parts.join(', ')})`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: ${tableName}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create a MySQL external table reference.
 * 
 * @warning **SECURITY WARNING**: This includes the password in plain text in the generated SQL.
 * The password will be stored in plain text in ClickHouse's `system.query_log` unless you have 
 * configured query masking on the server. Ensure you use a read-only user with minimal permissions.
 */
export function mysql<TCols extends TableColumns = {}>(
    config: MySQLExternalConfig,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const port = config.port || 3306;
    const tableName = `mysql('${config.host}:${port}', '${config.database}', '${config.table}', '${config.user}', '${config.password}')`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: MySQL ${config.database}.${config.table}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create a PostgreSQL external table reference.
 * 
 * @warning **SECURITY WARNING**: This includes the password in plain text in the generated SQL.
 * The password will be stored in plain text in ClickHouse's `system.query_log` unless you have 
 * configured query masking on the server. Ensure you use a read-only user with minimal permissions.
 */
export function postgresql<TCols extends TableColumns = {}>(
    config: PostgreSQLExternalConfig,
    columns?: TCols
): ExternalTableDefinition<TCols> & TCols {
    const port = config.port || 5432;
    const table = typeof config.table === 'string'
        ? config.table
        : `${config.table.schema}.${config.table.table}`;

    const tableName = `postgresql('${config.host}:${port}', '${config.database}', '${table}', '${config.user}', '${config.password}')`;

    const definition: ExternalTableDefinition<TCols> = {
        $table: tableName,
        $columns: (columns || {}) as TCols,
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- External table: PostgreSQL ${config.database}.${table}`,
    };

    if (columns) {
        for (const [key, col] of Object.entries(columns)) {
            (definition as any)[key] = col;
        }
    }

    return definition as ExternalTableDefinition<TCols> & TCols;
}

/**
 * Create an inline VALUES table (useful for small lookup tables in queries)
 */
export function values<T extends Record<string, any>>(
    data: T[],
    structure: string
): ExternalTableDefinition {
    if (data.length === 0) {
        throw new Error('values() requires at least one row');
    }

    const rows = data.map(row => {
        const values = Object.values(row).map(v => {
            if (typeof v === 'string') return `'${v}'`;
            if (v === null) return 'NULL';
            return String(v);
        });
        return `(${values.join(', ')})`;
    });

    const tableName = `VALUES('${structure}') VALUES ${rows.join(', ')}`;

    return {
        $table: tableName,
        $columns: {},
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- Inline VALUES table`,
    };
}

/**
 * Create a Numbers table function (generates sequence of numbers)
 */
export function numbers(count: number, offset = 0): ExternalTableDefinition {
    const tableName = offset > 0
        ? `numbers(${offset}, ${count})`
        : `numbers(${count})`;

    return {
        $table: tableName,
        $columns: {},
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- Numbers table: ${count} rows`,
    };
}

/**
 * Create a generateRandom table function
 */
export function generateRandom(
    structure: string,
    randomSeed?: number,
    maxStringLength = 10,
    maxArrayLength = 10
): ExternalTableDefinition {
    const parts = [`'${structure}'`];
    if (randomSeed !== undefined) parts.push(String(randomSeed));
    parts.push(String(maxStringLength));
    parts.push(String(maxArrayLength));

    const tableName = `generateRandom(${parts.join(', ')})`;

    return {
        $table: tableName,
        $columns: {},
        $options: {
            externallyManaged: true,
            kind: 'external' as const
        } as TableOptions & { externallyManaged: true; kind: 'external' },
        toSQL: () => `-- Random data generator`,
    };
}
