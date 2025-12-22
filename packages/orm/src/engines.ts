/**
 * HouseKit Engine DSL - First-class ClickHouse Engine Support
 * 
 * This module provides type-safe engine configurations for ClickHouse tables.
 * Unlike generic ORMs which often treat engines as raw strings, HouseKit validates engine
 * parameters at compile-time and provides intelligent defaults.
 */

import type { TableDefinition, TableColumns } from './table';

// ============================================================================
// Engine Configuration Types
// ============================================================================

/**
 * Base configuration shared by all MergeTree-family engines
 */
export interface MergeTreeBaseConfig {
    /**
     * Experimental: Enable lightweight DELETE/UPDATE operations
     * Requires ClickHouse 23.3+
     */
    enableLightweightDeletes?: boolean;
}

/**
 * Configuration for basic MergeTree engine
 */
export interface MergeTreeConfig extends MergeTreeBaseConfig {
    type: 'MergeTree';
}

/**
 * Configuration for ReplacingMergeTree engine
 * Used for deduplication scenarios where the last version of a row should be kept
 */
export interface ReplacingMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'ReplacingMergeTree';
    /** Column used to determine which row version to keep (newer wins) */
    versionColumn?: string;
    /** 
     * Column indicating if row is deleted (ClickHouse 23.2+)
     * When 1, the row is considered deleted during FINAL merges
     */
    isDeletedColumn?: string;
}

/**
 * Configuration for SummingMergeTree engine
 * Automatically sums numeric columns during merges
 */
export interface SummingMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'SummingMergeTree';
    /** Columns to sum. If empty, sums all numeric columns not in ORDER BY */
    columns?: string[];
}

/**
 * Configuration for AggregatingMergeTree engine
 * Used with AggregateFunction columns for pre-aggregated materialized views
 */
export interface AggregatingMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'AggregatingMergeTree';
}

/**
 * Configuration for CollapsingMergeTree engine
 * Uses a sign column to collapse pairs of rows with opposite signs
 */
export interface CollapsingMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'CollapsingMergeTree';
    /** Column containing 1 or -1 to indicate row state */
    signColumn: string;
}

/**
 * Configuration for VersionedCollapsingMergeTree engine
 * Like CollapsingMergeTree but with version column for more robust deduplication
 */
export interface VersionedCollapsingMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'VersionedCollapsingMergeTree';
    /** Column containing 1 or -1 to indicate row state */
    signColumn: string;
    /** Version column for ordering rows */
    versionColumn: string;
}

/**
 * Configuration for GraphiteMergeTree engine
 * Optimized for storing Graphite metrics data
 */
export interface GraphiteMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'GraphiteMergeTree';
    /** Name of the Graphite rollup configuration */
    configSection: string;
}

/**
 * Configuration for ReplicatedMergeTree engine
 * Provides data replication across ClickHouse cluster nodes
 */
export interface ReplicatedMergeTreeConfig extends MergeTreeBaseConfig {
    type: 'ReplicatedMergeTree';
    /** 
     * Path in ZooKeeper for this table's replication
     * Supports macros: {shard}, {replica}, {database}, {table}
     * @default '/clickhouse/tables/{shard}/{database}/{table}'
     */
    zkPath?: string;
    /** 
     * Unique replica identifier
     * Supports macros: {replica}, {hostname}
     * @default '{replica}'
     */
    replicaName?: string;
    /** Base engine type to replicate (defaults to MergeTree) */
    baseEngine?: 'MergeTree' | 'ReplacingMergeTree' | 'SummingMergeTree' | 'AggregatingMergeTree' | 'CollapsingMergeTree' | 'VersionedCollapsingMergeTree';
    /** Configuration for ReplacingMergeTree base */
    versionColumn?: string;
    isDeletedColumn?: string;
    /** Configuration for SummingMergeTree base */
    sumColumns?: string[];
    /** Configuration for CollapsingMergeTree base */
    signColumn?: string;
}

/**
 * Configuration for Buffer engine
 * Buffers writes in memory before flushing to a target table
 * Excellent for high-throughput insert scenarios
 */
