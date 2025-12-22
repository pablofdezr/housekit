import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, info, success, warn, quoteName } from '../ui';
import Table from 'cli-table3';
import { ParsedStatement, parseStatement } from '../schema/parser';
import { describeTable } from '../schema/analyzer';

async function isStatementAlreadyApplied(client: any, parsed: ParsedStatement): Promise<boolean> {
    if (parsed.type === 'CREATE_TABLE' && parsed.tableName) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        return tableInfo !== null;
    }

    if (parsed.type === 'ALTER_ADD_COLUMN' && parsed.tableName && parsed.columnName) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        if (!tableInfo) {
            return false;
        }
        return parsed.columnName in tableInfo.columns;
    }

    if (parsed.type === 'ALTER_MODIFY_COLUMN' && parsed.tableName && parsed.columnName && parsed.columnType) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        if (!tableInfo) {
            return false;
        }
        const currentType = tableInfo.columns[parsed.columnName];
        if (!currentType) {
            return false;
        }
        const normalizedCurrent = currentType.replace(/\s+/g, ' ').trim().toUpperCase();
        const normalizedTarget = parsed.columnType.replace(/\s+/g, ' ').trim().toUpperCase();
        return normalizedCurrent === normalizedTarget;
    }

    if (parsed.type === 'ALTER_MODIFY_COMMENT' && parsed.tableName && parsed.comment) {
        const tableInfo = await describeTable(client, parsed.tableName, true);
        if (!tableInfo) {
            return false;
        }
        // Normalize comments for comparison (trim, collapse whitespace)
        const current = (tableInfo.comment || '').trim().replace(/\s+/g, ' ');
        const target = parsed.comment.trim().replace(/\s+/g, ' ');
        return current === target;
    }

    return false;
}

export async function statusCommand(options: { database?: string }) {
    const spinner = createSpinner('Checking migration status');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName } = resolveDatabase(config, options.database);

        const outDir = config.out || './housekit';
        const dbOutDir = join(outDir, dbName);

        if (!existsSync(dbOutDir)) {
            spinner.warn('No migration directory found');
            info(`Migration directory: ${dbOutDir}`);
            info('Run "housekit generate" to create migrations.');
            await client.close();
            return;
        }

        const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql')).sort();

        if (migrationFiles.length === 0) {
            spinner.warn('No migration files found');
            info(`Migration directory: ${dbOutDir}`);
            await client.close();
            return;
        }

        spinner.succeed('Migration status loaded');

        const appliedMigrations: string[] = [];
        const pendingMigrations: string[] = [];
        const partialMigrations: Array<{ file: string; applied: number; total: number }> = [];

        for (const file of migrationFiles) {
            const sql = readFileSync(join(dbOutDir, file), 'utf-8');
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            if (statements.length === 0) {
                continue;
            }

            let appliedCount = 0;
            for (const statement of statements) {
                const parsed = parseStatement(statement);
                const alreadyApplied = await isStatementAlreadyApplied(client, parsed);
                if (alreadyApplied) {
                    appliedCount++;
                }
            }

            if (appliedCount === statements.length) {
                appliedMigrations.push(file);
            } else if (appliedCount === 0) {
                pendingMigrations.push(file);
            } else {
                partialMigrations.push({ file, applied: appliedCount, total: statements.length });
            }
        }

        console.log();
        success(`Database: ${quoteName(dbName)}`);
        console.log();

        // Create status table
        const statusTable = new Table({
            head: ['Status', 'Count', 'Files'],
            style: {
                head: ['cyan', 'bold'],
                border: ['gray'],
                compact: false
            },
            chars: {
                'top': '─',
                'top-mid': '┬',
                'top-left': '┌',
                'top-right': '┐',
                'bottom': '─',
                'bottom-mid': '┴',
                'bottom-left': '└',
                'bottom-right': '┘',
                'left': '│',
                'left-mid': '',
                'mid': '',
                'mid-mid': '',
                'right': '│',
                'right-mid': '',
                'middle': '│'
            },
            colWidths: [15, 8, null]
        });

        if (appliedMigrations.length > 0) {
            statusTable.push([
                'Applied',
                appliedMigrations.length.toString(),
                appliedMigrations.join(', ')
            ]);
        }

        if (pendingMigrations.length > 0) {
            statusTable.push([
                'Pending',
                pendingMigrations.length.toString(),
                pendingMigrations.join(', ')
            ]);
        }

        if (partialMigrations.length > 0) {
            statusTable.push([
                'Partial',
                partialMigrations.length.toString(),
                partialMigrations.map(m => `${m.file} (${m.applied}/${m.total})`).join(', ')
            ]);
        }

        if (statusTable.length > 0) {
            console.log(statusTable.toString());
        } else {
            info('No migrations found');
        }

        console.log();
        info(`Total migrations: ${migrationFiles.length}`);
        info(`Applied: ${appliedMigrations.length}`);
        info(`Pending: ${pendingMigrations.length}`);
        if (partialMigrations.length > 0) {
            warn(`Partial: ${partialMigrations.length}`);
        }

        await client.close();
    } catch (e) {
        spinner.fail('Failed to check migration status');
        error(String(e));
    }
}
