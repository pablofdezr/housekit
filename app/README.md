# HouseKit Demo App 🚀

Demo application showcasing HouseKit ORM capabilities with ClickHouse.

## Setup

```bash
# Start ClickHouse
docker-compose up -d

# Install dependencies
bun install

# Run the demo
bun run app
```

## Benchmark

Run performance benchmarks:

```bash
bun run benchmark
```

Sample results (local ClickHouse, Bun runtime):

| Rows | JSONCompact | Sync Insert | Throughput |
|------|-------------|-------------|------------|
| 1,000 | 67ms | 12ms | 83k rows/sec |
| 5,000 | 56ms | 56ms | 89k rows/sec |
| 10,000 | 158ms | 162ms | 63k rows/sec |

## What it does

1. Creates `users` and `events` tables
2. Inserts 10 users with JSON format (returns created data)
3. Bulk inserts 10,000 events with binary format (fastest)
4. Queries users with their related events using the Relational API
5. Shows analytics summary

## Schema

```typescript
// users table
const users = defineTable('users', {
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey(),
  email: t.string('email'),
  role: t.enum('role', ['admin', 'user']),
  password: t.string('password'),
  phone_number: t.string('phone_number'),
  ...t.timestamps(),
}, { engine: Engine.MergeTree(), orderBy: 'id' });

// events table
const events = defineTable('events', {
  id: t.uuid('id').autoGenerate({ version: 7 }).primaryKey(),
  userId: t.uuid('user_id'),
  type: t.string('type'),
  createdAt: t.timestamp('created_at').default('now()'),
}, { engine: Engine.MergeTree(), orderBy: 'createdAt' });

// Relation
relations(users, ({ many }) => ({
  events: many(events, { fields: [users.id], references: [events.userId] })
}));
```

## Key Features Demonstrated

### Insert Methods

```typescript
// Standard insert - fastest, no data returned
await db.insert(events).values(bulkEvents);

// JSON insert with returning - returns inserted data
const created = await db.insert(users).values(newUsers).returning();

// Sync insert - fastest for small batches
await db.insert(events).values(data).syncInsert();
```

### Relational Queries

```typescript
const usersWithEvents = await db.query.users.findMany({
  with: {
    events: {
      limit: 3,
      orderBy: (e, { desc }) => [desc(e.createdAt)]
    }
  },
  limit: 5,
});
```

### Raw SQL

```typescript
const stats = await db.raw(`
  SELECT type, count() as total
  FROM events
  GROUP BY type
  ORDER BY total DESC
`);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLICKHOUSE_URL` | `http://localhost:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_USER` | `admin` | Username |
| `CLICKHOUSE_PASSWORD` | `admin` | Password |
| `CLICKHOUSE_DB` | `default` | Database name |
