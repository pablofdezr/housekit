import type { DatabaseConnection, HouseKitConfig } from '@housekit/orm';

export type { DatabaseConnection, HouseKitConfig };

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
