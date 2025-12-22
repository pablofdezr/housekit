import Table from 'cli-table3';
import { loadConfig } from '../loader';
import { resolveDatabase } from '../db';
import { createSpinner, error, info, success, quoteName } from '../ui';

async function fetchTables(client: any): Promise<string[]> {
    const result = await client.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
    const parsed = await result.json();
    const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
    if (!Array.isArray(rows)) {
        throw new TypeError('Unexpected response format for SHOW TABLES');
    }
    return rows.map((r: any) => r.name || r);
}

async function getTableInfo(client: any, tableName: string): Promise<{
    rowCount: number;
    size: string;
    engine: string;
}> {
    try {
        // Get row count
        const countResult = await client.query({ 
            query: `SELECT count() as count FROM \`${tableName}\``, 
            format: 'JSONEachRow' 
        });
        const countParsed = await countResult.json();
        const countRows = Array.isArray(countParsed) ? countParsed : (countParsed?.data ?? []);
        const rowCount = countRows.length > 0 ? Number(countRows[0].count || 0) : 0;

        // Get table size and engine from system.tables
        const infoResult = await client.query({
            query: `SELECT 
                formatReadableSize(total_bytes) as size,
                engine
            FROM system.tables 
            WHERE database = currentDatabase() AND name = '${tableName}'`,
            format: 'JSONEachRow'
        });
        const infoParsed = await infoResult.json();
        const infoRows = Array.isArray(infoParsed) ? infoParsed : (infoParsed?.data ?? []);
        
        const size = infoRows.length > 0 ? (infoRows[0].size || '0 B') : '0 B';
        const engine = infoRows.length > 0 ? (infoRows[0].engine || 'Unknown') : 'Unknown';

        return { rowCount, size, engine };
    } catch (e) {
        // If we can't get detailed info, return defaults
        return { rowCount: 0, size: 'Unknown', engine: 'Unknown' };
    }
}

export async function listCommand(options: { database?: string }) {
    const spinner = createSpinner('Loading tables from database');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName } = resolveDatabase(config, options.database);

        const tables = await fetchTables(client);
        
        if (tables.length === 0) {
            spinner.warn('No tables found in database.');
            await client.close();
            return;
        }

        spinner.text = 'Fetching table information';
        
        const tableInfo = await Promise.all(
            tables.map(async (table) => {
                const info = await getTableInfo(client, table);
                return { name: table, ...info };
            })
        );

        spinner.succeed('Tables loaded');
        
        console.log();
        success(`Database: ${quoteName(dbName)}`);
        console.log();

        const listTable = new Table({
            head: ['Table', 'Rows', 'Size', 'Engine'],
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
            colWidths: [null, 15, 15, 20]
        });

        tableInfo.forEach(({ name, rowCount, size, engine }) => {
            listTable.push([
                quoteName(name),
                rowCount.toLocaleString(),
                size,
                engine
            ]);
        });

        console.log(listTable.toString());
        console.log();
        info(`Total: ${tables.length} table(s)`);

        await client.close();
    } catch (e) {
        spinner.fail('Failed to list tables');
        error(String(e));
    }
}

