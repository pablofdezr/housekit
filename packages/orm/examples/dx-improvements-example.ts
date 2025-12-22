/**
 * Example: DX Improvements in HouseKit ORM
 * 
 * This file demonstrates the new Developer Experience improvements:
 * 1. Bundle imports with `t` object (reduces import verbosity)
 * 2. Simplified select syntax with `select(table)`
 * 3. OrderBy with column keys
 * 4. Thenable pattern (no .execute() needed)
 */

import {
    createClient,
    // New API: t and defineTable
    t,
    defineTable,
    Engine,
    eq,
    and,
    gt,
    sql
} from '../src';

// =============================================================================
// 1. BUNDLE IMPORTS WITH `t` OBJECT
// =============================================================================

// ❌ OLD WAY: Verbose imports
// import { uuid, string, int32, datetime, bool, float64 } from '@housekit/orm';
// const usersOld = chTable('users', {
//     id: uuid('id').primaryKey(),
//     name: string('name'),
//     age: int32('age'),
// });

// ✅ NEW WAY: Using `t` object - all types in one place with autocomplete!
const users = defineTable('users', {
    id: t.uuid('id').primaryKey().autoGenerate(),
    name: t.string('name'),
    email: t.string('email'),
    age: t.int32('age').nullable(),
    createdAt: t.datetime('created_at').default('now()'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'createdAt',  // ✅ Uses column key, not column name
});

// ✅ NEW WAY: Callback pattern (Fluent API)
const events = defineTable('events', (t) => ({
    id: t.uuid('id').primaryKey().autoGenerate(),
    userId: t.uuid('user_id'),
    eventType: t.string('event_type'),
    metadata: t.json<{ source: string; ip?: string }>('metadata'),
    timestamp: t.datetime('timestamp').default('now()'),
}), {
    engine: Engine.MergeTree(),
    orderBy: 'timestamp',
    partitionBy: 'toYYYYMM(timestamp)',
});

// =============================================================================
// 2. SIMPLIFIED SELECT SYNTAX
// =============================================================================

async function demonstrateSimplifiedSelect() {
    const db = createClient({ url: 'http://localhost:8123' });

    // ❌ OLD WAY: Verbose
    const oldWay = await db.select().from(users).where(eq(users.age, 25));

    // ✅ NEW WAY: Pass table directly to select!
    const newWay = await db.select(users).where(eq(users.age, 25));
    // select(table) is shorthand for select().from(table)

    // ✅ Specific fields still works the same
    const specificFields = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(gt(users.age, 18));

    // ✅ Complex queries work too
    const complexQuery = await db
        .select(events)
        .where(and(
            eq(events.eventType, 'click'),
            gt(events.timestamp, sql`now() - INTERVAL 1 DAY`)
        ))
        .orderBy(events.timestamp, 'DESC')
        .limit(100);

    return { oldWay, newWay, specificFields, complexQuery };
}

// =============================================================================
// 3. ORDERBY WITH COLUMN KEYS (Type-safe!)
// =============================================================================

const ordersTable = defineTable('orders', (t) => ({
    id: t.uuid('id').primaryKey(),
    customerId: t.uuid('customer_id'),
    amount: t.decimal64('amount', 2),
    status: t.string('status'),
    createdAt: t.datetime('created_at').default('now()'),
}), {
    engine: Engine.ReplacingMergeTree('createdAt'),  // Uses column key!
    orderBy: ['customerId', 'createdAt'],  // Uses column keys!
    partitionBy: 'toYYYYMM(created_at)',  // Can still use expressions
});

// =============================================================================
// 4. THENABLE PATTERN - NO .execute() NEEDED!
// =============================================================================

async function demonstrateThenablePattern() {
    const db = createClient({ url: 'http://localhost:8123' });

    // ✅ All builders are Thenable - just await them!

    // SELECT - already thenable
    const selectResult = await db.select(users).limit(10);

    // INSERT - thenable (no .execute() needed!)
    await db.insert(users).values({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
    });
    // ❌ No need for: .execute()

    // INSERT MANY - thenable
    await db.insert(users).values([
        { name: 'Alice', email: 'alice@example.com', age: 25 },
        { name: 'Bob', email: 'bob@example.com', age: 35 },
    ]);

    // UPDATE - thenable
    await db.update(users)
        .set({ age: 31 })
        .where(eq(users.email, 'john@example.com'));
    // ❌ No need for: .execute()

    // DELETE - thenable
    await db.delete(users)
        .where(eq(users.email, 'john@example.com'));
    // ❌ No need for: .execute()

    return selectResult;
}

// =============================================================================
// COMPARISON: Before vs After
// =============================================================================

/*
BEFORE (verbose):
```typescript
import { 
    chTable, uuid, string, int32, datetime, bool, float64, 
    array, map, json, decimal, Engine
} from '@housekit/orm';

const users = chTable('users', {
    id: uuid('id').primaryKey(),
    name: string('name'),
    age: int32('age').nullable(),
    createdAt: datetime('created_at'),
});

// Query
const results = await db.select().from(users).where(eq(users.age, 25));

// Insert
await db.insert(users).values({ name: 'John' }).execute();
```

AFTER (DX improved):
```typescript
import { defineTable, t, Engine } from '@housekit/orm';

const users = defineTable('users', {
    id: t.uuid('id').primaryKey(),
    name: t.string('name'),
    age: t.int32('age').nullable(),
    createdAt: t.datetime('created_at'),
});

// Query - table passed directly!
const results = await db.select(users).where(eq(users.age, 25));

// Insert - no .execute()!
await db.insert(users).values({ name: 'John' });
```
*/

export { users, events, ordersTable, demonstrateSimplifiedSelect, demonstrateThenablePattern };
