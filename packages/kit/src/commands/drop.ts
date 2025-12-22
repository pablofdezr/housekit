import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, format, info, success, warn, inputPrompt, quoteName, checkboxPrompt, confirmPrompt } from '../ui';

async function countRows(client: any, tableName: string): Promise<number> {
    try {
        const res = await client.query({ query: `SELECT count() AS cnt FROM \`${tableName}\``, format: 'JSONEachRow' });
        const parsed = await res.json();
        const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
        if (!Array.isArray(rows)) {
            throw new TypeError('Unexpected COUNT format');
        }
        return (rows[0] as any)?.cnt ?? 0;
    } catch {
        return -1;
    }
}

function formatNumber(num: number): string {
    if (num < 0) return 'unknown';
    return num.toLocaleString();
}

export async function dropCommand(options: { database?: string; tables?: string }) {
    const spinner = createSpinner('Checking database');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName } = resolveDatabase(config, options.database);

        // Get all tables
        const tablesResult = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
        const parsed = await tablesResult.json() as any;
        const tableRows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
        if (!Array.isArray(tableRows)) {
            throw new TypeError('Unexpected response format for SHOW TABLES');
        }
        const allTables = tableRows.map((r: any) => r.name || r);

        spinner.stop();
        console.log(); // Add linebreak

        if (allTables.length === 0) {
            info('No tables found in the database.');
            await client.close();
            return;
        }

        // Determine which tables to delete
        let tablesToDrop: string[] = [];

        if (options.tables) {
            // Parse comma-separated list
            const requestedTables = options.tables.split(',').map(t => t.trim()).filter(Boolean);
            // Validate that all requested tables exist
            const invalidTables = requestedTables.filter(t => !allTables.includes(t));
            if (invalidTables.length > 0) {
                error(`Tables not found: ${invalidTables.map(quoteName).join(', ')}`);
                await client.close();
                return;
            }
            tablesToDrop = requestedTables;
        } else {
            // Interactive selection
            const tableChoices = allTables.map(table => ({
                name: table,
                value: table
            }));

            const selectedTables = await checkboxPrompt(
                `Select tables to drop from ${quoteName(dbName)} (use space to select, enter to confirm):`,
                tableChoices
            );

            if (selectedTables.length === 0) {
                info('No tables selected. Drop cancelled.');
                await client.close();
                return;
            }

            tablesToDrop = selectedTables;
        }

        // Count rows in selected tables
        const countSpinner = createSpinner(`Counting rows in ${tablesToDrop.length} table${tablesToDrop.length === 1 ? '' : 's'}`);
        countSpinner.start();

        const tableCounts: Array<{ name: string; count: number }> = [];
        let totalRows = 0;

        for (const tableName of tablesToDrop) {
            const count = await countRows(client, tableName);
            tableCounts.push({ name: tableName, count });
            if (count >= 0) {
                totalRows += count;
            }
        }

        countSpinner.stop();
        console.log(); // Add linebreak

        // Show warning with table details
        if (tablesToDrop.length === tableRows.length) {
            warn(`⚠️  WARNING: This will drop ALL tables from database ${quoteName(dbName)}`);
        } else {
            warn(`⚠️  WARNING: This will drop ${tablesToDrop.length} table${tablesToDrop.length === 1 ? '' : 's'} from database ${quoteName(dbName)}`);
        }
        console.log();
        info(`Tables to drop:`);

        for (const { name, count } of tableCounts) {
            const countStr = count >= 0 ? formatNumber(count) : 'unknown';
            info(`  - ${quoteName(name)}: ${countStr} row${count === 1 ? '' : 's'}`);
        }

        console.log();
        warn(`⚠️  Total rows that will be lost: ${formatNumber(totalRows)}`);
        warn(`⚠️  This action cannot be undone!`);
        console.log();

        // Ask for confirmation by typing "drop"
        const confirmation = await inputPrompt(
            `Type "drop" to confirm drop of ${tablesToDrop.length} table${tablesToDrop.length === 1 ? '' : 's'} from ${quoteName(dbName)}:`,
            undefined,
            (input: string) => {
                if (input.trim().toLowerCase() !== 'drop') {
                    return 'You must type exactly "drop" to confirm';
                }
                return true;
            }
        );

        if (confirmation.trim().toLowerCase() !== 'drop') {
            info('Drop cancelled.');
            await client.close();
            return;
        }

        // Drop selected tables
        const dropSpinner = createSpinner(`Dropping ${tablesToDrop.length} table${tablesToDrop.length === 1 ? '' : 's'}`);
        dropSpinner.start();

        let droppedCount = 0;
        const errors: Array<{ table: string; error: string }> = [];

        for (const tableName of tablesToDrop) {
            try {
                await client.command({ query: `DROP TABLE IF EXISTS \`${tableName}\`` });
                droppedCount++;
            } catch (e) {
                errors.push({ table: tableName, error: String(e) });
            }
        }

        dropSpinner.stop();
        console.log(); // Add linebreak

        if (errors.length > 0) {
            warn(`Dropped ${droppedCount} table${droppedCount === 1 ? '' : 's'}, but encountered ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
            for (const { table, error: err } of errors) {
                error(`  - ${quoteName(table)}: ${err}`);
            }
        } else {
            success(`Successfully dropped ${droppedCount} table${droppedCount === 1 ? '' : 's'} from database ${quoteName(dbName)}`);
        }

        await client.close();
    } catch (e) {
        spinner.stop();
        console.log(); // Add linebreak
        error('Failed to drop tables');
        error(String(e));
    }
}