export interface BufferConfig {
    type: 'Buffer';
    /** Database of the target table (use 'currentDatabase()' for same database) */
    database: string;
    /** Name of the target table */
    table: string;
    /** Number of buffer layers (typically 16) */
    layers: number;
    /** Minimum time (seconds) before flush */
    minTime: number;
    /** Maximum time (seconds) before flush */
    maxTime: number;
    /** Minimum rows before flush */
    minRows: number;
    /** Maximum rows before flush */
    maxRows: number;
    /** Minimum bytes before flush */
    minBytes: number;
    /** Maximum bytes before flush */
    maxBytes: number;
}

/**
 * Configuration for Distributed engine
 * Routes queries across a cluster of ClickHouse nodes
 */
export interface DistributedConfig {
    type: 'Distributed';
    /** Cluster name as defined in ClickHouse configuration */
    cluster: string;
    /** Database name on remote servers */
    database: string;
    /** Table name on remote servers */
    table: string;
    /** 
     * Expression to determine which shard receives each row
     * @default 'rand()'
     */
    shardingKey?: string;
    /** Policy name for selecting replicas */
    policyName?: string;
}

/**
 * Configuration for Null engine
 * Data is discarded (useful for testing or as data sink)
 */
export interface NullConfig {
    type: 'Null';
}

/**
 * Configuration for Log engine
 * Simple append-only storage, no indices
 */
export interface LogConfig {
    type: 'Log';
}

/**
 * Configuration for TinyLog engine
 * Like Log but stores each column in a separate file
 */
export interface TinyLogConfig {
    type: 'TinyLog';
}

/**
 * Configuration for Memory engine
 * Stores data in RAM, lost on restart
 */
export interface MemoryConfig {
    type: 'Memory';
    /** Maximum number of rows to store */
    maxRows?: number;
    /** Maximum bytes to store */
    maxBytes?: number;
    /** Compress data in memory */
    compress?: boolean;
}

/**
 * Configuration for Join engine
 * Stores data for JOIN operations
 */
export interface JoinConfig {
    type: 'Join';
    /** Join strictness: any match or all matches */
    strictness: 'Any' | 'All' | 'Semi' | 'Anti';
    /** Join type */
    joinType: 'Inner' | 'Left' | 'Right' | 'Full' | 'Cross';
    /** Key columns for the join */
    keys: string[];
}

/**
 * Configuration for Dictionary engine
 * Wraps a ClickHouse dictionary as a table
 */
export interface DictionaryConfig {
    type: 'Dictionary';
    /** Name of the dictionary */
    dictionaryName: string;
}

/**
 * Configuration for File engine
 * Reads/writes data from/to a file in a specified format
 */
export interface FileConfig {
    type: 'File';
    /** Data format (e.g., 'TabSeparated', 'CSV', 'JSONEachRow') */
    format: string;
    /** Optional: compression type */
    compression?: 'none' | 'gzip' | 'lz4' | 'zstd';
}

/**
 * Configuration for URL engine
 * Reads data from a remote URL
 */
export interface URLConfig {
    type: 'URL';
    /** URL to read from */
    url: string;
    /** Data format */
    format: string;
    /** Optional: compression type */
    compression?: 'none' | 'gzip' | 'lz4' | 'zstd';
}

/**
 * Configuration for S3 engine
 * Reads/writes data to Amazon S3
 */
export interface S3Config {
    type: 'S3';
    /** S3 URL pattern */
    path: string;
    /** Data format */
    format: string;
    /** Optional: AWS access key ID */
    accessKeyId?: string;
    /** Optional: AWS secret access key */
    secretAccessKey?: string;
    /** Optional: compression type */
    compression?: 'none' | 'gzip' | 'lz4' | 'zstd';
}

/**
 * Configuration for Kafka engine
 * Consumes messages from Apache Kafka
 */
export interface KafkaConfig {
    type: 'Kafka';
    /** Kafka broker list */
    brokerList: string;
    /** Topic name(s) */
    topicList: string | string[];
    /** Consumer group ID */
    groupName: string;
    /** Data format for messages */
    format: string;
    /** Number of polling threads */
    numConsumers?: number;
    /** Max rows per poll */
    maxBlockSize?: number;
    /** Skip broken messages */
    skipBroken?: number;
}

