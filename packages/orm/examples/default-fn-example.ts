/**
 * Example: Using $defaultFn to compute values based on other row fields
 * 
 * This demonstrates how to use $defaultFn for:
 * 1. Simple auto-generation (like UUID)
 * 2. Computed fields based on other row values (like age from dob)
 */

import { defineTable, t } from '../src';
import { buildInsertPlan, processRowWithPlan } from '../src/utils/insert-processing';

// Define a table with $defaultFn usage
const users = defineTable('users', (t) => ({
    id: t.uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: t.string('name'),
    dob: t.datetime('dob'),
    // Age is computed automatically from dob if not provided
    age: t.int32('age').$defaultFn((row) => {
        if (!row.dob) return 0;
        const birthDate = new Date(row.dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }),
    // Full name computed from first_name + last_name
    fullName: t.string('full_name').$defaultFn((row) => {
        return `${row.firstName || ''} ${row.lastName || ''}`.trim();
    }),
    firstName: t.string('first_name').nullable(),
    lastName: t.string('last_name').nullable(),
    createdAt: t.datetime('created_at').$defaultFn(() => new Date()),
}));

// Build insert plan and test processing
const plan = buildInsertPlan(users);

// Test 1: Insert with dob, age should be computed
const row1 = {
    name: 'John Doe',
    dob: '1990-05-15',
    firstName: 'John',
    lastName: 'Doe',
};

const processed1 = processRowWithPlan(row1, plan);
console.log('Test 1 - Age computed from dob:');
console.log(processed1);

// Test 2: Insert with explicit age (should use provided value)
const row2 = {
    name: 'Jane Doe',
    dob: '1985-03-20',
    age: 100, // Explicit value - should NOT be overwritten
    firstName: 'Jane',
    lastName: 'Doe',
};

const processed2 = processRowWithPlan(row2, plan);
console.log('\nTest 2 - Explicit age provided:');
console.log(processed2);

// Test 3: No dob provided, age should be 0
const row3 = {
    name: 'Unknown Age',
    firstName: 'Unknown',
    lastName: 'Age',
};

const processed3 = processRowWithPlan(row3, plan);
console.log('\nTest 3 - No dob, age should be 0:');
console.log(processed3);

console.log('\n✅ All tests completed!');
