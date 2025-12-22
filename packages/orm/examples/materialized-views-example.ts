/**
 * HouseKit Materialized Views Example
 * 
 * This example demonstrates the type-safe materialized view system,
 * which provides compile-time validation of column references.
 * If you rename a column in the source table, TypeScript catches
 * the error before deployment.
 */

import {
    defineTable,
    defineMaterializedView,
    index,
    projection,
    Engine,
    t,
    sql
} from '../src';

// ============================================================================
// 1. Define Source Tables
// ============================================================================

export const webEvents = defineTable('web_events', (t) => ({
    id: t.uuid('id'),
    device_id: t.string('device_id'),
    event_type: t.string('event_type'),
    page_url: t.string('page_url'),
    revenue: t.uint64('revenue'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['device_id', 'created_at'],
    partitionBy: 'toYYYYMM(created_at)',
});

console.log('Source Table (webEvents):\n', webEvents.toSQL(), '\n');

// ============================================================================
// 2. Type-Safe Materialized View - Revenue by Event Type
// ============================================================================

/**
 * This materialized view aggregates revenue by event type.
 * 
 * KEY BENEFIT: If you rename 'revenue' to 'amount' in webEvents,
 * TypeScript will immediately show an error here because
 * `webEvents.revenue` no longer exists!
 * 
 * Standard ORMs would silently let this pass and fail at runtime.
 */
export const revenueByEventMV = defineMaterializedView('revenue_by_event_mv', (t) => ({
    event_type: t.string('event_type'),
    total_revenue: t.uint64('total_revenue'),
    event_count: t.uint64('event_count'),
}), {
    // Type-safe query builder
    query: (qb) => qb
        .from(webEvents)
        .select({
            event_type: webEvents.event_type,
            // If you typo 'revenue' as 'revnue', TypeScript catches it!
            total_revenue: sql`sum(${webEvents.revenue})`,
            event_count: sql`count()`,
        })
        .groupBy(webEvents.event_type),
    // Using the type-safe Engine DSL
    engine: Engine.SummingMergeTree(['total_revenue', 'event_count']),
    orderBy: 'event_type',
});

console.log('Revenue by Event Type MV:\n', revenueByEventMV.toSQL(), '\n');
console.log('Query Hash (for drift detection):', (revenueByEventMV as any).getQueryHash?.(), '\n');

// ============================================================================
// 3. Materialized View with Filter
// ============================================================================

/**
 * Only aggregate purchase events with revenue > 0
 */
export const purchaseStatsMV = defineMaterializedView('purchase_stats_mv', (t) => ({
    device_id: t.string('device_id'),
    purchase_count: t.uint64('purchase_count'),
    total_spent: t.uint64('total_spent'),
    avg_order_value: t.float64('avg_order_value'),
}), {
    query: (qb) => qb
        .from(webEvents)
        .select({
            device_id: webEvents.device_id,
            purchase_count: sql`count()`,
            total_spent: sql`sum(${webEvents.revenue})`,
            avg_order_value: sql`avg(${webEvents.revenue})`,
        })
        .where(sql`${webEvents.event_type} = 'purchase' AND ${webEvents.revenue} > 0`)
        .groupBy(webEvents.device_id),
    engine: Engine.AggregatingMergeTree(),
    orderBy: 'device_id',
});

console.log('Purchase Stats MV:\n', purchaseStatsMV.toSQL(), '\n');

// ============================================================================
// 4. Materialized View with Target Table (TO clause)
// ============================================================================

// First, create the target table
export const dailyStatsTable = defineTable('daily_stats', (t) => ({
    date: t.datetime('date'),
    total_events: t.uint64('total_events'),
    total_revenue: t.uint64('total_revenue'),
    unique_devices: t.uint64('unique_devices'),
}), {
    engine: Engine.SummingMergeTree(['total_events', 'total_revenue', 'unique_devices']),
    orderBy: 'date',
});

// Then create the MV that writes to it
export const dailyStatsMV = defineMaterializedView('daily_stats_mv', (t) => ({
    date: t.datetime('date'),
    total_events: t.uint64('total_events'),
    total_revenue: t.uint64('total_revenue'),
    unique_devices: t.uint64('unique_devices'),
}), {
    query: (qb) => qb
        .from(webEvents)
        .select({
            date: sql`toStartOfDay(${webEvents.created_at})`,
            total_events: sql`count()`,
            total_revenue: sql`sum(${webEvents.revenue})`,
            unique_devices: sql`uniqExact(${webEvents.device_id})`,
        })
        .groupBy(sql`toStartOfDay(${webEvents.created_at})`),
    // Using TO clause to write to existing table
    toTable: dailyStatsTable,
});

console.log('Daily Stats Target Table:\n', dailyStatsTable.toSQL(), '\n');
console.log('Daily Stats MV (with TO clause):\n', dailyStatsMV.toSQL(), '\n');

// ============================================================================
// 5. Clustered Materialized View
// ============================================================================

export const clusteredMV = defineMaterializedView('clustered_revenue_mv', (t) => ({
    event_type: t.string('event_type'),
    total_revenue: t.uint64('total_revenue'),
}), {
    query: (qb) => qb
        .from(webEvents)
        .select({
            event_type: webEvents.event_type,
            total_revenue: sql`sum(${webEvents.revenue})`,
        })
        .groupBy(webEvents.event_type),
    // Cluster support
    onCluster: 'analytics_cluster',
    engine: Engine.ReplicatedMergeTree({
        baseEngine: 'SummingMergeTree',
        sumColumns: ['total_revenue'],
    }),
    orderBy: 'event_type',
});

console.log('Clustered MV:\n', clusteredMV.toSQL(), '\n');

// ============================================================================
// 6. Type-Safe Projections
// ============================================================================

/**
 * Projections are pre-computed aggregations stored with the table.
 * ClickHouse automatically uses them when a query matches.
 */
export const webEventsWithProjection = defineTable('web_events_with_proj', (t) => ({
    id: t.uuid('id'),
    device_id: t.string('device_id'),
    event_type: t.string('event_type'),
    revenue: t.uint64('revenue'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['device_id', 'created_at'],
    // Add type-safe projection
    projections: [
        projection('events_by_user_proj', (cols) => ({
            select: {
                device_id: cols.device_id,
                event_type: cols.event_type,
                event_count: sql`count()`,
            },
            groupBy: [cols.device_id, cols.event_type],
            orderBy: ['device_id', 'event_type'],
        }))
    ],
});

console.log('Table with Projection:\n', webEventsWithProjection.toSQL(), '\n');

// ============================================================================
// 7. POPULATE Example (Backfill Existing Data)
// ============================================================================

export const populatedMV = defineMaterializedView('populated_stats_mv', (t) => ({
    event_type: t.string('event_type'),
    first_seen: t.datetime('first_seen'),
    last_seen: t.datetime('last_seen'),
}), {
    query: (qb) => qb
        .from(webEvents)
        .select({
            event_type: webEvents.event_type,
            first_seen: sql`min(${webEvents.created_at})`,
            last_seen: sql`max(${webEvents.created_at})`,
        })
        .groupBy(webEvents.event_type),
    engine: Engine.ReplacingMergeTree('last_seen'),
    orderBy: 'event_type',
    // POPULATE will backfill from existing data
    populate: true,
});

console.log('MV with POPULATE:\n', populatedMV.toSQL(), '\n');

// ============================================================================
// 8. OR REPLACE Example
// ============================================================================

export const replaceableMV = defineMaterializedView('replaceable_mv', (t) => ({
    event_type: t.string('event_type'),
    count: t.uint64('count'),
}), {
    query: (qb) => qb
        .from(webEvents)
        .select({
            event_type: webEvents.event_type,
            count: sql`count()`,
        })
        .groupBy(webEvents.event_type),
    engine: Engine.SummingMergeTree(['count']),
    orderBy: 'event_type',
    // Use OR REPLACE for idempotent deployments
    orReplace: true,
});

console.log('MV with OR REPLACE:\n', replaceableMV.toSQL(), '\n');

// ============================================================================
// Benefits Summary
// ============================================================================

console.log(`
║           HouseKit Materialized Views vs Standard ORMs                      ║
╠═════════════════════════════════════════════════════════════════════════════╣
║  Standard ORMs (string-based, no validation):                               ║
║  - CREATE MATERIALIZED VIEW ... (manual string)                             ║
║  ────────────────────────────────────────                                   ║
║  query: 'SELECT event_type, sum(revenue) FROM events GROUP BY event_type'   ║
║  // If you rename 'revenue' to 'amount', no compile error!                  ║
║  // Fails at runtime in production 💥                                        ║
║                                                                              ║
║  HouseKit (type-safe):                                                      ║
║  ────────────────────────────────────────                                   ║
║  query: (qb) => qb.select({                                                 ║
║    event_type: events.event_type,                                           ║
║    total: sql\`sum(\${events.revenue})\`  // TypeScript validates this!      ║
║  })                                                                         ║
║  // If you rename 'revenue', TypeScript catches it immediately ✓            ║
║                                                                              ║
║  Additional Features:                                                       ║
║  ✓ Query hash for drift detection (push command)                            ║
║  ✓ Integration with Engine DSL for type-safe engine config                  ║
║  ✓ Support for TO clause with type-safe table references                    ║
║  ✓ Type-safe projections with automatic ORDER BY inference                  ║
║  ✓ Cluster support with ON CLUSTER clause                                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
