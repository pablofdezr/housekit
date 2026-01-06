#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { generateCommand } from './commands/generate';
import { pushCommand } from './commands/push';
import { migrateCommand } from './commands/migrate';
import { pullCommand } from './commands/pull';
import { schemaCommand } from './commands/schema';
import { checkCommand } from './commands/check';
import { dropCommand } from './commands/drop';
import { truncateCommand } from './commands/truncate';
import { dryRunCommand } from './commands/dry-run';
import { statusCommand } from './commands/status';
import { initCommand } from './commands/init';
import { resetCommand } from './commands/reset';
import { listCommand } from './commands/list';
import { validateCommand } from './commands/validate';
import { setGlobalYesMode } from './ui';

// Export types for user config
export { type HouseKitConfig } from './config';
export { validateConfig } from './validation';

const program = new Command();
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

program
    .name('housekit')
    .description('CLI to manage ClickHouse schemas')
    .version(version)
    .option('-y, --yes', 'Auto-confirm all prompts');

program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals?.() ?? thisCommand.opts();
    setGlobalYesMode(Boolean((opts as any).yes));
});

function formatError(err: unknown): string[] {
    const lines: string[] = [];
    
    if (err instanceof AggregateError) {
        lines.push('Multiple errors occurred:');
        for (const e of err.errors) {
            lines.push(`  • ${e instanceof Error ? e.message : String(e)}`);
        }
    } else if (err instanceof Error) {
        lines.push(err.message);
        if (err.cause) {
            lines.push(`Caused by: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`);
        }
    } else {
        lines.push(String(err));
    }
    
    return lines;
}

function withErrorHandling(fn: (...args: any[]) => Promise<void> | void) {
    return async (...args: any[]) => {
        try {
            await fn(...args);
        } catch (error: any) {
            const errorLines = formatError(error);
            console.error(chalk.red('\n✖ Error: ' + errorLines[0]));
            errorLines.slice(1).forEach(line => console.error(chalk.red(line)));
            if (process.env.DEBUG) {
                console.error(error);
            }
            process.exit(1);
        }
    };
}

const asciiLogo = [
    '░█░█░█▀█░█░█░█▀▀░█▀▀░█░█░▀█▀░▀█▀',
    '░█▀█░█░█░█░█░▀▀█░█▀▀░█▀▄░░█░░░█░',
    '░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░░▀░'
].join('\n');

program.addHelpText('before', () => [
    chalk.white(asciiLogo),
    '',
    chalk.bold('Housekit — The Modern ORM for ClickHouse'),
    chalk.gray('Build, migrate, introspect, and query ClickHouse schemas with type-safe, ergonomic tooling. Zero friction. Maximum speed.')
].join('\n'));

program.addHelpText('after', () => [
    '',
    chalk.gray('Tips:'),
    chalk.gray('  - Configure your databases in housekit.config.{ts,js}.'),
    chalk.gray('  - Use --database to target a specific DB.'),
    chalk.gray('  - Try "housekit schema --tables=foo,bar" to inspect specific tables.')
].join('\n'));

program.command('generate')
    .description('Generate SQL migration files based on schema changes')
    .action(withErrorHandling(generateCommand));

program.command('push')
    .description('Synchronize code schema directly with database')
    .option('-d, --database <name>', 'Database to use')
    .option('--log-explain', 'Write EXPLAIN plans to .housekit (disabled by default)')
    .option('--auto-upgrade-metadata', 'Automatically upgrade housekit metadata to the version declared in code')
    .action(withErrorHandling(pushCommand));

program.command('dry-run')
    .description('Preview changes that would be applied without executing them')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(dryRunCommand));

program.command('migrate')
    .description('Apply generated SQL migrations to the database')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(migrateCommand));

program.command('pull')
    .description('Introspect the database schema and generate TS schema files')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(pullCommand));

program.command('schema')
    .description('Print current database schema with types')
    .option('-d, --database <name>', 'Database to use')
    .option('-t, --tables <tables>', 'Table(s) to display, comma-separated', value => value.split(',').map(t => t.trim()).filter(Boolean))
    .action(withErrorHandling(schemaCommand));

program.command('check')
    .description('Check migration files for collisions or inconsistencies')
    .action(withErrorHandling(checkCommand));

program.command('drop')
    .description('Drop tables from the database (requires confirmation)')
    .option('-d, --database <name>', 'Database to use')
    .option('-t, --tables <tables>', 'Comma-separated list of tables to drop')
    .action(withErrorHandling(dropCommand));

program.command('truncate')
    .description('Truncate tables (remove all data but keep table structure)')
    .option('-d, --database <name>', 'Database to use')
    .option('-t, --tables <tables>', 'Comma-separated list of tables to truncate')
    .action(withErrorHandling(truncateCommand));

program.command('status')
    .description('Show migration status (applied vs pending)')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(statusCommand));

program.command('init')
    .description('Initialize a new HouseKit project')
    .action(withErrorHandling(initCommand));

program.command('reset')
    .description('Reset database by dropping all tables (requires confirmation)')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(resetCommand));

program.command('list')
    .description('List all tables in the database with basic information')
    .option('-d, --database <name>', 'Database to use')
    .action(withErrorHandling(listCommand));

program.command('validate')
    .description('Validate that code schema matches the database schema')
    .option('-d, --database <name>', 'Database to use')
    .option('--auto-upgrade-metadata', 'Automatically upgrade housekit metadata to the version declared in code')
    .action(withErrorHandling(validateCommand));

program.command('help').description('Show help').action(() => program.outputHelp());

await program.parseAsync(process.argv);
