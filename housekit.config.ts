import type { HouseKitConfig } from '@housekit/orm';

/**
 * HouseKit Configuration File
 * 
 * This file defines your ClickHouse connections and schema locations.
 * Use the 'default export' to define your active configuration.
 */

export default {
    schema: "./src/schema", // Path to your TypeScript table definitions
    out: "./housekit",      // Where your migrations and snapshots will be stored
    databases: {
        default: {
            host: "http://localhost:8123",
            database: "default",
            username: "admin",
            // We recommend using environment variables for sensitive credentials
            password: process.env.CLICKHOUSE_PASSWORD || ""
        }
    }
} satisfies HouseKitConfig;

// =============================================================================
// CONFIGURATION EXAMPLES (Commented out for reference)
// =============================================================================

/**
 * Example: Multiple Databases on the Same Host
 * 
 * export const multiDbConfig = {
 *     schema: {
 *         analytics: "./src/schemas/analytics",
 *         logs: "./src/schemas/logs",
 *     },
 *     out: "./housekit",
 *     databases: {
 *         analytics: { host: "http://localhost:8123", database: "analytics_db" },
 *         logs: { host: "http://localhost:8123", database: "logs_db" }
 *     }
 * } satisfies HouseKitConfig;
 */

/**
 * Example: Remote Environments (Production/Staging)
 * 
 * export const environmentsConfig = {
 *     schema: "./src/schema",
 *     out: "./housekit",
 *     databases: {
 *         production: {
 *             host: "https://prod-ch.example.com",
 *             port: 8443,
 *             database: "prod_db",
 *             password: process.env.PROD_PASSWORD
 *         },
 *         staging: {
 *             host: "http://staging-ch.example.com",
 *             database: "staging_db",
 *             password: process.env.STAGING_PASSWORD
 *         }
 *     }
 * } satisfies HouseKitConfig;
 */

/**
 * Example: Using full connection URLs
 * 
 * export const urlConfig = {
 *     schema: "./src/schema",
 *     out: "./housekit",
 *     databases: {
 *         default: {
 *             url: "http://user:pass@localhost:8123/my_database",
 *             database: "my_database"
 *         }
 *     }
 * } satisfies HouseKitConfig;
 */
