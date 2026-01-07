# @housekit/orm 🏠⚡️

**The high-performance, type-safe ClickHouse ORM for Node.js and Bun.**

> ⚠️ **Public Beta**: This package is currently in public beta. Feedback is highly appreciated as we polish the API for v1.0.

> [!TIP]
> **Interactive Docs**: Use [RepoGrep](https://app.ami.dev/repogrep?repo=https://github.com/pablofdezr/housekit) to search and query the entire codebase and documentation for free (Updated instantly).

> [!TIP]
> **Ask ZRead**: Need deep insights? [Ask ZRead](https://zread.ai/pablofdezr/housekit) for AI-powered understanding of the codebase (Updated weekly).

> [!TIP]
> **Ask Devin AI**: Have questions about integrating HouseKit? [Ask the Wiki](https://deepwiki.com/pablofdezr/housekit) for AI-powered assistance (Updated weekly).

HouseKit ORM is a modern database toolkit designed specifically for ClickHouse. It bridges the gap between ergonomic developer experiences and the extreme performance requirements of high-volume OLAP workloads.

[![npm version](https://img.shields.io/npm/v/@housekit/orm.svg)](https://www.npmjs.com/package/@housekit/orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/Docs-RepoGrep-teal?style=flat-square)](https://app.ami.dev/repogrep?repo=https://github.com/pablofdezr/housekit)
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMUgxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTk4IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/pablofdezr/housekit)
[![Documentation](https://img.shields.io/badge/Wiki-Devin%20AI-blueviolet?style=flat-square)](https://deepwiki.com/pablofdezr/housekit)
[![Documentation](https://img.shields.io/badge/Docs-WarpGrep-blue?style=flat-square)](https://www.morphllm.com/playground/na/warpgrep?repo=pablofdezr%2Fhousekit)

---

## 🚀 Key Features

- **🛡️ First-Class TypeScript**: Full type inference for every query. Schema definition acts as the single source of truth.
- **🏎️ High-Performance Inserts**: Optimized streaming with JSONCompact format and sync insert mode.
- **🏗️ ClickHouse Native Engines**: Fluent DSL for `MergeTree`, `ReplacingMergeTree`, `SummingMergeTree`, `Distributed`, `Buffer`, and more.
- **🔍 Advanced Analytics**: Specialized support for `ASOF JOIN`, `ARRAY JOIN`, `PREWHERE`, and complex Window Functions.
- **🤝 Smart Relational API**: Query relations using `groupArray` internally, preventing row duplication.
- **📦 Background Batching**: Built-in buffering to collect small inserts into high-performance batches automatically.

---

## 📦 Installation

```bash
bun add @housekit/orm @clickhouse/client
```

---

## ⚡️ Quick Start

### 1. Define your Table

```typescript
// schema.ts
import { defineTable, t, Engine, relations } from '@housekit/orm';

export const users = defineTable('users', {
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey(),
  email: t.string('email'),
  role: t.enum('role', ['admin', 'user']),
  ...t.timestamps(),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'id'
});

export const posts = defineTable('posts', {
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey(),
  userId: t.uuid('user_id'),
  title: t.string('title'),
  createdAt: t.timestamp('created_at').default('now()'),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'createdAt'
});

relations(users, ({ many }) => ({
  posts: many(posts, { fields: [users.id], references: [posts.userId] })
}));

export type User = typeof users.$type;
export type NewUser = typeof users.$insert;
```

#### UUID Generation Options

HouseKit supports two approaches for UUID generation:

| Approach | Method | When to Use |
|----------|--------|-------------|
| **Client-side** | `.autoGenerate({ version: 7 })` | When using `.returning()` or `.returningOne()` |
| **Server-side** | `.default('generateUUIDv7()')` | When you don't need the ID back immediately |

```typescript
// Client-side generation (recommended for most cases)
// UUID is generated in JS before insert, works with returning()
id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey()

// Server-side generation
// UUID is generated by ClickHouse, cannot use returning()
id: t.uuid('id').primaryKey().default('generateUUIDv7()')
```

**Note:** Don't combine both - it's redundant. Choose one based on whether you need `.returning()` support.

### 2. Connect and Query

```typescript
import { housekit } from '@housekit/orm';
import * as schema from './schema';

const db = housekit({ url: 'http://localhost:8123' }, { schema });

// Standard insert (no data returned)
await db.insert(schema.users).values({ email: 'a@b.com', role: 'admin' });

// JSON insert with returning data
const [user] = await db
  .insert(schema.users)
  .values({ email: 'a@b.com', role: 'admin' })
  .returning();
```

---

## 🔍 Relational Query API

### findMany / findFirst

```typescript
const users = await db.query.users.findMany({
  where: { role: 'admin', active: true },
  columns: { id: true, email: true },
  orderBy: (cols, { desc }) => desc(cols.createdAt),
  limit: 10,
  with: {
    posts: { limit: 5 }
  }
});
```

### findById

```typescript
// Simple lookup
const user = await db.query.users.findById('uuid-here');

// With relations
const user = await db.query.users.findById('uuid-here', {
  with: { posts: true }
});
```

### where syntax

```typescript
// Object syntax (simplest)
where: { email: 'a@b.com' }
where: { role: 'admin', active: true }  // AND implícito

// Direct expression
where: eq(users.role, 'admin')

// Callback for complex filters
where: (cols, { and, gt, inArray }) => and(
  gt(cols.age, 18),
  inArray(cols.role, ['admin', 'moderator'])
)
```

Available operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `inArray`, `notInArray`, `between`, `notBetween`, `has`, `hasAll`, `hasAny`, `and`, `or`, `not`, `isNull`, `isNotNull`

### columns selection

Select specific columns:

```typescript
const users = await db.query.users.findMany({
  columns: { id: true, email: true }
});
// Returns: [{ id: '...', email: '...' }]
```

### orderBy

```typescript
// Callback (recommended)
orderBy: (cols, { desc }) => desc(cols.createdAt)

// Multiple columns
orderBy: (cols, { desc, asc }) => [desc(cols.createdAt), asc(cols.name)]

// Direct value
orderBy: desc(users.createdAt)

// Array
orderBy: [desc(users.createdAt), asc(users.name)]
```

---

## 🚀 High-Performance Inserts

### Default Insert (Sync Mode)

HouseKit uses synchronous inserts by default for maximum speed:

```typescript
// Standard insert - uses sync mode automatically
await db.insert(events).values([
  { type: 'click', userId: '...' },
  { type: 'view', userId: '...' },
]);
```

### Async Insert (Server-Side Batching)

Use `.asyncInsert()` when you want ClickHouse to batch writes internally:

```typescript
await db.insert(events).values(data).asyncInsert();
```

### JSON Insert with Returning

Use `.returningOne()` for single inserts or `.returning()` for multiple:

```typescript
// Single insert
const user = await db
  .insert(users)
  .values({ email: 'a@b.com', role: 'admin' })
  .returningOne();

console.log(user.id); // Generated UUID

// Multiple inserts
const [user1, user2] = await db
  .insert(users)
  .values([{ email: 'a@b.com' }, { email: 'b@c.com' }])
  .returning();
```

### Background Batching

Collect small writes into efficient batches:

```typescript
const builder = db.insert(events).batch({ 
  maxRows: 10000, 
  flushIntervalMs: 5000 
});

// Fire-and-forget
await builder.append(event1);
await builder.append(event2);
```

---

## 🧠 Advanced Schema

### Complex Engines

```typescript
// SummingMergeTree
export const dailyRevenue = defineTable('daily_revenue', {
  day: t.date('day'),
  revenue: t.float64('revenue'),
}, {
  engine: Engine.SummingMergeTree(['revenue']),
  orderBy: 'day'
});

// ReplacingMergeTree
export const users = defineTable('users', {
  id: t.uint64('id'),
  email: t.string('email'),
  version: t.uint64('version'),
}, {
  engine: Engine.ReplacingMergeTree('version'),
  onCluster: '{cluster}',
  orderBy: 'id'
});
```

### Dictionaries

```typescript
import { defineDictionary } from '@housekit/orm';

export const userCache = defineDictionary('user_dict', {
  id: t.uint64('id'),
  country: t.string('country')
}, {
  source: { table: users },
  layout: { type: 'hashed' },
  lifetime: 300
});
```

---

## 🔍 Specialized Joins

### ASOF JOIN

```typescript
const matched = await db.select()
  .from(trades)
  .asofJoin(quotes, sql`${trades.symbol} = ${quotes.symbol} AND ${trades.at} >= ${quotes.at}`)
  .limit(100);
```

### GLOBAL JOIN

```typescript
await db.select()
  .from(distributedTable)
  .globalJoin(rightTable, condition);
```

---

## 🛠 SQL Utilities

### Dynamic Queries

```typescript
const conditions = [
  eq(users.active, true),
  gte(users.age, 18)
];

const query = await db.select()
  .from(users)
  .where(sql.join(conditions, sql` AND `));
```

---

## 📊 Benchmarks

Performance tested on local ClickHouse (Docker) with Bun runtime:

| Rows | Method | Time | Throughput |
|------|--------|------|------------|
| 1,000 | JSON | 19ms | 52,632 rows/sec |
| 1,000 | JSON Sync | 13ms | 76,923 rows/sec |
| 5,000 | JSON | 118ms | 42,373 rows/sec |
| 5,000 | JSON Sync | 54ms | 92,593 rows/sec |
| 10,000 | JSON | 159ms | 62,893 rows/sec |
| 10,000 | JSON Sync | 161ms | 62,112 rows/sec |

Key findings:
- **Sync insert is the default** - fastest for most use cases
- For batches <5k rows, sync is up to **2x faster**
- For larger batches (10k+), performance is similar
- Use `.asyncInsert()` only when you need server-side batching

Run the benchmark yourself:
```bash
bun run benchmark  # in app directory
```

---

## ⚡ Performance Optimizations

HouseKit includes several optimizations for maximum throughput in production environments.

### Connection Pooling

Reuse HTTP connections across requests:

```typescript
const db = housekit({
  url: 'http://localhost:8123',
  pool: {
    maxSockets: 200,      // Max concurrent connections
    keepAlive: true,      // Reuse connections
    timeout: 30000        // Socket timeout (ms)
  }
}, { schema });
```

### Skip Validation

Bypass enum validation in production when you trust your data source:

```typescript
// Global (all inserts)
const db = housekit({
  url: 'http://localhost:8123',
  skipValidation: true
}, { schema });

// Per-insert
await db.insert(events).values(data).skipValidation();
```

---

## 🛠 Observability

```typescript
const db = await createClient({
  logger: {
    logQuery: (sql, params, duration, stats) => {
      console.log(`[Query] ${duration}ms | Rows: ${stats.readRows}`);
    },
    logError: (err, sql) => console.error(`[Error] ${err.message}`)
  }
});
```

---

## License

MIT © [Pablo Fernandez Ruiz](https://github.com/pablofdezr)
