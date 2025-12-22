/**
 * HouseKit Relational Queries Example - ClickHouse-Style Joins
 * 
 * This example demonstrates HouseKit's advanced join capabilities
 * that go far beyond what standard ORMs offer. These are essential for
 * performant ClickHouse queries.
 */

import {
    defineTable,
    dictionary,
    s3,
    mysql,
    numbers,
    Engine,
    t,
    sql,
    eq
} from '../src';

// ============================================================================
// 1. Define Tables
// ============================================================================

// Main events table (high volume, billions of rows)
export const trades = defineTable('trades', (t) => ({
    id: t.uuid('id'),
    symbol: t.string('symbol'),
    price: t.float64('price'),
    quantity: t.uint64('quantity'),
    user_id: t.uint32('user_id'),
    executed_at: t.datetime('executed_at'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['symbol', 'executed_at'],
    partitionBy: 'toYYYYMM(executed_at)',
});

// Price quotes (for ASOF JOIN - time-series matching)
export const quotes = defineTable('quotes', (t) => ({
    symbol: t.string('symbol'),
    bid: t.float64('bid'),
    ask: t.float64('ask'),
    quote_time: t.datetime('quote_time'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['symbol', 'quote_time'],
});

// Orders table (for distributed queries)
export const orders = defineTable('orders', (t) => ({
    id: t.uuid('id'),
    user_id: t.uint32('user_id'),
    status: t.string('status'),
    total: t.float64('total'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.ReplicatedMergeTree(),
    orderBy: ['user_id', 'created_at'],
    onCluster: 'analytics_cluster', // This triggers GLOBAL JOIN intelligence
});

// Users table (small lookup table - perfect for Dictionary)
export const users = defineTable('users', (t) => ({
    id: t.uint32('id'),
    name: t.string('name'),
    country: t.string('country'),
    tier: t.string('tier'),
}), {
    engine: Engine.MergeTree(),
    orderBy: 'id',
});

console.log('='.repeat(80));
console.log('HouseKit ClickHouse-Style Relational Queries');
console.log('='.repeat(80));

// ============================================================================
// 2. Dictionary for Ultra-Fast Lookups
// ============================================================================

/**
 * Dictionary - Much faster than JOIN for lookup tables!
 * Data is loaded into memory and accessed via dictGet()
 */
const userDict = dictionary('user_dict', {
    id: t.uint32('id'),
    name: t.string('name'),
    country: t.string('country'),
    tier: t.string('tier'),
}, {
    source: {
        type: 'clickhouse',
        table: 'users',
    },
    layout: { type: 'hashed' },
    lifetime: 3600, // Reload hourly
    primaryKey: 'id',
});

console.log('\n1. DICTIONARY (Ultra-fast lookups without JOIN)');
console.log('-'.repeat(60));
console.log('CREATE DICTIONARY:\n', userDict.toSQL());

// Using dictGet instead of JOIN - O(1) lookup!
console.log('\nQuery with dictGet (no JOIN needed):');
console.log('SELECT');
console.log('  symbol,');
console.log('  price,');
console.log("  dictGet('user_dict', 'name', user_id) AS user_name,");
console.log("  dictGet('user_dict', 'country', user_id) AS user_country");
console.log('FROM trades');
console.log('WHERE price > 100');

// ============================================================================
// 3. External Data Sources
// ============================================================================

console.log('\n2. EXTERNAL DATA SOURCES (S3, MySQL, etc.)');
console.log('-'.repeat(60));

// S3 external table
const historicalData = s3({
    url: 's3://analytics-bucket/historical-trades/*.parquet',
    format: 'Parquet',
});

console.log('S3 External Table:', historicalData.$table);

// MySQL external table (join with legacy system)
const legacyUsers = mysql({
    host: 'mysql.internal',
    database: 'legacy_app',
    table: 'users',
    user: 'reader',
    password: '***',
});

console.log('MySQL External Table:', legacyUsers.$table);

// Numbers generator for date ranges
const dateRange = numbers(30);
console.log('Numbers Table:', dateRange.$table);

// ============================================================================
// 4. ClickHouse-Specific JOIN Types
// ============================================================================

console.log('\n3. CLICKHOUSE-SPECIFIC JOIN TYPES');
console.log('-'.repeat(60));

console.log(`
┌────────────────────────────────────────────────────────────────────────────┐
│ JOIN Type        │ Use Case                                               │
├────────────────────────────────────────────────────────────────────────────┤
│ GLOBAL JOIN      │ Distributed tables - sends right table to all shards  │
│ ANY JOIN         │ Return first match only - faster for unique keys       │
│ ALL JOIN         │ Return all matches (standard SQL behavior)             │
│ ASOF JOIN        │ Time-series: find closest match by ordered column      │
│ SEMI JOIN        │ EXISTS equivalent - rows that have a match             │
│ ANTI JOIN        │ NOT EXISTS equivalent - rows without matches           │
│ CROSS JOIN       │ Cartesian product (use carefully!)                     │
└────────────────────────────────────────────────────────────────────────────┘
`);

// Example: ASOF JOIN for time-series data
console.log('\n4. ASOF JOIN Example (Time-Series Matching):');
console.log('-'.repeat(60));
console.log(`
// Find the closest quote for each trade
db.select({
    symbol: trades.symbol,
    trade_price: trades.price,
    bid: quotes.bid,
    ask: quotes.ask,
    spread: sql\`quotes.ask - quotes.bid\`,
})
.from(trades)
.asofJoin(quotes, sql\`
    \${trades.symbol} = \${quotes.symbol} 
    AND \${trades.executed_at} >= \${quotes.quote_time}
\`)
.limit(100);

// Generates:
// SELECT ... 
// FROM trades 
// LEFT ASOF JOIN quotes 
//   ON trades.symbol = quotes.symbol 
//   AND trades.executed_at >= quotes.quote_time
`);

// Example: GLOBAL JOIN for distributed tables
console.log('\n5. GLOBAL JOIN Example (Distributed Clusters):');
console.log('-'.repeat(60));
console.log(`
// When 'orders' has onCluster set, HouseKit auto-suggests GLOBAL JOIN
// Without GLOBAL, you'd get incomplete results on distributed tables!

db.select({
    orderId: orders.id,
    userName: users.name,
})
.from(orders)
.globalLeftJoin(users, eq(orders.user_id, users.id));

// Generates:
// SELECT ... FROM orders GLOBAL LEFT JOIN users ON orders.user_id = users.id
// The right table is broadcast to all nodes automatically!
`);

// Example: ANY JOIN for unique key lookups
console.log('\n6. ANY JOIN Example (Performance Optimization):');
console.log('-'.repeat(60));
console.log(`
// When you KNOW the right table has unique keys, ANY JOIN is faster
// It returns the first match and stops searching

db.select({
    tradeId: trades.id,
    userName: users.name,
})
.from(trades)
.anyInnerJoin(users, eq(trades.user_id, users.id));

// Generates:
// SELECT ... FROM trades ANY INNER JOIN users ON trades.user_id = users.id
`);

// Example: SEMI and ANTI JOINs
console.log('\n7. SEMI/ANTI JOIN Examples (Efficient Filtering):');
console.log('-'.repeat(60));
console.log(`
// SEMI JOIN: Get users who have at least one order
db.select()
  .from(users)
  .semiJoin(orders, eq(users.id, orders.user_id));
// Generates: SELECT ... FROM users LEFT SEMI JOIN orders ON ...

// ANTI JOIN: Get users who have NEVER placed an order
db.select()
  .from(users)
  .antiJoin(orders, eq(users.id, orders.user_id));
// Generates: SELECT ... FROM users LEFT ANTI JOIN orders ON ...

// These are more efficient than EXISTS/NOT EXISTS subqueries!
`);

// ============================================================================
// 5. Smart Relational API
// ============================================================================

console.log('\n8. SMART RELATIONAL API (Automatic Strategy Selection):');
console.log('-'.repeat(60));
console.log(`
// HouseKit's buildRelationalAPI automatically detects distributed tables
// and applies the correct join strategy!

const db = buildRelationalAPI(client, { orders, users });

// For tables with 'onCluster' option, GLOBAL JOIN is used automatically
const result = await db.orders.findMany({
    with: { user: true },
    joinStrategy: 'auto', // Default: uses GLOBAL for distributed tables
});

// Override for specific cases:
await db.orders.findMany({
    with: { user: true },
    joinStrategy: 'global_any', // GLOBAL + ANY for max performance
});
`);

// Comparison with Standard ORMs
// -----------------------------------------------------------------------------

console.log('\n' + '='.repeat(80));
console.log('COMPARISON: HouseKit vs Standard ORMs for ClickHouse');
console.log('='.repeat(80));

console.log(`
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Feature                 │ Standard ORMs           │ HouseKit                │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ Join Syntax             │ Standard SQL (LEFT)     │ + ASOF, SEMI, ANTI, ANY │
│ ASOF JOIN               │ ❌ No support           │ ✅ Native .asofJoin()   │
│ GLOBAL JOIN             │ ❌ No support           │ ✅ Native .globalJoin() │
│ ARRAY JOIN              │ ❌ No support           │ ✅ Native .arrayJoin()  │
│ Type Safety             │ ✅ Good                 │ ✅ Excellent (ClickHouse)│
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
`);
