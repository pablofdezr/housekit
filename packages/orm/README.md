# @housekit/orm 🏠⚡️

**The high-performance, type-safe ClickHouse ORM for Node.js and Bun.**

> ⚠️ **Public Beta**: This package is currently in public beta. Feedback is highly appreciated as we polish the API for v1.0.

HouseKit ORM is a modern database toolkit designed specifically for ClickHouse. It bridges the gap between ergonomic developer experiences and the extreme performance requirements of high-volume OLAP workloads.

[![npm version](https://img.shields.io/npm/v/@housekit/orm.svg)](https://www.npmjs.com/package/@housekit/orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Key Features

- **🛡️ First-Class TypeScript**: Full type inference for every query. If it compiles, the schema matches your DB.
- **🏎️ Automatic Turbo Mode**: Native `RowBinary` serialization by default. Bypasses the overhead of JSON parsing for **5-10x faster inserts**.
- **🏗️ ClickHouse Native Engines**: Fluent DSL for `MergeTree`, `ReplacingMergeTree`, `SummingMergeTree`, `Distributed`, `Buffer`, and more.
- **🔍 Advanced Analytics**: Specialized support for `ASOF JOIN`, `ARRAY JOIN`, `PREWHERE`, and complex Window Functions.
- **🤝 Smart Relational API**: Query relations using `groupArray` internally, preventing row duplication and keeping data transfer lean.
- **📦 Background Batching**: Built-in buffering to collect small inserts into high-performance batches automatically.

---

## 📦 Installation

```bash
# HouseKit requires the official ClickHouse client as a peer dependency
npm install @housekit/orm @clickhouse/client
# or
bun add @housekit/orm @clickhouse/client
```

---

## ⚡️ Quick Start

### 1. Define your Table
Use the fluent `defineTable` API. All columns are **NOT NULL** by default, following ClickHouse best practices.

```typescript
import { defineTable, t, Engine } from '@housekit/orm';

export const webEvents = defineTable('web_events', {
  id: t.uuid('id').primaryKey(),
  eventType: t.string('event_type'),
  url: t.string('url'),
  revenue: t.decimal('revenue', 18, 4).default(0),
  tags: t.array(t.string('tag')),
  metadata: t.json('metadata'), // Native JSON type support
  at: t.datetime('at').default('now()'),
}, {
  engine: Engine.MergeTree(),
  orderBy: 'at',
  partitionBy: 'toYYYYMM(at)',
  ttl: 'at + INTERVAL 1 MONTH'
});
```

### 2. Connect and Query
HouseKit automatically picks up configuration from your environment or `housekit.config.ts`.

```typescript
import { createClient, eq, and, gte, sql } from '@housekit/orm';

const db = await createClient();

// Fully typed result inference
const results = await db.select({
    id: webEvents.id,
    path: webEvents.url,
    total: sql<number>`sum(${webEvents.revenue})`
  })
  .from(webEvents)
  .where(and(
    eq(webEvents.eventType, 'sale'),
    gte(webEvents.at, new Date('2024-01-01'))
  ))
  .groupBy(webEvents.id, webEvents.url)
  .limit(10);
```

---

## 🧠 Advanced Schema Definitions

### Complex Engines
HouseKit supports specialized ClickHouse engines with strict type checking for their parameters.

```typescript
// SummingMergeTree: Automatically aggregates numeric columns
export const dailyRevenue = defineTable('daily_revenue', {
  day: t.date('day'),
  revenue: t.float64('revenue'),
}, {
  engine: Engine.SummingMergeTree(['revenue']),
  orderBy: 'day'
});

// ReplacingMergeTree: Deduplicates data by version
export const users = defineTable('users', {
  id: t.uint64('id'),
  email: t.string('email'),
  version: t.uint64('version'),
}, {
  engine: Engine.ReplacingMergeTree('version'),
  
  // Portability: '{cluster}' references the server-side macro.
  // This allows your schema to be environment-agnostic.
  onCluster: '{cluster}', 
  
  orderBy: 'id'
});
```

### Dictionaries
Map external data or internal tables to fast in-memory dictionaries for ultra-low latency lookups.

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

## 🚀 High-Performance Data Ingestion

### Automatic Turbo Mode (RowBinary)
When you call `db.insert()`, HouseKit analyzes your schema. If all types are compatible, it automatically switches to **Turbo Mode**, using native binary serialization instead of JSON.

```typescript
await db.insert(webEvents).values([
  { id: '...', eventType: 'click', revenue: 0, metadata: { browser: 'chrome' } },
  { id: '...', eventType: 'purchase', revenue: 99.90, metadata: { browser: 'safari' } },
]);
// Logic: Object -> Buffer (Binary) -> ClickHouse Stream (Zero-copy)
```

### Background Batching
Collect small, frequent writes into large batches to prevent the "too many parts" error in ClickHouse.

```typescript
const builder = db.insert(webEvents)
  .batch({ 
    maxRows: 10000, 
    flushIntervalMs: 5000 
  });

// Add rows to the background queue.
// Proccessing and flushing happen automatically.
await builder.append(row1);
await builder.append(row2);
```

---

## 🛠️ Type-Safe Inserts

### Simple Repository Pattern

```typescript
async insertEvents(events: auditEvents[]) {
  return await db.insert(auditEvents).values(events);
}

// Usage
await repository.insertEvents([
  { venueId: 'venue-1', ingredientId: 'ing-1', type: 'restock', quantity: 100, at: new Date() },
  { venueId: 'venue-2', ingredientId: 'ing-2', type: 'sale', quantity: -50, at: new Date(), referenceId: null }
]);
```

### Type Helpers

```typescript
import { TableInsertArray } from '@housekit/orm';

// Using explicit type helper
async insertEvents(events: TableInsertArray<typeof salesEvents>) {
  return await db.insert(salesEvents).values(events);
}

// Using $inferInsert directly
async insertEvents(events: typeof salesEvents.$inferInsert[]) {
  return await db.insert(salesEvents).values(events);
}
```

**Note**: Autocomplete shows clean data types by default without exposing internal types.

---

## 🤝 Smart Relational API

Traditional ORMs produce "Flat Joins" that duplicate data (the Cartesian Product problem). HouseKit's Relational API uses ClickHouse's `groupArray` internally to fetch related data as nested arrays in a single, efficient query.

```typescript
const usersWithData = await db.query.users.findMany({
  with: {
    posts: {
      where: (p) => eq(p.published, true),
      limit: 5
    },
    profile: true
  },
  limit: 10
});

// Result structure:
// [{ id: 1, name: 'Alice', posts: [{ title: '...', ... }], profile: { bio: '...' } }]
```

### Advanced Relational Engine
HouseKit's relational API is optimized for ClickHouse:
- **Filtered Relations**: Where clauses in `with` blocks are executed server-side using `groupUniqArrayIf`.
- **Nested Pagination**: Control the size of related collections with `limit` and `offset` directly in the relation config.
- **Smart Deduplication**: Merges results in-memory to handle row multiplication from complex joins.

---

## 🛠 SQL Utilities

### Dynamic Queries with `sql.join`
Easily build complex queries by joining SQL fragments with separators.

```typescript
const conditions = [
  eq(users.active, true),
  gte(users.age, 18)
];

const query = db.select()
  .from(users)
  .where(sql.join(conditions, sql` AND `));
```

---

## 🔍 Specialized ClickHouse Joins

### ASOF JOIN
The industry standard for time-series matches (e.g., matching a trade with the closest price quote).

```typescript
const matched = await db.select()
  .from(trades)
  .asofJoin(quotes, sql`${trades.symbol} = ${quotes.symbol} AND ${trades.at} >= ${quotes.at}`)
  .limit(100);
```

### GLOBAL JOIN
Essential for distributed setups to avoid local-data-only results on sharded clusters.

```typescript
db.select().from(distributedTable).globalJoin(rightTable, condition);
```

---

## 🛠 Observability & Logging

Inject a custom logger to monitor query performance, throughput, and error rates.

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