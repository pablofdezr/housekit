/**
 * Example: Secret Weapons of HouseKit ORM
 * 
 * This example demonstrates advanced features that surpass typical ORMs:
 * 1. Smart Materialized View Migrations (Blue-Green)
 * 2. Automatic Projection Optimization
 * 3. Schema-driven Performance (Async Inserts)
 * 4. Ultra-fast Binary Result Parsing
 */

import {
    t,
    defineTable,
    materializedView,
    createClient,
    Engine,
    sql,
    generateBlueGreenMigration
} from '../src';

// 1. PERFORMANCE AT SCHEMA LEVEL
// HouseKit automatically manages async_insert based on appendOnly: true
const rawLogs = defineTable('raw_logs', {
    timestamp: t.datetime('timestamp'),
    level: t.string('level'),
    message: t.string('message'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'timestamp',
    appendOnly: true, // 🚀 HouseKit will use async_insert: 1 automatically
});

// 2. TYPE-SAFE MATERIALIZED VIEWS with BLUE-GREEN DEPLOYMENT
const logsCountByLevel = defineTable('logs_count_by_level', {
    level: t.string('level'),
    count: t.uint64('count'),
}, {
    engine: Engine.SummingMergeTree(['count']),
    orderBy: 'level',
});

// If you change the query here, the CLI will detect the drift and
// offer a Blue-Green deployment plan.
export const logsCountMV = materializedView('logs_count_mv', logsCountByLevel.$columns, {
    source: rawLogs,
    toTable: logsCountByLevel,
    query: (qb) => qb
        .from(rawLogs)
        .select({
            level: rawLogs.level,
            count: sql`count()`
        })
        .groupBy(rawLogs.level),
});

// 3. AUTOMATIC PROJECTION OPTIMIZATION
const users = defineTable('users', {
    id: t.uuid('id').primaryKey(),
    country: t.string('country'),
    age: t.int32('age'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'id',
    projections: [
        // A projection for fast country-based counts
        {
            name: 'count_by_country',
            query: 'SELECT country, count() GROUP BY country'
        }
    ]
});

async function demonstrateAdvacedFeatures() {
    const db = await createClient();

    // 🚀 HouseKit will automatically add SETTINGS use_projection = 1
    // because it detects the table has projections!
    const results = await db
        .select({
            country: users.country,
            count: sql`count()`
        })
        .from(users)
        .groupBy(users.country);

    // 🚀 LARGE QUERY OPTIMIZATION
    // If limit >= 100k, HouseKit switches from JSONEachRow to RowBinary
    // and uses a custom binary parser that is 10-20x faster.
    const largeResult = await db
        .select(rawLogs)
        .limit(200000);

    // 🚀 BLUE-GREEN MIGRATION PREVIEW
    // You can programmatically generate the migration SQL
    const migration = generateBlueGreenMigration(logsCountMV, logsCountMV, { backfill: true });
    console.log('Blue-Green Migration Plan:', migration);
}
