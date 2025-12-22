/**
 * HouseKit Engine DSL Example
 * 
 * This example demonstrates the type-safe engine configuration system,
 * which provides compile-time validation and intelligent defaults.
 */

import {
    defineTable,
    t,
    Engine
} from '../src';

// ============================================================================
// 1. Basic MergeTree (The Default)
// ============================================================================

export const basicEvents = defineTable('basic_events', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    // Type-safe: TypeScript knows MergeTree takes no required parameters
    engine: Engine.MergeTree(),
    orderBy: 'created_at',
});

console.log('Basic MergeTree:\n', basicEvents.toSQL(), '\n');

// ============================================================================
// 2. ReplacingMergeTree (Automatic Deduplication)
// ============================================================================

export const users = defineTable('users', (t) => ({
    id: t.uuid('id'),
    email: t.string('email'),
    name: t.string('name'),
    updated_at: t.datetime('updated_at'),
}), {
    // Type-safe: versionColumn is properly typed as string
    engine: Engine.ReplacingMergeTree('updated_at'),
    orderBy: ['id'],
    versionColumn: 'updated_at', // HouseKit can also extract this from the engine config!
});

console.log('ReplacingMergeTree:\n', users.toSQL(), '\n');

// ============================================================================
// 3. ReplacingMergeTree with Soft Deletes (ClickHouse 23.2+)
// ============================================================================

export const usersWithSoftDelete = defineTable('users_soft_delete', (t) => ({
    id: t.uuid('id'),
    email: t.string('email'),
    name: t.string('name'),
    updated_at: t.datetime('updated_at'),
    is_deleted: t.int8('is_deleted'),
}), {
    // Both version and isDeleted columns are type-safe
    engine: Engine.ReplacingMergeTree('updated_at', 'is_deleted'),
    orderBy: ['id'],
    versionColumn: 'updated_at',
});

console.log('ReplacingMergeTree with soft delete:\n', usersWithSoftDelete.toSQL(), '\n');

// ============================================================================
// 4. SummingMergeTree (Automatic Aggregation)
// ============================================================================

export const dailyStats = defineTable('daily_stats', (t) => ({
    date: t.datetime('date'),
    user_id: t.uuid('user_id'),
    page_views: t.int32('page_views'),
    clicks: t.int32('clicks'),
    revenue: t.float64('revenue'),
}), {
    // Specify which columns to sum during merges
    engine: Engine.SummingMergeTree(['page_views', 'clicks', 'revenue']),
    orderBy: ['date', 'user_id'],
    partitionBy: 'toYYYYMM(date)',
});

console.log('SummingMergeTree:\n', dailyStats.toSQL(), '\n');

// ============================================================================
// 5. AggregatingMergeTree (For Materialized Views)
// ============================================================================

export const userAggregates = defineTable('user_aggregates', (t) => ({
    user_id: t.uuid('user_id'),
    total_events: t.int32('total_events'),
    last_seen: t.datetime('last_seen'),
}), {
    engine: Engine.AggregatingMergeTree(),
    orderBy: 'user_id',
});

console.log('AggregatingMergeTree:\n', userAggregates.toSQL(), '\n');

// ============================================================================
// 6. ReplicatedMergeTree (Distributed Clusters)
// ============================================================================

// With intelligent defaults using ClickHouse macros
export const replicatedEvents = defineTable('replicated_events', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    // HouseKit provides sensible defaults for ZK path and replica name
    engine: Engine.ReplicatedMergeTree(),
    orderBy: 'created_at',
    onCluster: 'my_cluster',
});

console.log('ReplicatedMergeTree (defaults):\n', replicatedEvents.toSQL(), '\n');

// With custom ZooKeeper path
export const customReplicatedEvents = defineTable('custom_replicated_events', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.ReplicatedMergeTree({
        zkPath: '/clickhouse/prod/tables/{shard}/events',
        replicaName: 'r_{replica}',
    }),
    orderBy: 'created_at',
    onCluster: 'prod_cluster',
});

console.log('ReplicatedMergeTree (custom):\n', customReplicatedEvents.toSQL(), '\n');

// Replicated ReplacingMergeTree
export const replicatedUsers = defineTable('replicated_users', (t) => ({
    id: t.uuid('id'),
    email: t.string('email'),
    updated_at: t.datetime('updated_at'),
}), {
    engine: Engine.ReplicatedMergeTree({
        baseEngine: 'ReplacingMergeTree',
        versionColumn: 'updated_at',
    }),
    orderBy: ['id'],
    onCluster: 'my_cluster',
    versionColumn: 'updated_at',
});