/**
 * Configuration for PostgreSQL engine
 * Reads data from PostgreSQL database
 */
export interface PostgreSQLConfig {
    type: 'PostgreSQL';
    /** PostgreSQL host */
    host: string;
    /** PostgreSQL port */
    port: number;
    /** Database name */
    database: string;
    /** Table name */
    table: string;
    /** Username */
    user: string;
    /** Password */
    password: string;
    /** Schema name */
    schema?: string;
}

/**
 * Configuration for MySQL engine
 * Reads data from MySQL database
 */
export interface MySQLConfig {
    type: 'MySQL';
    /** MySQL host */
    host: string;
    /** MySQL port */
    port: number;
    /** Database name */
    database: string;
    /** Table name */
    table: string;
    /** Username */
    user: string;
    /** Password */
    password: string;
}

/**
 * Union type of all supported engine configurations
 */
export type EngineConfiguration =
    // MergeTree family
    | MergeTreeConfig
    | ReplacingMergeTreeConfig
    | SummingMergeTreeConfig
    | AggregatingMergeTreeConfig
    | CollapsingMergeTreeConfig
    | VersionedCollapsingMergeTreeConfig
    | GraphiteMergeTreeConfig
    | ReplicatedMergeTreeConfig
    // Special purpose
    | BufferConfig
    | DistributedConfig
    | NullConfig
    // Log family
    | LogConfig
    | TinyLogConfig
    // In-memory
    | MemoryConfig
    | JoinConfig
    | DictionaryConfig
    // External integrations
    | FileConfig
    | URLConfig
    | S3Config
    | KafkaConfig
    | PostgreSQLConfig
    | MySQLConfig;

// ============================================================================
// Engine Factory Functions
// ============================================================================

/**
 * Factory functions for creating type-safe engine configurations.
 * 
 * @example
 * ```typescript
 * import { table, t, Engine } from '@housekit/orm';
 * 
 * const events = table('events', (t) => ({
 *   id: text('id'),
 *   timestamp: timestamp('timestamp'),
 * }, {
 *   engine: Engine.ReplicatedMergeTree(),
 *   orderBy: 'timestamp',
 * });
 * ```
 */
