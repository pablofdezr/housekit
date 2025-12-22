/**
 * HouseKit External Data Sources - Type-Safe External Table Functions
 *
 * ClickHouse can query external data sources directly in SQL.
 * These helpers create virtual table references that can be used in JOINs.
 *
 * Standard ORMs often lack support for this - HouseKit's Data Gravity approach
 * moves computation to ClickHouse instead of downloading data to Node.js.
 */
import { type TableColumns, type TableOptions } from './table';
/**
 * External table that can be used in FROM/JOIN clauses
 */
export interface ExternalTableDefinition<TCols extends TableColumns = TableColumns> {
    $table: string;
    $columns: TCols;
    $options: TableOptions & {
        externallyManaged: true;
        kind: 'external';
    };
    /**
     * External tables don't have CREATE statements
     */
    toSQL(): string;
}
/**
 * S3 file format options
 */
export type S3Format = 'CSV' | 'CSVWithNames' | 'TSV' | 'TabSeparated' | 'TabSeparatedWithNames' | 'JSONEachRow' | 'JSON' | 'JSONCompact' | 'Parquet' | 'ORC' | 'Arrow' | 'Avro' | 'Native';
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
    table: string | {
        schema: string;
        table: string;
    };
    user: string;
    password: string;
}
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
export declare function s3<TCols extends TableColumns = {}>(config: ExternalS3Config, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create an S3 Cluster external table (for distributed reading)
 */
export declare function s3Cluster<TCols extends TableColumns = {}>(clusterName: string, config: ExternalS3Config, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create a URL external table reference.
 */
export declare function url<TCols extends TableColumns = {}>(config: ExternalURLConfig, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create a File external table reference.
 */
export declare function file<TCols extends TableColumns = {}>(config: ExternalFileConfig, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create an HDFS external table reference.
 */
export declare function hdfs<TCols extends TableColumns = {}>(config: HDFSConfig, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create a MySQL external table reference.
 *
 * @warning **SECURITY WARNING**: This includes the password in plain text in the generated SQL.
 * The password will be stored in plain text in ClickHouse's `system.query_log` unless you have
 * configured query masking on the server. Ensure you use a read-only user with minimal permissions.
 */
export declare function mysql<TCols extends TableColumns = {}>(config: MySQLExternalConfig, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create a PostgreSQL external table reference.
 *
 * @warning **SECURITY WARNING**: This includes the password in plain text in the generated SQL.
 * The password will be stored in plain text in ClickHouse's `system.query_log` unless you have
 * configured query masking on the server. Ensure you use a read-only user with minimal permissions.
 */
export declare function postgresql<TCols extends TableColumns = {}>(config: PostgreSQLExternalConfig, columns?: TCols): ExternalTableDefinition<TCols> & TCols;
/**
 * Create an inline VALUES table (useful for small lookup tables in queries)
 */
export declare function values<T extends Record<string, any>>(data: T[], structure: string): ExternalTableDefinition;
/**
 * Create a Numbers table function (generates sequence of numbers)
 */
export declare function numbers(count: number, offset?: number): ExternalTableDefinition;
/**
 * Create a generateRandom table function
 */
export declare function generateRandom(structure: string, randomSeed?: number, maxStringLength?: number, maxArrayLength?: number): ExternalTableDefinition;
