/**
 * Type Verification Test
 * 
 * This file is not meant to be executed at runtime, but compiled/checked by TypeScript
 * to verify that the fluent API preserves types correctly despite internal 'as any' casts.
 */

import { ClickHouseColumn, type TableDefinition } from '../src/core';
import { ClickHouseQueryBuilder } from '../src/builders/select';
import { sql } from '../src/expressions';

// Define columns properly
const columns = {
    id: new ClickHouseColumn<number>('id', 'UInt32', false),
    name: new ClickHouseColumn<string>('name', 'String', false),
    email: new ClickHouseColumn<string | null>('email', 'Nullable(String)', true),
};

// Mock Table Definition with correct types
const users: TableDefinition<typeof columns> = {
    $table: 'users',
    $columns: columns,
    $options: {} as any,
    toSQL: () => 'users',
    as: (alias: string) => users as any,
    ...columns // Spread columns to satisfy TCols intersection
};

// Mock Client
const client = {} as any;

async function testTypes() {
    const db = new ClickHouseQueryBuilder(client);

    // 1. Basic Select
    const result1 = await db
        .from(users)
        .select({
            id: users.$columns.id,
            name: users.$columns.name
        })
        .where(sql`${users.$columns.id} > 0`)
        .findMany();
    
    // Type Check: result1 should be { id: number; name: string }[]
    const row1 = result1[0];
    row1.id.toFixed(); // OK
    row1.name.toUpperCase(); // OK
    // row1.email; // Error: Property 'email' does not exist

    // 2. Select All (Infer Table)
    const result2 = await db
        .from(users)
        .select()
        .limit(10)
        .findMany();

    // Type Check: result2 should be { id: number; name: string; email: string | null }[]
    const row2 = result2[0];
    row2.id.toFixed();
    row2.name.toUpperCase();
    if (row2.email) {
        row2.email.toLowerCase();
    }

    // 3. Chain with multiple methods
    const result3 = await db
        .from(users)
        .select({ id: users.$columns.id })
        .where(sql`1=1`)
        .orderBy(users.$columns.id)
        .groupBy(users.$columns.id)
        .limit(5)
        .offset(0)
        .findMany();
    
    // Type Check: result3 should be { id: number }[]
    result3[0].id.toFixed();
    // result3[0].name; // Error

    // 4. Count (Custom Result)
    const count = await db.count(users);
    const n: number = count; // Should be number
}