export const Engine = {
    // -------------------------------------------------------------------------
    // MergeTree Family
    // -------------------------------------------------------------------------

    /**
     * The most versatile and powerful ClickHouse engine.
     * Designed for high-volume data insertion.
     * @see https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/mergetree
     */
    MergeTree: (options?: Omit<MergeTreeConfig, 'type'>): MergeTreeConfig => ({
        type: 'MergeTree',
        ...options
    }),

    /**
     * Removes duplicates with the same sorting key during merges.
     * @param versionColumn - Column (UInt* or DateTime) to determine which row is the latest.
     */
    ReplacingMergeTree: (
        versionColumn?: string,
        isDeletedColumn?: string,
        options?: Omit<ReplacingMergeTreeConfig, 'type' | 'versionColumn' | 'isDeletedColumn'>
    ): ReplacingMergeTreeConfig => ({
        type: 'ReplacingMergeTree',
        versionColumn,
        isDeletedColumn,
        ...options
    }),

    /**
     * SummingMergeTree - automatic summation of numeric columns during merges
     * 
     * @example
     * ```typescript
     * engine: Engine.SummingMergeTree(['amount', 'count'])
     * ```
     */
    SummingMergeTree: (
        columns?: string[],
        options?: Omit<SummingMergeTreeConfig, 'type' | 'columns'>
    ): SummingMergeTreeConfig => ({
        type: 'SummingMergeTree',
        columns,
        ...options
    }),

    /**
     * AggregatingMergeTree - for use with AggregateFunction columns
     */
    AggregatingMergeTree: (
        options?: Omit<AggregatingMergeTreeConfig, 'type'>
    ): AggregatingMergeTreeConfig => ({
        type: 'AggregatingMergeTree',
        ...options
    }),

    /**
     * CollapsingMergeTree - uses sign column to collapse row pairs
     * 
     * @example
     * ```typescript
     * engine: Engine.CollapsingMergeTree('sign')
     * ```
     */
    CollapsingMergeTree: (
        signColumn: string,
        options?: Omit<CollapsingMergeTreeConfig, 'type' | 'signColumn'>
    ): CollapsingMergeTreeConfig => ({
        type: 'CollapsingMergeTree',
        signColumn,
        ...options
    }),

    /**
     * VersionedCollapsingMergeTree - CollapsingMergeTree with version support
     * 
     * @example
     * ```typescript
     * engine: Engine.VersionedCollapsingMergeTree('sign', 'version')
     * ```
     */
    VersionedCollapsingMergeTree: (
        signColumn: string,
        versionColumn: string,
        options?: Omit<VersionedCollapsingMergeTreeConfig, 'type' | 'signColumn' | 'versionColumn'>
    ): VersionedCollapsingMergeTreeConfig => ({
        type: 'VersionedCollapsingMergeTree',
        signColumn,
        versionColumn,
        ...options
    }),

    /**
     * GraphiteMergeTree - optimized for Graphite metrics
     * 
     * @example
     * ```typescript
     * engine: Engine.GraphiteMergeTree('graphite_rollup')
     * ```
     */
    GraphiteMergeTree: (
        configSection: string,
        options?: Omit<GraphiteMergeTreeConfig, 'type' | 'configSection'>
    ): GraphiteMergeTreeConfig => ({
        type: 'GraphiteMergeTree',
        configSection,
        ...options
    }),

    /**
     * ReplicatedMergeTree - data replication across cluster nodes
     * 
     * HouseKit provides sensible defaults using ClickHouse macros that work
     * out-of-the-box in most cluster configurations.
     * 
     * @example
     * ```typescript
     * // Basic usage with defaults
     * engine: Engine.ReplicatedMergeTree()
     * 
     * // Custom ZK path
     * engine: Engine.ReplicatedMergeTree({
     *   zkPath: '/clickhouse/prod/tables/{shard}/events',
     *   replicaName: '{replica}'
     * })
     * 
     * // Replicated ReplacingMergeTree
     * engine: Engine.ReplicatedMergeTree({
     *   baseEngine: 'ReplacingMergeTree',
     *   versionColumn: 'updated_at'
     * })
     * ```
     */
    ReplicatedMergeTree: (
        config?: Omit<ReplicatedMergeTreeConfig, 'type'>
    ): ReplicatedMergeTreeConfig => ({
        type: 'ReplicatedMergeTree',
        // Sensible defaults using ClickHouse macros
        zkPath: config?.zkPath ?? '/clickhouse/tables/{shard}/{database}/{table}',
        replicaName: config?.replicaName ?? '{replica}',
        baseEngine: config?.baseEngine,
        versionColumn: config?.versionColumn,
        isDeletedColumn: config?.isDeletedColumn,
        sumColumns: config?.sumColumns,
        signColumn: config?.signColumn,
        enableLightweightDeletes: config?.enableLightweightDeletes
    }),

    // -------------------------------------------------------------------------
    // Special Purpose Engines
    // -------------------------------------------------------------------------

    /**
     * Buffer engine - buffers inserts before flushing to a target table
     * 
     * Excellent for high-throughput scenarios where you want to reduce
     * the number of parts created by batching inserts.
     * 
     * @example
     * ```typescript
     * // Create buffer with target table reference
     * const eventsBuffer = table('events_buffer', events.$columns, {
     *   engine: Engine.Buffer(events, { minRows: 1000, maxRows: 10000 })
     * });
     * ```
     */
    Buffer: <T extends TableColumns>(
        targetTable: TableDefinition<T>,
        opts: {
            minRows: number;
            maxRows: number;
            layers?: number;
            minTime?: number;
            maxTime?: number;
            minBytes?: number;
            maxBytes?: number;
        }
    ): BufferConfig => ({
        type: 'Buffer',
        database: 'currentDatabase()',
        table: targetTable.$table,
        layers: opts.layers ?? 16,
        minTime: opts.minTime ?? 10,
        maxTime: opts.maxTime ?? 100,
        minRows: opts.minRows,
        maxRows: opts.maxRows,
        minBytes: opts.minBytes ?? 10_000_000,  // 10MB
        maxBytes: opts.maxBytes ?? 100_000_000  // 100MB
    }),

    /**
     * Buffer engine with explicit database and table names
     */
    BufferExplicit: (config: Omit<BufferConfig, 'type'>): BufferConfig => ({
        type: 'Buffer',
        ...config
    }),

    /**
     * Distributed engine - distributes queries across cluster shards
     * 
     * @example
     * ```typescript
     * const eventsDistributed = table('events_distributed', events.$columns, {
     *   engine: Engine.Distributed({
     *     cluster: 'my_cluster',
     *     database: 'default',
     *     table: 'events_local',
     *     shardingKey: 'user_id'
     *   })
     * });
     * ```
     */
    Distributed: (config: Omit<DistributedConfig, 'type'>): DistributedConfig => ({
        type: 'Distributed',
        shardingKey: config.shardingKey ?? 'rand()',
        ...config
    }),

    /**
     * Null engine - discards all data (useful for testing)
     */
    Null: (): NullConfig => ({
        type: 'Null'
    }),

    // -------------------------------------------------------------------------
    // Log Family
    // -------------------------------------------------------------------------

    /**
     * Log engine - simple append-only storage
     */
    Log: (): LogConfig => ({
        type: 'Log'
    }),

    /**
     * TinyLog engine - lightweight logging
     */
    TinyLog: (): TinyLogConfig => ({
        type: 'TinyLog'
    }),

    // -------------------------------------------------------------------------
    // In-Memory Engines
    // -------------------------------------------------------------------------

    /**
     * Memory engine - stores all data in RAM
     * 
     * @example
     * ```typescript
     * engine: Engine.Memory({ maxRows: 100000 })
     * ```
     */
    Memory: (config?: Omit<MemoryConfig, 'type'>): MemoryConfig => ({
        type: 'Memory',
        ...config
    }),

    /**
     * Join engine - optimized for JOIN operations
     * 
     * @example
     * ```typescript
     * engine: Engine.Join('Any', 'Left', ['user_id'])
     * ```
     */
    Join: (
        strictness: JoinConfig['strictness'],
        joinType: JoinConfig['joinType'],
        keys: string[]
    ): JoinConfig => ({
        type: 'Join',
        strictness,
        joinType,
        keys
    }),

    /**
     * Dictionary engine - wraps a dictionary as a table
     */
    Dictionary: (dictionaryName: string): DictionaryConfig => ({
        type: 'Dictionary',
        dictionaryName
    }),

    // -------------------------------------------------------------------------
    // External Integrations
    // -------------------------------------------------------------------------

    /**
     * File engine - read/write from files
     * 
     * @example
     * ```typescript
     * engine: Engine.File('CSV')
     * engine: Engine.File('JSONEachRow', 'gzip')
     * ```
     */
    File: (format: string, compression?: FileConfig['compression']): FileConfig => ({
        type: 'File',
        format,
        compression
    }),

    /**
     * URL engine - read from remote URLs
     */
    URL: (url: string, format: string, compression?: URLConfig['compression']): URLConfig => ({
        type: 'URL',
        url,
        format,
        compression
    }),

    /**
     * S3 engine - read/write to Amazon S3
     * 
     * @example
     * ```typescript
     * engine: Engine.S3({
     *   path: 's3://bucket/path/data.parquet',
     *   format: 'Parquet'
     * })
     * ```
     */
    S3: (config: Omit<S3Config, 'type'>): S3Config => ({
        type: 'S3',
        ...config
    }),

    /**
     * Kafka engine - consume from Kafka topics
     * 
     * @example
     * ```typescript
     * engine: Engine.Kafka({
     *   brokerList: 'kafka:9092',
     *   topicList: 'events',
     *   groupName: 'clickhouse_consumer',
     *   format: 'JSONEachRow'
     * })
     * ```
     */
    Kafka: (config: Omit<KafkaConfig, 'type'>): KafkaConfig => ({
        type: 'Kafka',
        ...config
    }),

    /**
     * PostgreSQL engine - read from PostgreSQL
     */
    PostgreSQL: (config: Omit<PostgreSQLConfig, 'type'>): PostgreSQLConfig => ({
        type: 'PostgreSQL',
        ...config
    }),

    /**
     * MySQL engine - read from MySQL
     */
    MySQL: (config: Omit<MySQLConfig, 'type'>): MySQLConfig => ({
        type: 'MySQL',
        ...config
    })
};

