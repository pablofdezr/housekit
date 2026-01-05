# HouseKit 🏠⚡️

**The modern developer experience for ClickHouse.**

> ⚠️ **Public Beta**: HouseKit is currently in public beta. While the core API is stable and used in production, some advanced features may change as we head towards v1.0. Contributions and feedback are welcome!

HouseKit is a next-generation toolkit designed to bridge the gap between high-performance OLAP databases and ergonomic, type-safe development. Inspired by best-in-class developer experiences, HouseKit brings first-class TypeScript support to ClickHouse.

---

## 📦 Project Structure

HouseKit is a monorepo consisting of two core components:

### [1. @housekit/orm](./packages/orm)
The high-performance core.
- **Turbo Mode**: Native `RowBinary` serialization for 5-10x faster inserts than JSON (default).
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

---

## 🚀 Key Advantages

| Feature | Why it matters |
| :--- | :--- |
| **Modern DX** | Focus on building your app, not fighting with SQL strings or clunky ORMs. |
| **Performance First** | Binary serialization (RowBinary) by default—bypasses heavy JSON parsing. |
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

// Binary insert (default, fastest)
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
