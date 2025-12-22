/**
 * Example: The Production-Ready CLI
 * 
 * This example shows how HouseKit helps you manage 
 * production ClickHouse deployments safely.
 */

import {
    t,
    defineTable,
    defineMaterializedView,
    createClient,
    Engine,
    sql
} from '../src';

// 1. DEFINE YOUR SCHEMA
const rawEvents = defineTable('raw_events', {
    id: t.uuid('id'),
    event: t.string('event'),
    timestamp: t.datetime('timestamp'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'timestamp'
});

const eventCounts = defineTable('event_counts', {
    event: t.string('event'),
    count: t.uint64('count'),
}, {
    engine: Engine.SummingMergeTree(['count']),
    orderBy: 'event'
});

export const eventCountsMV = defineMaterializedView('event_counts_mv', eventCounts.$columns, {
    source: rawEvents,
    toTable: eventCounts,
    query: (queryBuilder: any) => queryBuilder
        .from(rawEvents)
        .select({
            event: rawEvents.event,
            count: sql`count()`
        })
        .groupBy(rawEvents.event)
});

// 2. INITIALIZE CLIENT WITH SCHEMA
// This is what the CLI looks for
export const db = createClient({
    host: 'localhost',
    database: 'analytics',
    schema: { rawEvents, eventCounts, eventCountsMV }
});

/*
  HOW TO USE THE CLI (Terminal):
  
  1. See the migration plan:
     npx housekit dry-run

     Output:
     🚀 HouseKit: Analyzing schema drift...
     
     --- Migration Plan ---
       ✨ Create NEW Table: raw_events
       ✨ Create NEW Table: event_counts
       ✨ Create NEW Materialized View: event_counts_mv
     
  2. Apply changes:
     npx housekit push

  3. Estimate a heavy query:
     npx housekit estimate "SELECT event, count() FROM raw_events GROUP BY event"

     Output:
     📊 Estimating cost for query: SELECT event, count() FROM raw_events GROUP BY event
     
     --- EXPLAIN ESTIMATE ---
     🗂️  Rows to read: 1,450,000
     💾 Data to read: 12.45 MB
     ⏱️  Estimated marks: 182
     ✅ Query looks efficient.
*/
