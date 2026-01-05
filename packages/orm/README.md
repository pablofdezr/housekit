# @housekit/orm 🏠⚡️

**The high-performance, type-safe ClickHouse ORM for Node.js and Bun.**

> ⚠️ **Public Beta**: This package is currently in public beta. Feedback is highly appreciated as we polish the API for v1.0.

HouseKit ORM is a modern database toolkit designed specifically for ClickHouse. It bridges the gap between ergonomic developer experiences and the extreme performance requirements of high-volume OLAP workloads.

[![npm version](https://img.shields.io/npm/v/@housekit/orm.svg)](https://www.npmjs.com/package/@housekit/orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey().default('generateUUIDv7()'),
  email: t.string('email'),
  role: t.enum('role', ['admin', 'user']),
  ...t.timestamps(),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'id'
});

export const posts = defineTable('posts', {
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey().default('generateUUIDv7()'),
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
