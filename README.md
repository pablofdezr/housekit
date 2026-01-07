# HouseKit 🏠⚡️

**The modern developer experience for ClickHouse.**

[![npm version](https://img.shields.io/npm/v/@housekit/orm.svg?style=flat-square)](https://www.npmjs.com/package/@housekit/orm)
[![npm version](https://img.shields.io/npm/v/@housekit/kit.svg?style=flat-square)](https://www.npmjs.com/package/@housekit/kit)
[![Documentation](https://img.shields.io/badge/Docs-RepoGrep-teal?style=flat-square)](https://app.ami.dev/repogrep?repo=https://github.com/pablofdezr/housekit)
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMUgxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/pablofdezr/housekit)
[![Documentation](https://img.shields.io/badge/Wiki-Devin%20AI-blueviolet?style=flat-square)](https://deepwiki.com/pablofdezr/housekit)
[![Documentation](https://img.shields.io/badge/Docs-WarpGrep-blue?style=flat-square)](https://www.morphllm.com/playground/na/warpgrep?repo=pablofdezr%2Fhousekit)

[![npm](https://nodei.co/npm/@housekit/orm.png)](https://www.npmjs.com/package/@housekit/orm)
[![npm](https://nodei.co/npm/@housekit/kit.png)](https://www.npmjs.com/package/@housekit/kit)

![Weekly Downloads](https://img.shields.io/npm/dw/@housekit/orm.svg?color=orange) ![Weekly Downloads](https://img.shields.io/npm/dw/@housekit/kit.svg?color=orange)

> ⚠️ **Public Beta**: HouseKit is currently in public beta. While the core API is stable and used in production, some advanced features may change as we head towards v1.0. Contributions and feedback are welcome!

HouseKit is a next-generation toolkit designed to bridge the gap between high-performance OLAP databases and ergonomic, type-safe development. Inspired by best-in-class developer experiences, HouseKit brings first-class TypeScript support to ClickHouse.

> [!TIP]
> **Interactive Docs**: Use [RepoGrep](https://app.ami.dev/repogrep?repo=https://github.com/pablofdezr/housekit) to search and query the entire codebase and documentation for free (Updated instantly).

> [!TIP]
> **Ask ZRead**: Need deep insights? [Ask ZRead](https://zread.ai/pablofdezr/housekit) for AI-powered understanding of the codebase (Updated weekly).

> [!TIP]
> **Ask Devin AI**: Have questions about integrating HouseKit? [Ask the Wiki](https://deepwiki.com/pablofdezr/housekit) for AI-powered assistance (Updated weekly).

---

## 📦 Project Structure

HouseKit is a monorepo consisting of two core components:

### [1. @housekit/orm](./packages/orm)
The high-performance core.
- **High-Performance Inserts**: Optimized streaming with sync insert and JSONCompact formats.
- **Type-Safe DSL**: Fully typed query builder and schema definition.
- **Relational API**: Optimized one-to-many and one-to-one fetching using ClickHouse's `groupArray`.
- **Background Batching**: Use `.batch()` and `.append(row)` for ultra-low latency, high-throughput writes.
- **Zero-Config Types**: Phantom types with clean tooltips via `$type`/`$insert`.
- **Modern DX**: Simplified `where`, `orderBy`, and `columns` syntax.

### [2. housekit (CLI)](./packages/kit)
The schema management and migration tool.
- **Push Workflow**: Instant schema synchronization for rapid development.
- **Generate Workflow**: Deterministic SQL migrations and snapshots for production.
- **Introspection**: Connect to existing databases and generate TypeScript code automatically.
- **Cluster Aware**: Native support for sharded clusters and `ON CLUSTER` operations.
- **CI/CD Ready**: Non-interactive mode with auto-confirmation for piped commands and scripts.

---

## 🚀 Key Advantages

| Feature | Why it matters |
| :--- | :--- |
| **Modern DX** | Focus on building your app, not fighting with SQL strings or clunky ORMs. |
| **Performance First** | Optimized insert streaming with sync mode and JSONCompact format. |
| **Zero Dependencies** | Powered by `jiti` for native TS loading—no `ts-node` or heavy build steps required. |
| **Blue-Green Migrations** | Safe, zero-downtime structural changes for Materialized Views and Tables. |
| **Production Ready** | Designed for modern workflows with ESM-first architecture and full type inference. |

---

## 🛠 Quick Start

```bash
# 1. Install the CLI and ORM
bun add -D @housekit/kit @housekit/orm

# 2. Initialize your project
bunx housekit init

# 3. Define your first table in src/schema/index.ts
# (Then sync it to the DB)
bunx housekit push

# For CI/CD or scripts, use -y to auto-confirm all prompts
bunx housekit push -y
```

---

## ✨ ORM DX Highlights

```typescript
import { housekit } from '@housekit/orm';
import * as schema from './schema';

const db = housekit({ url: 'http://localhost:8123' }, { schema });

// Relational queries with simplified syntax
const user = await db.query.users.findFirst({
  where: { email: 'a@b.com' },
  columns: { id: true, email: true },
  with: { posts: { limit: 5 } }
});

// Find by ID shorthand
const userById = await db.query.users.findById('uuid-here');

// Standard insert (no data returned)
await db.insert(schema.users).values({ email: 'a@b.com', role: 'admin' });

// JSON insert with returning data
const created = await db
  .insert(schema.users)
  .values({ email: 'a@b.com', role: 'admin' })
  .returningOne();
```

```typescript
// schema.ts
import { defineTable, t, Engine } from '@housekit/orm';

export const users = defineTable('users', {
  id: t.uuid('id').primaryKey(),
  email: t.string('email'),
  role: t.enum('role', ['admin', 'user']),
}, { engine: Engine.MergeTree(), orderBy: 'id' });

export type User = typeof users.$type;
export type NewUser = typeof users.$insert;
```

---

## 📖 Documentation

Detailed documentation for each component can be found in their respective directories:
- [ORM Core Documentation & API Reference](./packages/orm/README.md)
- [CLI Commands & Workflow Guide](./packages/kit/README.md)
- [Demo App](./app/README.md)
- [Interactive AI Documentation (RepoGrep)](https://app.ami.dev/repogrep?repo=https://github.com/pablofdezr/housekit) - Query up-to-date documentation for free.
- [Interactive AI Documentation (WarpGrep)](https://www.morphllm.com/playground/na/warpgrep?repo=pablofdezr%2Fhousekit)
- [Interactive AI Documentation (ZRead)](https://zread.ai/pablofdezr/housekit)

---

## 🏗 Development

This project uses [Turbo](https://turbo.build/) and [Bun](https://bun.sh/) for a fast development experience.

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test
```

### Releasing

Use the new release command to publish new versions:

```bash
# Release all packages with automatic patch bump (default)
bun run release

# Release specific package with automatic patch bump
bun run release --orm
bun run release --kit

# Use next (alias for patch bump)
bun run release --all --next

# Bump major/minor/patch
bun run release --all --major
bun run release --orm --minor
bun run release --kit --patch

# Set exact version
bun run release --orm --version=1.2.3
bun run release --kit --major=1 --minor=2 --patch=3
```

The release command will:
1. Check the current version in `package.json`
2. Compare with the published version on npm
3. Bump to the new version
4. Build the packages
5. Publish to npm

Skip build or publish if needed:
```bash
bun run release --all --next --no-build    # Only bump version
bun run release --all --next --no-publish  # Bump and build, don't publish
```

---

## License

MIT © [Pablo Fernandez Ruiz](https://github.com/pablofdezr)
