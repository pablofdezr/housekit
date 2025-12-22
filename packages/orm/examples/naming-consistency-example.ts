/**
 * HouseKit Naming Consistency Example
 * 
 * This example demonstrates the consistent dual-naming pattern
 * available for all schema builders in HouseKit.
 * 
 * Every schema builder now supports BOTH:
 * - Short form (concise): table(), view(), materializedView()
 * - Explicit form (self-documenting): defineTable(), defineView(), defineMaterializedView()
 */

import {
    // Short forms
    table,
    view,
    materializedView,

    // Explicit forms (aliases of the above)
    defineTable,
    defineView,
    defineMaterializedView,

    // Column builder
    t,

    // Engine DSL
    Engine,

    // SQL helper
    sql
} from '../src';

// ============================================================================
// Example 1: Using SHORT FORMS (concise, modern style)
// ============================================================================

const users = table('users', {
    id: t.uuid('id').primaryKey(),
    name: t.string('name'),
    email: t.string('email'),
    createdAt: t.datetime('created_at'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'createdAt'
});

const activeUsersView = view('active_users', {
    id: t.uuid('id'),
    name: t.string('name'),
    email: t.string('email'),
}, {
    query: 'SELECT id, name, email FROM users WHERE deleted_at IS NULL'
});

const userStatsMV = materializedView('user_stats_mv', {
    date: t.date('date'),
    userCount: t.uint64('user_count'),
}, {
    source: users,
    query: (qb) => qb
        .from(users)
        .select({
            date: sql`toDate(${users.createdAt})`,
            userCount: sql`count()`
        })
        .groupBy(sql`toDate(${users.createdAt})`),
    engine: Engine.SummingMergeTree(['userCount']),
    orderBy: 'date'
});

// ============================================================================
// Example 2: Using EXPLICIT FORMS (self-documenting, enterprise style)
// ============================================================================

const products = defineTable('products', {
    id: t.uuid('id').primaryKey(),
    name: t.string('name'),
    price: t.decimal('price', 10, 2),
    stock: t.int32('stock'),
    createdAt: t.datetime('created_at'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'createdAt'
});

const availableProductsView = defineView('available_products', {
    id: t.uuid('id'),
    name: t.string('name'),
    price: t.decimal('price', 10, 2),
}, {
    query: 'SELECT id, name, price FROM products WHERE stock > 0'
});

const productStatsMV = defineMaterializedView('product_stats_mv', {
    date: t.date('date'),
    totalRevenue: t.decimal('total_revenue', 18, 2),
    productsSold: t.uint64('products_sold'),
}, {
    source: products,
    query: (qb) => qb
        .from(products)
        .select({
            date: sql`toDate(${products.createdAt})`,
            totalRevenue: sql`sum(${products.price})`,
            productsSold: sql`count()`
        })
        .groupBy(sql`toDate(${products.createdAt})`),
    engine: Engine.SummingMergeTree(['totalRevenue', 'productsSold']),
    orderBy: 'date'
});

// ============================================================================
// Example 3: MIXED USAGE (both styles in the same project)
// ============================================================================

// You can mix and match based on context or team preference
const orders = table('orders', {  // Short form
    id: t.uuid('id').primaryKey(),
    userId: t.uuid('user_id'),
    productId: t.uuid('product_id'),
    quantity: t.int32('quantity'),
    total: t.decimal('total', 10, 2),
    createdAt: t.datetime('created_at'),
}, {
    engine: Engine.MergeTree(),
    orderBy: ['userId', 'createdAt']
});

const orderSummaryView = defineView('order_summary', {  // Explicit form
    userId: t.uuid('user_id'),
    totalOrders: t.uint64('total_orders'),
    totalSpent: t.decimal('total_spent', 18, 2),
}, {
    query: `
        SELECT 
            user_id,
            count() as total_orders,
            sum(total) as total_spent
        FROM orders
        GROUP BY user_id
    `
});

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * 1. CONSISTENCY: All schema builders follow the same pattern
 *    - table / defineTable
 *    - view / defineView
 *    - materializedView / defineMaterializedView
 * 
 * 2. FLEXIBILITY: Choose based on your preference
 *    - Short forms: More concise, modern feel
 *    - Explicit forms: Self-documenting, clearer intent
 * 
 * 3. NO BREAKING CHANGES: Both forms are aliases
 *    - Existing code continues to work
 *    - New code can use either style
 *    - Teams can standardize on one or allow both
 * 
 * 4. TYPESCRIPT SUPPORT: Full type inference for both forms
 *    - Autocomplete works identically
 *    - Type safety is maintained
 *    - No runtime overhead
 */

export {
    // Short form examples
    users,
    activeUsersView,
    userStatsMV,

    // Explicit form examples
    products,
    availableProductsView,
    productStatsMV,

    // Mixed usage example
    orders,
    orderSummaryView
};
