import type { ClickHouseClientConfigOptions } from '@clickhouse/client';
import { resolve, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { type TableDefinition, type TableColumns } from './core';
import { createClientFromConfigObject, createHousekitClient, type ClientConfigWithSchema, type HousekitClientConfig, type HousekitClient } from './client';
import { generateSelectSchema, generateInsertSchema } from './codegen/zod';

// Export core types and utilities explicitly
export { ClickHouseColumn } from './column';

export {
    type TableDefinition,
    type TableColumns,
    type TableOptions,
    type IndexDefinition,
    type ProjectionDefinition,
    type InsertModel,
    type TableModel,
    type TableInsertArray,
    type TableRuntime,
    type TableInsert,
    index,
    projection,
    deriveTable,
    renderSchema
} from './table';

/**
 * Infer the SELECT type (result) from a table definition.
 */
export type Infer<T> = T extends { $inferSelect: infer U } ? U : never;

/**
 * Infer the INSERT type (input) from a table definition.
 */
export type InferInsert<T> = T extends { $inferInsert: infer U } ? U : never;

export { Engine, renderEngineSQL, type EngineConfiguration } from './engines';
export * from './external';

export * from './expressions';
export * from './builders/select';
export * from './builders/select.types';
export * from './builders/insert';
export * from './builders/delete';
export * from './builders/update';
export * from './metadata';
export * from './compiler';
export * from './modules';
export * from './relational';
export * from './logger';
export * from './client';
export {
    t,
    defineTable,
    table,
    view,
    defineView,
    materializedView,
    defineMaterializedView,
    dictionary,
    defineDictionary,
    defineProjection,
    detectMaterializedViewDrift,
    extractMVQuery,
    createMigrationBridge,
    generateBlueGreenMigration,
    relations,
    type ColumnBuilder,
    type EnhancedTableOptions
} from './schema-builder';
export { sql } from './expressions';

// Zod Schema Generation
export { generateSelectSchema, generateInsertSchema } from './codegen/zod';

// Binary serialization utilities (for advanced use cases)
export {
    BinaryWriter,
    createBinaryEncoder,
    serializeRowBinary,
    serializeRowsBinary,
    buildBinaryConfig,
    // Optimization exports
    acquireWriter,
    releaseWriter,
    createAccessor,
    buildOptimizedBinaryConfig,
    serializeRowsOptimized,
    isNumericHeavySchema,
    serializeNumericBatch,
    type BinaryEncoder,
    type BinarySerializationConfig,
    type OptimizedBinaryConfig,
    type RowAccessor,
} from './utils/binary-serializer';

export {
    SyncBinarySerializer,
    BinaryWorkerPool,
    type BinaryWorkerPoolOptions,
} from './utils/binary-worker-pool';

export interface DatabaseConnection {
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    url?: string; // Alternative: full connection URL
}

export interface HouseKitConfig {
    /**
     * Path to the directory containing your schema files (.ts or .js).
     * Can be a single path or a mapping for multiple databases.
     */
    schema: string | Record<string, string>; // Single path or { dbName: path } mapping
    /**
     * Directory where SQL migrations and snapshots will be generated.
     */
    out: string;    // Output folder for migrations (e.g., "./housekit")
    /**
     * Preferred file format for generated schema files
     */
    language?: 'ts' | 'js'; // Preferred file format for generated schema files
    /**
     * ClickHouse connection configuration.
     * Each key represents the database name you will use.
     */
    databases: Record<string, DatabaseConnection>;
}

/**
 * Load housekit.config.js/ts and create a client by name.
 */
export async function createClientFromConfig(databaseName: string = 'default'): Promise<HousekitClient> {
    const config = await loadConfig();
    const dbConfig = config.databases[databaseName];

    if (!dbConfig) {
        throw new Error(`Database "${databaseName}" not found in housekit.config.js. Available databases: ${Object.keys(config.databases).join(', ')}`);
    }

    const clientConfig: ClickHouseClientConfigOptions = {
        url: dbConfig.url || (dbConfig.host ? `http://${dbConfig.host}${dbConfig.port ? `:${dbConfig.port}` : ''}` : 'http://localhost:8123'),
        database: dbConfig.database,
        username: dbConfig.username || 'default',
        password: dbConfig.password || '',
    };

    return createClientFromConfigObject(clientConfig);
}

export function housekit<TSchema extends Record<string, TableDefinition<any>> = Record<string, TableDefinition<any>>>(
    config: HousekitClientConfig,
    options?: { schema?: TSchema }
): HousekitClient<TSchema> {
    return createHousekitClient({
        ...config,
        schema: options?.schema
    });
}

export function createSchema<TCols extends TableColumns>(table: TableDefinition<TCols>) {
    return {
        select: generateSelectSchema(table),
        insert: generateInsertSchema(table),
    };
}

/**
 * Load housekit.config.{ts,js,mjs,cjs}
 */
async function loadConfig(): Promise<HouseKitConfig> {
    const root = process.cwd();
    const extensions = ['ts', 'js', 'mjs', 'cjs'];

    function findConfigFile(dir: string, depth: number = 0): string | null {
        if (depth > 10) return null;
        if (dir.includes('node_modules') || dir.includes('.git')) return null;

        for (const ext of extensions) {
            const configPath = join(dir, `housekit.config.${ext}`);
            if (existsSync(configPath)) {
                return configPath;
            }
        }

        if (depth < 3) {
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        const found = findConfigFile(join(dir, entry.name), depth + 1);
                        if (found) return found;
                    }
                }
            } catch {
                // ignore permission errors
            }
        }

        return null;
    }

    const configPath = findConfigFile(root);
    if (configPath) {
        const module = await import(resolve(configPath));
        return module.default;
    }

    throw new Error('housekit.config.{ts,js,mjs,cjs} not found in workspace.');
}