console.log('ReplicatedReplacingMergeTree:\n', replicatedUsers.toSQL(), '\n');

// ============================================================================
// 7. Cluster Intelligence: Auto-detect ReplicatedMergeTree
// ============================================================================

// When you specify onCluster but no engine, HouseKit automatically
// suggests ReplicatedMergeTree for safety!
export const autoReplicatedTable = defineTable('auto_replicated', (t) => ({
    id: t.uuid('id'),
    data: t.string('data'),
    created_at: t.datetime('created_at'),
}), {
    // No engine specified, but onCluster is set
    // HouseKit will auto-use ReplicatedMergeTree!
    onCluster: 'my_cluster',
    orderBy: 'created_at',
});

console.log('Auto-detected ReplicatedMergeTree:\n', autoReplicatedTable.toSQL(), '\n');

// ============================================================================
// 8. Buffer Engine (High-throughput Inserts)
// ============================================================================

// First, define the target table
export const eventsTarget = defineTable('events_target', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.MergeTree(),
    orderBy: 'created_at',
});

// Then, create a buffer table pointing to it
export const eventsBuffer = defineTable('events_buffer', eventsTarget.$columns, {
    // Type-safe: Buffer requires a table reference and row thresholds
    engine: Engine.Buffer(eventsTarget, {
        minRows: 1000,
        maxRows: 10000,
        minTime: 5,
        maxTime: 60,
    }),
});

console.log('Buffer Engine:\n', eventsBuffer.toSQL(), '\n');

// ============================================================================
// 9. Distributed Engine (Query Routing)
// ============================================================================

export const eventsDistributed = defineTable('events_distributed', (t) => ({
    id: t.uuid('id'),
    user_id: t.uuid('user_id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.Distributed({
        cluster: 'analytics_cluster',
        database: 'default',
        table: 'events_local',
        shardingKey: 'user_id', // Route by user for consistent reads
    }),
});

console.log('Distributed Engine:\n', eventsDistributed.toSQL(), '\n');

// ============================================================================
// 10. Memory Engine (Testing/Caching)
// ============================================================================

export const tempCache = defineTable('temp_cache', (t) => ({
    key: t.string('key'),
    value: t.string('value'),
    expires_at: t.datetime('expires_at'),
}), {
    engine: Engine.Memory({ maxRows: 100000 }),
    orderBy: 'key',
});

console.log('Memory Engine:\n', tempCache.toSQL(), '\n');

// ============================================================================
// 11. CollapsingMergeTree (State Changes)
// ============================================================================

export const userSessions = defineTable('user_sessions', (t) => ({
    user_id: t.uuid('user_id'),
    session_start: t.datetime('session_start'),
    duration_seconds: t.int32('duration_seconds'),
    sign: t.int8('sign'), // 1 for insert, -1 for cancel
}), {
    engine: Engine.CollapsingMergeTree('sign'),
    orderBy: ['user_id', 'session_start'],
});

console.log('CollapsingMergeTree:\n', userSessions.toSQL(), '\n');

// ============================================================================
// 12. External Integrations
// ============================================================================

// Kafka consumer table
export const kafkaEvents = defineTable('kafka_events', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    payload: t.string('payload'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.Kafka({
        brokerList: 'kafka-1:9092,kafka-2:9092',
        topicList: 'events',
        groupName: 'clickhouse_consumer_group',
        format: 'JSONEachRow',
        numConsumers: 4,
    }),
});

console.log('Kafka Engine:\n', kafkaEvents.toSQL(), '\n');

// S3 data lake
export const s3Events = defineTable('s3_events', (t) => ({
    id: t.uuid('id'),
    event_type: t.string('event_type'),
    created_at: t.datetime('created_at'),
}), {
    engine: Engine.S3({
        path: 's3://my-bucket/events/*.parquet',
        format: 'Parquet',
    }),
});

console.log('S3 Engine:\n', s3Events.toSQL(), '\n');

// Comparison of ClickHouse Engines
// -----------------------------------------------------------------------------
// HouseKit provides a fluent DSL for all major ClickHouse engines.
// This ensures that your engine configuration is validated at compile-time.

console.log('='.repeat(80));
console.log('HouseKit Engine DSL - Type-Safe Table Configurations');
console.log('='.repeat(80));
