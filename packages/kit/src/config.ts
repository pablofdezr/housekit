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
    language?: 'ts' | 'js'; // Preferred file format for generated schema files

    /**
     * ClickHouse connection configuration.
     * Each key represents the database name you will use in the CLI with `--database`.
     */
    databases: Record<string, DatabaseConnection>;
}

// Default export as plain object (no helper needed)
export type { HouseKitConfig as default };

/**
 * Helper to get all database configurations
 */
export function getDatabaseConfigs(config: HouseKitConfig): Record<string, DatabaseConnection> {
    return config.databases;
}

/**
 * Helper to get schema paths mapped to databases
 */
export function getSchemaMapping(config: HouseKitConfig): Record<string, string> {
    if (typeof config.schema === 'string') {
        // Single schema path - map to default or first database
        const dbNames = Object.keys(config.databases);
        const defaultDb = dbNames.includes('default') ? 'default' : dbNames[0];
        if (!defaultDb) throw new Error("No databases configured");
        return { [defaultDb]: config.schema };
    }

    return config.schema;
}
