# HouseKit 🏠⚡️

**The modern developer experience for ClickHouse.**

> ⚠️ **Public Beta**: HouseKit is currently in public beta. While the core API is stable and used in production, some advanced features may change as we head towards v1.0. Contributions and feedback are welcome!

HouseKit is a next-generation toolkit designed to bridge the gap between high-performance OLAP databases and ergonomic, type-safe development. Inspired by best-in-class developer experiences, HouseKit brings first-class TypeScript support to ClickHouse.

---

## 📦 Project Structure

HouseKit is a monorepo consisting of two core components:

### [1. @housekit/orm](./packages/orm)
The high-performance core.
- **Turbo Mode**: Native `RowBinary` serialization for 5-10x faster inserts than JSON.
- **Type-Safe DSL**: Fully typed query builder and schema definition.
- **Relational API**: Optimized one-to-many and one-to-one fetching using ClickHouse's `groupArray`.
- **Background Batching**: Use `.batch()` and `.append(row)` for ultra-low latency, high-throughput writes.

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
| **Performance First** | Automatic binary serialization (RowBinary) bypasses heavy JSON parsing on the server. |
| **Zero Dependencies** | Powered by `jiti` for native TS loading—no `ts-node` or heavy build steps required. |
| **Blue-Green Migrations** | Safe, zero-downtime structural changes for Materialized Views and Tables. |
| **Production Ready** | Designed for modern workflows with ESM-first architecture and full type inference. |

---

## 🛠 Quick Start

If you want to start managing your ClickHouse schema with HouseKit:

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

## 📖 Documentation

Detailed documentation for each component can be found in their respective directories:
- [ORM Core Documentation & API Reference](./packages/orm/README.md)
- [CLI Commands & Workflow Guide](./packages/kit/README.md)

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

---

## License

MIT © [Pablo Fernandez Ruiz](https://github.com/pablofdezr)