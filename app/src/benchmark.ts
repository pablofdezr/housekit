import { housekit } from '@housekit/orm';
import * as schema from './schema';
import { users, events, type NewUser, type NewEvent } from './schema';
import chalk from 'chalk';

const db = housekit(
  {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'admin',
    password: process.env.CLICKHOUSE_PASSWORD || 'admin',
    database: process.env.CLICKHOUSE_DB || 'default',
    pool: { maxSockets: 100 }
  },
  { schema }
);

interface BenchmarkResult {
  method: string;
  rows: number;
  duration: number;
  rowsPerSec: number;
}

const results: BenchmarkResult[] = [];

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

async function resetDatabase() {
  const dbName = db._config.database || 'default';
  await db.command({ query: `DROP DATABASE IF EXISTS ${dbName}` });
  await db.command({ query: `CREATE DATABASE ${dbName}` });
  await db.ensureTable(users);
  await db.ensureTable(events);
}

async function truncateEvents() {
  await db.command({ query: `TRUNCATE TABLE events` });
}

function generateEvents(count: number, userIds: string[]): NewEvent[] {
  const eventTypes = ['login', 'logout', 'view_page', 'click_button', 'purchase', 'error'];
  return Array.from({ length: count }).map((_, i) => ({
    userId: userIds[i % userIds.length],
    type: eventTypes[i % eventTypes.length],
    createdAt: new Date(Date.now() - Math.round(Math.random() * 1000000000)),
  }));
}

async function benchmark(
  name: string,
  rows: number,
  fn: () => Promise<void>
): Promise<BenchmarkResult> {
  // Warm up
  await truncateEvents();
  
  const start = performance.now();
  await fn();
  const duration = Math.round(performance.now() - start);
  const rowsPerSec = Math.round(rows / (duration / 1000));
  
  const result = { method: name, rows, duration, rowsPerSec };
  results.push(result);
  
  console.log(
    chalk.cyan(`  ${name.padEnd(30)}`),
    chalk.white(`${formatNumber(rows).padStart(10)} rows`),
    chalk.yellow(`${duration.toString().padStart(6)}ms`),
    chalk.green(`${formatNumber(rowsPerSec).padStart(10)} rows/sec`)
  );
  
  return result;
}

async function main() {
  console.log(chalk.bold.cyan('\n📊 HouseKit ORM Benchmark\n'));
  console.log(chalk.gray('Testing insert performance with different configurations\n'));

  // Setup
  process.stdout.write(chalk.gray('Setting up database... '));
  await resetDatabase();
  console.log(chalk.green('Done.\n'));

  // Create test users
  const newUsers: NewUser[] = Array.from({ length: 10 }).map((_, i) => ({
    email: `user${i}@benchmark.dev`,
    password: 'password123',
    phone_number: `+34600000${i.toString().padStart(3, '0')}`,
    role: i % 10 === 0 ? 'admin' : 'user',
  }));
  const createdUsers = await db.insert(users).values(newUsers).returning();
  const userIds = createdUsers.map(u => u.id);

  // Benchmark configurations
  const rowCounts = [1_000, 5_000, 10_000];

  console.log(chalk.bold('Insert Performance:\n'));
  console.log(chalk.gray('  Method                              Rows      Time      Throughput\n'));

  for (const count of rowCounts) {
    const testEvents = generateEvents(count, userIds);
    
    // JSON Format (baseline)
    await benchmark(`JSON (${formatNumber(count)})`, count, async () => {
      await db.insert(events).values(testEvents).useJsonFormat();
    });

    // JSON Compact Format
    await benchmark(`JSONCompact (${formatNumber(count)})`, count, async () => {
      await db.insert(events).values(testEvents).useCompactFormat();
    });

    // With async_insert disabled (sync)
    await benchmark(`JSON Sync (${formatNumber(count)})`, count, async () => {
      await db.insert(events).values(testEvents).useJsonFormat().syncInsert();
    });

    // Skip validation
    await benchmark(`JSON+SkipValidation (${formatNumber(count)})`, count, async () => {
      await db.insert(events).values(testEvents).useJsonFormat().skipValidation();
    });

    console.log('');
  }

  // Summary
  console.log(chalk.bold('\n📈 Summary:\n'));
  
  // Group by row count and show best
  for (const count of rowCounts) {
    const countResults = results.filter(r => r.rows === count);
    const best = countResults.reduce((a, b) => a.rowsPerSec > b.rowsPerSec ? a : b);
    const baseline = countResults.find(r => r.method.startsWith('JSON ('));
    
    console.log(chalk.white(`  ${formatNumber(count)} rows:`));
    for (const r of countResults) {
      const speedup = baseline ? (baseline.duration / r.duration).toFixed(2) : '1.00';
      const isBest = r === best;
      const prefix = isBest ? chalk.green('★') : ' ';
      console.log(
        `  ${prefix} ${r.method.padEnd(28)}`,
        chalk.yellow(`${r.duration}ms`.padStart(8)),
        chalk.cyan(`${formatNumber(r.rowsPerSec)} rows/sec`.padStart(18)),
        speedup !== '1.00' ? chalk.green(`${speedup}x`) : ''
      );
    }
    console.log('');
  }

  // Generate markdown table for README
  console.log(chalk.bold('\n📝 Markdown for README:\n'));
  console.log('| Rows | Method | Time | Throughput |');
  console.log('|------|--------|------|------------|');
  
  for (const count of rowCounts) {
    const countResults = results.filter(r => r.rows === count);
    for (const r of countResults) {
      console.log(`| ${formatNumber(count)} | ${r.method.split(' (')[0]} | ${r.duration}ms | ${formatNumber(r.rowsPerSec)} rows/sec |`);
    }
  }

  await db.close();
  console.log(chalk.bold.green('\n✨ Benchmark completed!\n'));
}

main().catch((err) => {
  console.error(chalk.red('\n❌ Error:'), err);
  process.exit(1);
});
