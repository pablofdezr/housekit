# HouseKit CLI 🏠⚡️

**The modern schema management tool for ClickHouse.**

> ⚠️ **Public Beta**: HouseKit CLI is currently in public beta. We are actively refining the migration engine and cluster management features.

HouseKit CLI brings a modern, streamlined developer experience to the ClickHouse ecosystem. Manage your sharded clusters, analytical tables, and complex materialized views using purely TypeScript—no more manual SQL migration files or structural drift.

[![npm version](https://img.shields.io/npm/v/@housekit/kit.svg)](https://www.npmjs.com/package/@housekit/kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Why HouseKit CLI?

- **Declarative Workflows**: Define your source of truth in TypeScript.
- **Automatic Drift Detection**: Compares your code against the live DB schema instantly.
- **Engine-Aware Diffing**: Normalizes local engine objects vs. remote SQL to avoid false changes.
- **Blue-Green Deployments**: Safe, zero-downtime structural changes for Materialized Views and Tables.
- **Cluster Awareness**: First-class support for sharded clusters using `{cluster}` macros and sharding keys.
- **Zero Runtime Dependencies**: Powered by `jiti` for native TS loading—no pre-compilation or heavy binaries required.

---

## 🛠 Installation

```bash
# Recommended: install as a dev dependency
npm install -D @housekit/kit @housekit/orm
# or
bun add -D @housekit/kit @housekit/orm
```

---

## 📖 The Two Workflows

HouseKit supports two distinct ways of working depending on your environment.

### 1. Rapid Development: `housekit push`
Perfect for early-stage projects or local development. It computes the delta between your TS files and the database and applies it immediately.
- **Safe**: Asks for confirmation before any destructive change.
- **Fast**: Skips the creation of migration files.
- **Smart**: Handles column renames and type changes.
- **CI/CD Ready**: Use `-y` flag or pipe commands for non-interactive mode.

### 2. Controlled Production: `housekit generate` & `migrate`
The standard for CI/CD and production environments.
- **Generate**: Compares your code against a `snapshot.json` and creates a timestamped `.sql` file in your migrations folder.
- **Migrate**: Executes pending SQL files against the target database, tracking history in `system.migrations`.

---

## 💻 Commands

| Command | Description |
| :--- | :--- |
| `init` | Bootstraps a new HouseKit project with config and folder structure. |
| `push` | Syncs local schema directly to the database. Supports `--log-explain`. |
| `generate` | Creates a new SQL migration file based on schema changes. |
| `migrate` | Applies pending SQL migrations to the database. |
| `pull` | **Introspection**: Connects to a DB and generates typed TS schema files. |
| `schema` | Prints a beautiful, color-coded summary of your tables and types. |
| `status` | Lists all detected differences between your code and the database. |
| `validate` | Checks if code and DB are in sync (exit code 1 on drift). Great for CI. |
| `list` | Summarizes row counts, engines, and sizes for all tables. |
| `reset` | Wipes the database and restarts from your code schema (Dev only). |

### Global Options

| Option | Description |
| :--- | :--- |
| `-y, --yes` | Auto-confirm all prompts (useful for CI/CD and scripts). |
| `-d, --database <name>` | Target a specific database from your config. |

### Non-Interactive Mode

When running in non-interactive environments (CI/CD pipelines, scripts with piped input), HouseKit automatically detects this and uses default values for prompts. For explicit control, use the `-y` flag:

```bash
# Auto-confirm all prompts
bunx housekit push -y

# Works in CI/CD pipelines
bunx housekit migrate -y --database production
```

---

## ⚙️ Configuration

Create a `housekit.config.ts` (or `.js`, `.mjs`) in your project root.

```typescript
import type { HouseKitConfig } from '@housekit/kit';

export default {
  schema: './src/schema', // Where your table definitions live
  
  // Where migrations and snapshots will be stored
  out: './housekit',
  
  // Multi-database support
  databases: {
    default: {
      host: 'localhost',
      port: 8123,
      database: 'analytics_dev',
      username: 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    },
    production: {
      url: process.env.CLICKHOUSE_PROD_URL,
      database: 'analytics_prod',
    }
  }
} satisfies HouseKitConfig;
```

---

## 🏗 Advanced Usage

### Working with Clusters
HouseKit simplifies managing Replicated and Distributed tables across a cluster.

```typescript
import { defineTable, t, Engine } from '@housekit/orm';

// Define a table that lives on a cluster (object syntax still supported)
export const events = defineTable('events', {
  id: t.uuid('id').primaryKey(),
  userId: t.uuid('user_id'),
  createdAt: t.timestamp('created_at').default('now()'),
}, {
  engine: Engine.ReplicatedMergeTree(),
  
  // High Portability: Using '{cluster}' tells ClickHouse to use the 
  // cluster name defined in the server's configuration macros.
  // This allows the same code to run on 'dev_cluster', 'prod_cluster', etc.
  onCluster: '{cluster}', 
  
  shardKey: 'user_id',
  orderBy: 'id'
});

// Callback syntax is also available when you want presets or composition:
// defineTable('events', (t) => ({ ... }), { ... })
```
When you run `housekit push`, the CLI automatically detects the cluster configuration and executes the `ALTER` or `CREATE` statements across all nodes using the specified macro.

### Safe Materialized View Updates
ClickHouse doesn't allow `ALTER` on Materialized View queries. HouseKit solves this via **Blue-Green Deployments**:
1. Creates a `__shadow` table with the new query.
2. Swaps the names atomically using `RENAME`.
3. Ensures zero data loss during the transition.

### Database Introspection (`pull`)
Have an existing database with 100 tables? Don't write the code by hand.
```bash
bunx housekit pull --database production
```
This will scan your ClickHouse instance and generate a clean, readable `schema.ts` file with all table definitions, engines, and settings preserved.
Engine strings from ClickHouse are stored as `customEngine` to guarantee a lossless round-trip.

---

## 🛡 Security & Best Practices

- **Credentials**: Never hardcode passwords. Use `process.env`.
- **Read-Only Mode**: In `housekit.config.ts`, you can mark databases as `readOnly: true` to prevent accidental `push` or `migrate` calls.
- **Validation**: Add `housekit validate` to your CI pipeline to ensure no developer forgot to generate a migration before merging.

---

## License

MIT © [Pablo Fernandez Ruiz](https://github.com/pablofdezr)
