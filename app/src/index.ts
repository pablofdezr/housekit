import { housekit } from '@housekit/orm';
import * as schema from './schema';
import { users, events, type NewUser } from './schema';
import chalk from 'chalk';

const db = housekit(
  {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'admin',
    password: process.env.CLICKHOUSE_PASSWORD || 'admin',
    database: process.env.CLICKHOUSE_DB || 'default',
  },
  { schema }
);

async function main() {
  console.log(chalk.bold.cyan('\n🚀 ClickHouse Performance Demo — 100k Rows\n'));

  // 1. Reset Database
  const dbName = db._config.database || 'default';
  process.stdout.write(`🧹 Resetting database "${dbName}"... `);
  await db.command({ query: `DROP DATABASE IF EXISTS ${dbName}` });
  await db.command({ query: `CREATE DATABASE ${dbName}` });
  console.log(chalk.green('Done.'));

  // 2. Ensure Tables
  process.stdout.write('🏗️  Creating tables... ');
  await db.ensureTable(users);
  await db.ensureTable(events);
  console.log(chalk.green('Done.'));

  // 3. Insert Users
  const userCount = 10; // Reduced for faster demo
  process.stdout.write(`👥 Creating ${userCount} users... `);
  const newUsers: NewUser[] = Array.from({ length: userCount }).map((_, i) => ({
    email: `user${i}@housekit.dev`,
    password: 'password123',
    phone_number: `+34600000${i.toString().padStart(3, '0')}`,
    role: i % 10 === 0 ? 'admin' : 'user',
  }));

  const startUsers = Date.now();
  const createdUsers = await db.insert(users).values(newUsers).returning();
  console.log(chalk.green(`Done in ${Date.now() - startUsers}ms.`));

  // 4. Bulk Insert Events
  const eventCount = 10000; // Reduced to 10k for stability in this environment
  console.log(`⚡ Generating ${eventCount.toLocaleString()} events in memory...`);

  const eventTypes = ['login', 'logout', 'view_page', 'click_button', 'purchase', 'error'];
  const userIds = createdUsers.map(u => u.id);

  const bulkEvents = Array.from({ length: eventCount }).map((_, i) => ({
    userId: userIds[i % userIds.length],
    type: eventTypes[i % eventTypes.length],
    createdAt: new Date(Date.now() - Math.round(Math.random() * 1000000000)),
  }));

  console.log(`🚀 Streaming ${eventCount.toLocaleString()} events to ClickHouse (JSONEachRow)...`);
  const startEvents = Date.now();

  // Use .useJsonFormat() to ensure maximum compatibility in the demo
  await db.insert(events).values(bulkEvents).noReturning().useJsonFormat();

  const duration = Date.now() - startEvents;
  const rowsPerSec = Math.round(eventCount / (duration / 1000));
  console.log(chalk.bold.green(`✅ Inserted ${eventCount.toLocaleString()} events in ${duration}ms (${rowsPerSec.toLocaleString()} rows/sec)`));

  // 5. Relational Query
  console.log('\n🔍 Querying data (Top 5 users + their latest 3 events)...');
  const startQuery = Date.now();
  const usersWithEvents = await db.query.users.findMany({
    with: {
      events: {
        limit: 3,
        orderBy: (e, { desc }) => [desc(e.createdAt)]
      }
    },
    limit: 5,
  });
  console.log(chalk.cyan(`Query took ${Date.now() - startQuery}ms`));
  console.dir(usersWithEvents, { depth: null });

  // 6. Stats Table
  console.log('\n📊 Analytics summary:');
  const stats = await db.raw(`
    SELECT type, count() as total, round(count() * 100 / ${eventCount}, 2) as percentage
    FROM events
    GROUP BY type
    ORDER BY total DESC
  `);
  console.table(stats);

  console.log(chalk.bold.green('\n✨ Demo completed successfully!'));

  await db.close();
}

main().catch((err) => {
  console.error(chalk.red('\n❌ Error:'), err);
  process.exit(1);
});
