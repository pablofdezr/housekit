/**
 * Example: The Relational Powerhouse
 * 
 * demonstrating deep relational queries in HouseKit with single-query performance.
 */

import {
    t,
    defineTable,
    relations,
    createClient,
    Engine
} from '../src';

// 1. DEFINE TABLES
export const users = defineTable('users', {
    id: t.uuid('id').primaryKey(),
    name: t.string('name'),
    email: t.string('email'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'id'
});

export const posts = defineTable('posts', {
    id: t.uuid('id').primaryKey(),
    authorId: t.uuid('author_id'),
    title: t.string('title'),
    content: t.string('content'),
}, {
    engine: Engine.MergeTree(),
    orderBy: 'id'
});

// 2. DEFINE RELATIONS (Decoupled to avoid circular imports)
export const usersRelations = relations(users, ({ many }) => ({
    posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
    author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
    }),
}));

async function demonstrateRelationalAPI() {
    // Note: In real app, pass your schema to createClient for better type inference
    const db = await createClient({
        database: 'test',
        schema: { users, posts }
    });

    // 🚀 STRENGTH: DEEP NESTED FETCHING (All in ONE query)
    // HouseKit automatically handles the JOINs and deducts rows client-side
    // so you don't get duplicate users due to multiple posts.
    if (!db.query) return;

    const usersWithPosts = await db.query.users.findMany({
        with: {
            posts: true
        },
        where: (u: any) => u.name.contains('Pablo')
    });

    console.log('Results:', JSON.stringify(usersWithPosts, null, 2));

    /*
    Expected Output Structure:
    [
      {
        "id": "...",
        "name": "Pablo",
        "email": "pablo@example.com",
        "posts": [
          { "id": "p1", "title": "First Post", ... },
          { "id": "p2", "title": "Second Post", ... }
        ]
      }
    ]
    */
}
