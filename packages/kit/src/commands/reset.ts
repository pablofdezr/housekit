import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, info, success, warn, confirmPrompt, quoteName } from '../ui';

async function fetchTables(client: any): Promise<string[]> {
    try {
        const result = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
        const parsed = await result.json();
        const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
        if (!Array.isArray(rows)) {
            return [];
        }
        return rows.map((r: any) => r.name || r);
    } catch (e) {
        return [];
    }
}

export async function resetCommand(options: { database?: string }) {
    const config = await loadConfig();
    const { client, name: dbName } = resolveDatabase(config, options.database);

    try {
        const spinner = createSpinner('Fetching tables from database');
        spinner.start();

        const tables = await fetchTables(client);
        spinner.stop();

        if (tables.length === 0) {
            info('No tables found in database.');
            await client.close();
            return;
        }

        console.log();
        warn(`This will DROP ALL ${tables.length} table(s) in database ${quoteName(dbName)}:`);
        tables.forEach(table => {
            console.log(`  • ${quoteName(table)}`);
        });
        console.log();

        const confirmed = await confirmPrompt(
            `Are you sure you want to reset database ${quoteName(dbName)}? This action cannot be undone!`,
            false
        );

        if (!confirmed) {
            info('Reset cancelled.');
            await client.close();
            return;
        }

        const dropSpinner = createSpinner('Dropping tables');
        dropSpinner.start();

        let droppedCount = 0;
        let errorCount = 0;

        for (const table of tables) {
            try {
                await client.command({ query: `DROP TABLE IF EXISTS \`${table}\`` });
                droppedCount++;
            } catch (e) {
                error(`Failed to drop table ${quoteName(table)}: ${String(e)}`);
                errorCount++;
            }
        }

        dropSpinner.stop();

        if (errorCount === 0) {
            success(`Successfully dropped ${droppedCount} table(s)`);
            info('Database has been reset. Run "housekit migrate" to apply migrations.');
        } else {
            warn(`Dropped ${droppedCount} table(s), ${errorCount} error(s) occurred`);
        }

        await client.close();
    } catch (e) {
        error(`Failed to reset database: ${String(e)}`);
        await client.close();
        throw e;
    }
}