// ============================================================================
// Engine SQL Rendering
// ============================================================================

/**
 * Renders an EngineConfiguration to its SQL representation.
 * This is used internally by defineTable() but can be useful for debugging.
 * 
 * @param engine - The engine configuration or raw string
 * @returns SQL string for the ENGINE clause
 */
export function renderEngineSQL(engine: EngineConfiguration | undefined): string {
    if (!engine) return 'MergeTree()';

    switch (engine.type) {
        case 'MergeTree':
            return 'MergeTree()';

        case 'ReplacingMergeTree': {
            const args: string[] = [];
            if (engine.versionColumn) args.push(engine.versionColumn);
            if (engine.isDeletedColumn) args.push(engine.isDeletedColumn);
            return `ReplacingMergeTree(${args.join(', ')})`;
        }

        case 'SummingMergeTree':
            if (engine.columns && engine.columns.length > 0) {
                return `SummingMergeTree(${engine.columns.join(', ')})`;
            }
            return 'SummingMergeTree()';

        case 'AggregatingMergeTree':
            return 'AggregatingMergeTree()';

        case 'CollapsingMergeTree':
            return `CollapsingMergeTree(${engine.signColumn})`;

        case 'VersionedCollapsingMergeTree':
            return `VersionedCollapsingMergeTree(${engine.signColumn}, ${engine.versionColumn})`;

        case 'GraphiteMergeTree':
            return `GraphiteMergeTree('${engine.configSection}')`;

        case 'ReplicatedMergeTree': {
            const zkPath = engine.zkPath ?? '/clickhouse/tables/{shard}/{database}/{table}';
            const replicaName = engine.replicaName ?? '{replica}';

            // Determine the base engine name
            let baseName = 'ReplicatedMergeTree';
            if (engine.baseEngine) {
                baseName = `Replicated${engine.baseEngine}`;
            }

            // Build arguments: always include ZK path and replica name first
            const args: string[] = [`'${zkPath}'`, `'${replicaName}'`];

            // Add engine-specific arguments based on base engine
            switch (engine.baseEngine) {
                case 'ReplacingMergeTree':
                    if (engine.versionColumn) args.push(engine.versionColumn);
                    if (engine.isDeletedColumn) args.push(engine.isDeletedColumn);
                    break;
                case 'SummingMergeTree':
                    if (engine.sumColumns && engine.sumColumns.length > 0) {
                        args.push(`(${engine.sumColumns.join(', ')})`);
                    }
                    break;
                case 'CollapsingMergeTree':
                case 'VersionedCollapsingMergeTree':
                    if (engine.signColumn) args.push(engine.signColumn);
                    break;
            }

            if (engine.baseEngine === 'VersionedCollapsingMergeTree' && engine.versionColumn) {
                args.push(engine.versionColumn);
            }

            return `${baseName}(${args.join(', ')})`;
        }

        case 'Buffer':
            return `Buffer(${engine.database}, ${engine.table}, ${engine.layers}, ${engine.minTime}, ${engine.maxTime}, ${engine.minRows}, ${engine.maxRows}, ${engine.minBytes}, ${engine.maxBytes})`;

        case 'Distributed': {
            const shardKey = engine.shardingKey ?? 'rand()';
            if (engine.policyName) {
                return `Distributed('${engine.cluster}', '${engine.database}', '${engine.table}', ${shardKey}, '${engine.policyName}')`;
            }
            return `Distributed('${engine.cluster}', '${engine.database}', '${engine.table}', ${shardKey})`;
        }

        case 'Null':
            return 'Null()';

        case 'Log':
            return 'Log()';

        case 'TinyLog':
            return 'TinyLog()';

        case 'Memory': {
            const args: string[] = [];
            if (engine.maxRows !== undefined) args.push(`max_rows = ${engine.maxRows}`);
            if (engine.maxBytes !== undefined) args.push(`max_bytes = ${engine.maxBytes}`);
            if (engine.compress !== undefined) args.push(`compress = ${engine.compress ? 1 : 0}`);
            if (args.length > 0) {
                return `Memory(${args.join(', ')})`;
            }
            return 'Memory()';
        }

        case 'Join':
            return `Join(${engine.strictness}, ${engine.joinType}, ${engine.keys.join(', ')})`;

        case 'Dictionary':
            return `Dictionary('${engine.dictionaryName}')`;

        case 'File': {
            if (engine.compression && engine.compression !== 'none') {
                return `File('${engine.format}', '${engine.compression}')`;
            }
            return `File('${engine.format}')`;
        }

        case 'URL': {
            if (engine.compression && engine.compression !== 'none') {
                return `URL('${engine.url}', '${engine.format}', '${engine.compression}')`;
            }
            return `URL('${engine.url}', '${engine.format}')`;
        }

        case 'S3': {
            const args = [`'${engine.path}'`];
            if (engine.accessKeyId && engine.secretAccessKey) {
                args.push(`'${engine.accessKeyId}'`, `'${engine.secretAccessKey}'`);
            }
            args.push(`'${engine.format}'`);
            if (engine.compression && engine.compression !== 'none') {
                args.push(`'${engine.compression}'`);
            }
            return `S3(${args.join(', ')})`;
        }

        case 'Kafka': {
            const topics = Array.isArray(engine.topicList) ? engine.topicList.join(', ') : engine.topicList;
            let sql = `Kafka() SETTINGS kafka_broker_list = '${engine.brokerList}', kafka_topic_list = '${topics}', kafka_group_name = '${engine.groupName}', kafka_format = '${engine.format}'`;
            if (engine.numConsumers !== undefined) {
                sql += `, kafka_num_consumers = ${engine.numConsumers}`;
            }
            if (engine.maxBlockSize !== undefined) {
                sql += `, kafka_max_block_size = ${engine.maxBlockSize}`;
            }
            if (engine.skipBroken !== undefined) {
                sql += `, kafka_skip_broken_messages = ${engine.skipBroken}`;
            }
            return sql;
        }

        case 'PostgreSQL':
            return `PostgreSQL('${engine.host}:${engine.port}', '${engine.database}', '${engine.table}', '${engine.user}', '${engine.password}'${engine.schema ? `, '${engine.schema}'` : ''})`;

        case 'MySQL':
            return `MySQL('${engine.host}:${engine.port}', '${engine.database}', '${engine.table}', '${engine.user}', '${engine.password}')`;

        default:
            // Type guard to ensure exhaustiveness
            const _exhaustive: never = engine;
            return 'MergeTree()';
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if an engine configuration is from the MergeTree family
 */
export function isMergeTreeFamily(engine: string | EngineConfiguration | undefined): boolean {
    if (!engine) return true; // Default is MergeTree
    if (typeof engine === 'string') return /MergeTree/i.test(engine);

    return [
        'MergeTree',
        'ReplacingMergeTree',
        'SummingMergeTree',
        'AggregatingMergeTree',
        'CollapsingMergeTree',
        'VersionedCollapsingMergeTree',
        'GraphiteMergeTree',
        'ReplicatedMergeTree'
    ].includes(engine.type);
}

/**
 * Checks if an engine configuration is replicated
 */
export function isReplicatedEngine(engine: string | EngineConfiguration | undefined): boolean {
    if (!engine) return false;
    if (typeof engine === 'string') return /Replicated/i.test(engine);
    return engine.type === 'ReplicatedMergeTree';
}

/**
 * Extracts the version column from an engine configuration if applicable
 */
export function getVersionColumn(engine: string | EngineConfiguration | undefined): string | undefined {
    if (!engine || typeof engine === 'string') return undefined;

    if (engine.type === 'ReplacingMergeTree') {
        return engine.versionColumn;
    }
    if (engine.type === 'ReplicatedMergeTree' && engine.baseEngine === 'ReplacingMergeTree') {
        return engine.versionColumn;
    }
    if (engine.type === 'VersionedCollapsingMergeTree') {
        return engine.versionColumn;
    }
    return undefined;
}
