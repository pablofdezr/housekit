import { createClient as createChClient } from '@clickhouse/client';
import type { ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';
import { Readable } from 'stream';
import http from 'http';
import https from 'https';
import { ClickHouseQueryBuilder } from './builders/select';
import { ClickHouseInsertBuilder, type BinaryInsertConfig } from './builders/insert';
import { ClickHouseDeleteBuilder } from './builders/delete';
import { ClickHouseUpdateBuilder } from './builders/update';
import { type TableDefinition, type TableRuntime, type CleanInsert } from './core';
import type { SQLExpression } from './expressions';
import { buildInsertPlan, processRowsStream } from './utils/insert-processing';
import { wrapClientWithLogger, type HousekitLogger } from './logger';
import { buildRelationalAPI, type RelationalAPI } from './relational';

// ============================================================================
// Optimization #3: Connection Pool Management
// ============================================================================

interface ConnectionPoolConfig {
    /** Maximum concurrent sockets (default: 100) */
    maxSockets?: number;
    /** Keep connections alive (default: true) */
    keepAlive?: boolean;
    /** Keep-alive initial delay in ms (default: 1000) */
    keepAliveInitialDelay?: number;
    /** Socket timeout in ms (default: 30000) */
    timeout?: number;
}

// Global agent pool for reuse across clients
const agentPool = new Map<string, http.Agent | https.Agent>();

function getOrCreateAgent(url: string, config: ConnectionPoolConfig = {}): http.Agent | https.Agent {
    const isHttps = url.startsWith('https');
    const key = `${url}-${config.maxSockets ?? 100}`;
    
    let agent = agentPool.get(key);
    if (agent) return agent;
    
    const agentConfig = {
        keepAlive: config.keepAlive ?? true,
        keepAliveMsecs: config.keepAliveInitialDelay ?? 1000,
        maxSockets: config.maxSockets ?? 100,
        maxFreeSockets: Math.floor((config.maxSockets ?? 100) / 2),
        timeout: config.timeout ?? 30000,
    };
    
    agent = isHttps 
        ? new https.Agent(agentConfig)
        : new http.Agent(agentConfig);
    
    agentPool.set(key, agent);
    return agent;
}

export type HousekitClientConfig = ClickHouseClientConfigOptions & { 
    schema?: Record<string, TableDefinition<any>>; 
    logger?: HousekitLogger;
    /** Connection pool configuration */
    pool?: ConnectionPoolConfig;
    /** Skip validation for maximum insert performance */
    skipValidation?: boolean;
};
export type ClientConfigWithSchema = HousekitClientConfig;

export interface HousekitClient<TSchema extends Record<string, TableDefinition<any>> | undefined = any> {
    rawClient: ClickHouseClient; 
    select: <T extends Record<string, any> | TableDefinition<any>>(fieldsOrTable?: T) => any;
    with: (name: string, query: ClickHouseQueryBuilder<any>) => ClickHouseQueryBuilder<any>;
    insert: <TTable extends TableRuntime<any, any>>(table: TTable) => ClickHouseInsertBuilder<TTable>;
    insertMany: <TTable extends TableRuntime<any, any>>(
        table: TTable,
        values: Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>>,
        opts?: { maxBlockSize?: number; asyncInsertWait?: boolean }
    ) => Promise<void>;
    update: <TTable extends TableRuntime<any, any>>(table: TTable) => ClickHouseUpdateBuilder<TTable>;
    delete: <TTable extends TableRuntime<any, any>>(table: TTable) => ClickHouseDeleteBuilder<TTable>;
    command: (params: { query: string; query_params?: Record<string, unknown>; format?: string }) => Promise<any>;
    raw: (query: string, params?: Record<string, unknown>) => Promise<any>;
    tableExists: (tableName: string) => Promise<boolean>;
    ensureTable: (table: { $table: string; toSQL: () => string }) => Promise<void>;
    dropTable: (tableName: string, options?: { ifExists?: boolean }) => Promise<void>;
    close: () => Promise<void>;
    schema: TSchema;
    _config: HousekitClientConfig;
    query: TSchema extends Record<string, TableDefinition<any>>
    ? RelationalAPI<TSchema>
    : undefined;
}

export function createHousekitClient<TSchema extends Record<string, TableDefinition<any>> | undefined = any>(
    config: HousekitClientConfig & { schema?: TSchema }
): HousekitClient<TSchema> {
    const { schema, logger, pool, skipValidation, ...configRest } = config;

    // Normalize configuration
    const normalizedConfig: ClickHouseClientConfigOptions = { ...configRest };

    // Convert host to url if needed
    if ('host' in normalizedConfig && !('url' in normalizedConfig)) {
        const host = normalizedConfig.host as string;
        normalizedConfig.url = host.startsWith('http://') || host.startsWith('https://')
            ? host
            : `http://${host}`;
        delete normalizedConfig.host;
    }

    const urlStr = normalizedConfig.url?.toString() ?? '';
    
    // Use pooled connection agent (Optimization #3)
    const keepAliveAgent = getOrCreateAgent(urlStr, pool);

    const clientConfig: ClickHouseClientConfigOptions = {
        ...normalizedConfig,
        clickhouse_settings: {
            enable_http_compression: 1,
            ...normalizedConfig.clickhouse_settings
        }
    };
    clientConfig.http_agent = keepAliveAgent;

    const baseChClient = createChClient(clientConfig);
    const client = wrapClientWithLogger(baseChClient, logger);

    const tableExists = async (tableName: string) => {
        const result = await client.query({
            query: `EXISTS TABLE \`${tableName}\``,
            format: 'JSONEachRow'
        });
        const rows = await result.json() as Array<{ result?: number; exists?: number }>;
        const exists = rows[0]?.result === 1 || rows[0]?.exists === 1;
        return Boolean(exists);
    };

    const ensureTable = async (table: { $table: string; toSQL: () => string }) => {
        const exists = await tableExists(table.$table);
        if (!exists) {
            await client.query({ query: table.toSQL() });
        }
    };

    const dropTable = async (tableName: string, options?: { ifExists?: boolean }) => {
        const clause = options?.ifExists === false ? '' : ' IF EXISTS';
        await client.query({ query: `DROP TABLE${clause} \`${tableName}\`` });
    };

    // Build connection config for binary inserts
    const binaryInsertConfig: BinaryInsertConfig = {
        url: normalizedConfig.url?.toString() || 'http://localhost:8123',
        username: normalizedConfig.username || 'default',
        password: normalizedConfig.password || '',
        database: normalizedConfig.database || 'default',
        skipValidation,
    };

    const baseClient: HousekitClient<TSchema> = {
        rawClient: client as ClickHouseClient,
        select: <T extends Record<string, any> | TableDefinition<any> | undefined = undefined>(fieldsOrTable?: T) => {
            const builder: any = new ClickHouseQueryBuilder(client);
            if (!fieldsOrTable) return builder.select();
            if (typeof fieldsOrTable === 'object' && fieldsOrTable !== null && '$table' in fieldsOrTable) {
                return builder.select().from(fieldsOrTable as TableDefinition<any>);
            }
            return builder.select(fieldsOrTable as any);
        },
        with: (name: string, query: ClickHouseQueryBuilder<any>) => {
            const builder = new ClickHouseQueryBuilder(client);
            return builder.with(name, query);
        },
        insert: <TTable extends TableRuntime<any, any>>(table: TTable) =>
            new ClickHouseInsertBuilder(client, table, binaryInsertConfig),
        insertMany: async <TTable extends TableRuntime<any, any>>(
            table: TTable,
            values: Array<CleanInsert<TTable>> | Iterable<CleanInsert<TTable>> | AsyncIterable<CleanInsert<TTable>>,
            opts?: { maxBlockSize?: number; asyncInsertWait?: boolean }
        ) => {
            const blockSize = Math.max(opts?.maxBlockSize || 10000, 1);
            const plan = buildInsertPlan(table);
            const mode: 'compact' | 'json' = plan.useCompact ? 'compact' : 'json';
            const processedRows = processRowsStream(values as any, plan, mode);
            const stream = Readable.from(processedRows, { objectMode: true, highWaterMark: blockSize });
            const clickhouse_settings = opts?.asyncInsertWait !== undefined
                ? { async_insert: 1 as const, wait_for_async_insert: opts.asyncInsertWait ? 1 as const : 0 as const }
                : undefined;
            await client.insert({
                table: table.$table,
                values: stream,
                format: mode === 'compact' ? 'JSONCompactEachRow' : 'JSONEachRow',
                columns: mode === 'compact' ? plan.columnNames : undefined,
                ...(clickhouse_settings ? { clickhouse_settings } : {})
            });
        },
        update: <TTable extends TableRuntime<any, any>>(table: TTable) =>
            new ClickHouseUpdateBuilder(client, table),
        delete: <TTable extends TableRuntime<any, any>>(table: TTable) =>
            new ClickHouseDeleteBuilder(client, table),
        command: async (params: { query: string; query_params?: Record<string, unknown>; format?: string }) => {
            return client.query(params as any);
        },
        raw: async (query: string, params?: Record<string, unknown>) => {
            const resultSet = await client.query({
                query,
                query_params: params,
                format: 'JSONEachRow'
            });
            return resultSet.json();
        },
        tableExists,
        ensureTable,
        dropTable,
        close: () => client.close(),
        schema: schema as TSchema,
        _config: config,
        query: undefined as any
    };

    const relationalAPI = buildRelationalAPI(client, schema);
    if (relationalAPI) {
        (baseClient as any).query = relationalAPI;
    }

    return baseClient;
}

export const createClientFromConfigObject = createHousekitClient;