// HousekitClient is exported via `export * from './client'`

// Public API: createClient can accept either a config object, a database name string, or nothing (defaults to 'default')
export function createClient(): Promise<HousekitClient>;
export function createClient(config: ClientConfigWithSchema): HousekitClient;
export function createClient(databaseName: string): Promise<HousekitClient>;
export function createClient(configOrName?: ClientConfigWithSchema | string): HousekitClient | Promise<HousekitClient> {
    // If no argument provided, use 'default' database
    if (configOrName === undefined) {
        return createClientFromConfig('default');
    }

    // If config is a string, it's a database name - load from housekit.config.js
    if (typeof configOrName === 'string') {
        return createClientFromConfig(configOrName);
    }

    // Otherwise, use the configuration object directly
    return createClientFromConfigObject(configOrName);
}

export async function tableExists(client: HousekitClient, tableName: string) {
    return client.tableExists(tableName);
}

export async function ensureTable<TCols extends TableColumns>(client: HousekitClient, table: TableDefinition<TCols>) {
    return client.ensureTable(table);
}

export async function dropTable(client: HousekitClient, tableName: string, options?: { ifExists?: boolean }) {
    return client.dropTable(tableName, options);
}

/**
 * Create multiple ClickHouse clients for multi-database setups
 * @example
 * const clients = createClients({
 *   analytics: { url: 'http://localhost:8123', database: 'analytics' },
 *   logs: { url: 'http://localhost:8123', database: 'logs' }
 * });
 * 
 * await clients.analytics.select().from(events);
 * await clients.logs.insert(logTable).values({...});
 */
export function createClients<T extends Record<string, ClientConfigWithSchema>>(
    configs: T
): Record<keyof T, HousekitClient> {
    const clients: any = {};

    for (const [name, config] of Object.entries(configs)) {
        clients[name] = createClientFromConfigObject(config);
    }

    return clients;
}

/**
 * Close all clients in a multi-database setup
 */
export async function closeAllClients(clients: Record<string, HousekitClient>) {
    await Promise.all(
        Object.values(clients).map(client => client.close())
    );
}

// ============================================================================
// Default Export (Optional Style)
// ============================================================================

// Import symbols for default export
import {
    t,
    defineTable,
    table,
    view,
    defineView,
    materializedView,
    defineMaterializedView,
    dictionary,
    defineDictionary,
    defineProjection,
    detectMaterializedViewDrift,
    extractMVQuery,
    createMigrationBridge,
    generateBlueGreenMigration,
    relations
} from './schema-builder';
import { sql } from './expressions';
import { Engine } from './engines';
import { index, projection, deriveTable } from './table';

/**
 * Optional default export for users who prefer this style.
 * Named exports are recommended for better tree-shaking.
 * 
 * @example
 * ```typescript
 * // Named exports (recommended)
 * import { table, t, Engine } from '@housekit/orm';
 * 
 * // Default export (alternative)
 * import housekit from '@housekit/orm';
 * const users = housekit.table('users', { ... });
 * ```
 */
export default {
    // Core builders
    t,
    table,
    defineTable,
    view,
    defineView,
    materializedView,
    defineMaterializedView,
    dictionary,
    defineDictionary,
    defineProjection,
    relations,

    // Client creation
    createClient,
    createClients,
    closeAllClients,

    // Engine DSL
    Engine,

    // Utilities
    sql,
    index,
    projection,
    deriveTable,
    detectMaterializedViewDrift,
    extractMVQuery,
    createMigrationBridge,
    generateBlueGreenMigration,

    // Codegen
    generateSelectSchema,
    generateInsertSchema,
};
