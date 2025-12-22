import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, info, success, warn, confirmPrompt, quoteName } from '../ui';
import { ParsedStatement, parseStatement } from '../schema/parser';
import { describeTable } from '../schema/analyzer';

async function isStatementAlreadyApplied(client: any, parsed: ParsedStatement): Promise<boolean> {
    if (parsed.type === 'CREATE_TABLE' && parsed.tableName) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        // If table exists, consider it already applied (CREATE TABLE IF NOT EXISTS is idempotent)
        return tableInfo !== null;
    }

    if (parsed.type === 'ALTER_ADD_COLUMN' && parsed.tableName && parsed.columnName) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        if (!tableInfo) {
            return false; // Table doesn't exist, so column doesn't exist
        }
        // Check if column already exists
        return parsed.columnName in tableInfo.columns;
    }

    if (parsed.type === 'ALTER_MODIFY_COLUMN' && parsed.tableName && parsed.columnName && parsed.columnType) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        if (!tableInfo) {
            return false; // Table doesn't exist
        }
        const currentType = tableInfo.columns[parsed.columnName];
        if (!currentType) {
            return false; // Column doesn't exist
        }
        // Normalize types for comparison (remove extra spaces, case insensitive)
        const normalizedCurrent = currentType.replace(/\s+/g, ' ').trim().toUpperCase();
        const normalizedTarget = parsed.columnType.replace(/\s+/g, ' ').trim().toUpperCase();
        return normalizedCurrent === normalizedTarget;
    }

    // For unknown statements, assume they need to be applied
    return false;
}

function formatMigrationChanges(statements: string[]): string[] {
    const changes: string[] = [];
    const creates: string[] = [];
    const adds: string[] = [];
    const modifies: string[] = [];
    const unknowns: string[] = [];

    for (const statement of statements) {
        const parsed = parseStatement(statement);

        switch (parsed.type) {
            case 'CREATE_TABLE':
                if (parsed.tableName) {
                    creates.push(`  • Create table ${quoteName(parsed.tableName)}`);
                }
                break;
            case 'ALTER_ADD_COLUMN':
                if (parsed.tableName && parsed.columnName) {
                    adds.push(`  • Add column ${quoteName(parsed.columnName)} to ${quoteName(parsed.tableName)}`);
                }
                break;
            case 'ALTER_MODIFY_COLUMN':
                if (parsed.tableName && parsed.columnName) {
                    modifies.push(`  • Modify column ${quoteName(parsed.columnName)} in ${quoteName(parsed.tableName)}`);
                }
                break;
            default:
                // Truncate long statements for display
                const preview = statement.length > 60
                    ? statement.substring(0, 57) + '...'
                    : statement;
                unknowns.push(`  • ${preview}`);
        }
    }

    if (creates.length > 0) changes.push(...creates);
    if (adds.length > 0) changes.push(...adds);
    if (modifies.length > 0) changes.push(...modifies);
    if (unknowns.length > 0) changes.push(...unknowns);

    return changes;
}

export async function migrateCommand(options: { database?: string }) {
    const config = await loadConfig();
    const { client, name: dbName } = resolveDatabase(config, options.database);

    const outDir = config.out || './housekit';
    const dbOutDir = join(outDir, dbName);
    const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql')).sort();

    if (migrationFiles.length === 0) {
        warn('No migration files found.');
        await client.close();
        return;
    }

    // First pass: check which migrations need to be applied
    const pendingMigrations: Array<{ file: string; statements: string[] }> = [];
    const skippedMigrations: string[] = [];

    for (const file of migrationFiles) {
        const sql = readFileSync(join(dbOutDir, file), 'utf-8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const statementsToApply: string[] = [];
        let allAlreadyApplied = true;

        for (const statement of statements) {
            const parsed = parseStatement(statement);
            const alreadyApplied = await isStatementAlreadyApplied(client, parsed);

            if (!alreadyApplied) {
                statementsToApply.push(statement);
                allAlreadyApplied = false;
            }
        }

        if (allAlreadyApplied && statements.length > 0) {
            skippedMigrations.push(file);
        } else if (statementsToApply.length > 0) {
            pendingMigrations.push({ file, statements: statementsToApply });
        } else {
            skippedMigrations.push(file);
        }
    }

    // Show skipped migrations
    if (skippedMigrations.length > 0) {
        for (const file of skippedMigrations) {
            success(`Skipped ${quoteName(file)} (already applied)`);
        }
    }

    if (pendingMigrations.length === 0) {
        if (skippedMigrations.length > 0) {
            success('All migrations are already applied.');
        } else {
            success('No migrations to apply.');
        }
        await client.close();
        return;
    }

    // Apply pending migrations (with confirmation if needed)
    let totalApplied = 0;
    let totalSkipped = skippedMigrations.length;

    for (const { file, statements } of pendingMigrations) {
        // Show changes before asking for confirmation
        const changes = formatMigrationChanges(statements);

        if (changes.length > 0) {
            console.log();
            info(`Migration ${quoteName(file)} will apply:`);
            changes.forEach(change => console.log(change));
        }

        const shouldApply = await confirmPrompt(`Apply migration ${quoteName(file)}?`, true);

        if (!shouldApply) {
            info(`Skipped ${quoteName(file)}`);
            totalSkipped++;
            continue;
        }

        const spinner = createSpinner(`Applying ${file}`);
        spinner.start();

        try {
            for (const statement of statements) {
                await client.command({ query: statement + ';' });
            }
            spinner.succeed(`Applied ${quoteName(file)}`);
            totalApplied++;
        } catch (e) {
            spinner.fail(`Failed ${quoteName(file)}`);
            error(String(e));
            await client.close();
            throw e;
        }
    }

    // Summary
    if (totalApplied > 0) {
        success(`Applied ${totalApplied} migration${totalApplied === 1 ? '' : 's'}`);
    }
    if (totalSkipped > 0) {
        info(`Skipped ${totalSkipped} migration${totalSkipped === 1 ? '' : 's'}`);
    }

    await client.close();
}
