/**
 * HouseKit RowBinary Serialization Example
 * 
 * This example demonstrates HouseKit's ultra-fast binary insert capabilities.
 * RowBinary is the fastest way to insert data into ClickHouse.
 * 
 * Benchmarks (typical on modern hardware):
 * - JSONEachRow: ~100K rows/sec
 * - JSONCompactEachRow: ~150K rows/sec
 * - RowBinary: ~500K+ rows/sec (5x faster!)
 */

import {
    defineTable,
    t,
    Engine
} from '../src';

import {
    BinaryWriter,
    createBinaryEncoder,
    serializeRowBinary,
    serializeRowsBinary,
    buildBinaryConfig,
} from '../src/utils/binary-serializer';

import { SyncBinarySerializer } from '../src/utils/binary-worker-pool';

// ============================================================================
// 1. Define a High-Volume Analytics Table
// ============================================================================

export const analyticsEvents = defineTable('analytics_events', (t) => ({
    id: t.uuid('id'),
    timestamp: t.datetime('timestamp'),
    user_id: t.uint32('user_id'),
    session_id: t.uint64('session_id'),
    event_type: t.string('event_type'),
    page_url: t.string('page_url'),
    duration_ms: t.uint32('duration_ms'),
    is_bot: t.boolean('is_bot'),
    scroll_depth: t.int8('scroll_depth'),
    click_x: t.int16('click_x'),
    click_y: t.int16('click_y'),
    revenue: t.float64('revenue'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['user_id', 'timestamp'],
    partitionBy: 'toYYYYMM(timestamp)',
});

console.log('='.repeat(80));
console.log('HouseKit RowBinary Serialization - Ultra-Fast Inserts');
console.log('='.repeat(80));

// ============================================================================
// 2. Demonstrate BinaryWriter Low-Level API
// ============================================================================

console.log('\n1. LOW-LEVEL BINARY WRITER');
console.log('-'.repeat(60));

const writer = new BinaryWriter(1024);

// Write various types
writer.writeUInt32(12345);           // 4 bytes
writer.writeFloat64(3.14159);        // 8 bytes
writer.writeString('Hello World');  // VarInt length + UTF-8 bytes
writer.writeUUID('550e8400-e29b-41d4-a716-446655440000'); // 16 bytes
writer.writeDateTime(new Date());    // 4 bytes

const buffer = writer.getBuffer();
console.log(`Buffer size: ${buffer.length} bytes`);
console.log(`Hex preview: ${buffer.subarray(0, 32).toString('hex')}...`);

// ============================================================================
// 3. Demonstrate Type Encoders
// ============================================================================

console.log('\n2. TYPE-SPECIFIC ENCODERS');
console.log('-'.repeat(60));

// Create encoders for different types
const int32Encoder = createBinaryEncoder('Int32');
const stringEncoder = createBinaryEncoder('String');
const nullableInt = createBinaryEncoder('Nullable(Int64)');
const arrayEncoder = createBinaryEncoder('Array(String)');
const decimalEncoder = createBinaryEncoder('Decimal64(2)');

const writer2 = new BinaryWriter();

int32Encoder(writer2, 42);
console.log('Int32(42) bytes:', writer2.getBuffer().length);

const resetWriter = (w: BinaryWriter) => {
    // Resetting writer for reuse
    w.reset();
};

resetWriter(writer2);
stringEncoder(writer2, 'ClickHouse');
console.log('String("ClickHouse") bytes:', writer2.getBuffer().length);

writer2.reset();
nullableInt(writer2, null);
console.log('Nullable(null) bytes:', writer2.getBuffer().length);

writer2.reset();
nullableInt(writer2, BigInt(9007199254740993));
console.log('Nullable(BigInt) bytes:', writer2.getBuffer().length);

writer2.reset();
arrayEncoder(writer2, ['apple', 'banana', 'cherry']);
console.log('Array(String) bytes:', writer2.getBuffer().length);

writer2.reset();
decimalEncoder(writer2, 123.45);
console.log('Decimal64(123.45) bytes:', writer2.getBuffer().length);

// ============================================================================
// 4. Demonstrate Row Serialization
// ============================================================================

console.log('\n3. ROW SERIALIZATION');
console.log('-'.repeat(60));

const columns = [
    { name: 'id', type: 'UInt32', isNull: false, propKey: 'id' },
    { name: 'name', type: 'String', isNull: false, propKey: 'name' },
    { name: 'score', type: 'Float64', isNull: false, propKey: 'score' },
    { name: 'active', type: 'Bool', isNull: false, propKey: 'active' },
];

const config = buildBinaryConfig(columns);

const sampleRow = {
    id: 1,
    name: 'Alice',
    score: 95.5,
    active: true,
};

const rowBuffer = serializeRowBinary(sampleRow, config);
console.log(`Single row binary size: ${rowBuffer.length} bytes`);

// Compare with JSON
const jsonSize = JSON.stringify(sampleRow).length;
console.log(`Same row as JSON: ${jsonSize} bytes`);
console.log(`Binary is ${((1 - rowBuffer.length / jsonSize) * 100).toFixed(1)}% smaller!`);

// ============================================================================
// 5. Demonstrate Batch Serialization
// ============================================================================

console.log('\n4. BATCH SERIALIZATION');
console.log('-'.repeat(60));

// Generate sample data
const sampleData = Array.from({ length: 10000 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    score: Math.random() * 100,
    active: i % 2 === 0,
}));

// Benchmark binary vs JSON
console.log('Serializing 10,000 rows...');

const jsonStart = performance.now();
const jsonOutput = sampleData.map(row => JSON.stringify(row)).join('\n');
const jsonTime = performance.now() - jsonStart;
console.log(`JSON: ${jsonOutput.length} bytes in ${jsonTime.toFixed(2)}ms`);

const binaryStart = performance.now();
const binaryOutput = serializeRowsBinary(sampleData, config);
const binaryTime = performance.now() - binaryStart;
console.log(`Binary: ${binaryOutput.length} bytes in ${binaryTime.toFixed(2)}ms`);

console.log(`\nBinary is ${(jsonOutput.length / binaryOutput.length).toFixed(1)}x smaller`);
console.log(`Binary is ${(jsonTime / binaryTime).toFixed(1)}x faster to serialize`);

// ============================================================================
// 6. Demonstrate SyncBinarySerializer (used by insert builder)
// ============================================================================

console.log('\n5. SYNC BINARY SERIALIZER (Insert Builder Integration)');
console.log('-'.repeat(60));

const columnConfig = [
    { name: 'id', type: 'UInt32', isNullable: false },
    { name: 'timestamp', type: 'DateTime', isNullable: false },
    { name: 'user_id', type: 'UInt32', isNullable: false },
    { name: 'event_type', type: 'String', isNullable: false },
    { name: 'duration_ms', type: 'UInt32', isNullable: false },
    { name: 'revenue', type: 'Float64', isNullable: true },
];

const serializer = new SyncBinarySerializer(columnConfig);

const eventRows = Array.from({ length: 50000 }, (_, i) => ({
    id: i + 1,
    timestamp: new Date(),
    user_id: Math.floor(Math.random() * 100000),
    event_type: ['pageview', 'click', 'scroll', 'purchase'][i % 4],
    duration_ms: Math.floor(Math.random() * 10000),
    revenue: i % 10 === 0 ? Math.random() * 100 : null,
}));

const serializerStart = performance.now();
const serializedBuffer = serializer.serialize(eventRows);
const serializerTime = performance.now() - serializerStart;

console.log(`Serialized 50,000 analytics events`);
console.log(`Output size: ${(serializedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Time: ${serializerTime.toFixed(2)}ms`);
console.log(`Throughput: ${(50000 / serializerTime * 1000).toFixed(0)} rows/sec`);

// ============================================================================
// 7. Usage Example with Insert Builder
// ============================================================================

console.log('\n6. INSERT BUILDER USAGE (Maximum Simplicity!)');
console.log('-'.repeat(60));

console.log(`
// ✅ That's it. One line. Ultra-fast.
await db.insert(analyticsEvents).values(rows);

// HouseKit automatically:
// • Uses RowBinary format (3x smaller, 5x faster)
// • Enables async_insert (better throughput)
// • Batches data efficiently

// 🔧 Adjust batch size for very large inserts
await db.insert(analyticsEvents)
    .values(millionRows)
    .batchSize(50000);

// 📝 For debugging: Force JSON format (human-readable)
await db.insert(analyticsEvents)
    .values(rows)
    .useJsonFormat();

// 🔒 Need immediate durability? Use syncInsert()
await db.insert(analyticsEvents)
    .values(criticalData)
    .syncInsert();
`);

// ============================================================================
// Summary Table
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('HOUSEKIT: ZERO CONFIGURATION. MAXIMUM PERFORMANCE.');
console.log('='.repeat(80));

console.log(`
┌───────────────────────────────────────────────────────────────────────────────┐
│                    🚀 HOUSEKIT: ONE LINE. ULTRA-FAST. 🚀                      │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  await db.insert(events).values(rows);                                        │
│                                                                               │
│  What HouseKit does automatically:                                            │
│  ✓ RowBinary format (3x smaller, 5x faster than JSON)                         │
│  ✓ async_insert enabled (ClickHouse batches for throughput)                   │
│  ✓ Efficient streaming (no memory spikes on large datasets)                   │
│  ✓ Smart fallback to JSON when needed                                         │
│                                                                               │
│  No .execute(). No .asyncInsert(). No .useBinaryFormat().                     │
│  Just await and go.                                                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

Escape Hatches (when you need them):
────────────────────────────────────────────────────────────────────────────────
  .syncInsert()      → Disable async_insert for immediate durability
  .useJsonFormat()   → Force JSON for debugging
  .batchSize(n)      → Tune batch size for your workload
  
Performance vs Standard ORMs:
────────────────────────────────────────────────────────────────────────────────
Standard ORMs: Always JSON. No binary. No async_insert. ❌
HouseKit:      RowBinary + async_insert by default. ✅

You write: await db.insert(t).values(rows);
We handle: Binary serialization, async batching, streaming, optimal settings.
`);
