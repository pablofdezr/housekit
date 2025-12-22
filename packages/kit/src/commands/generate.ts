import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, loadSchema } from '../loader';
import { getDatabaseConfigs, getSchemaMapping } from '../config';
import { info, success, warn, quoteName } from '../ui';

export async function generateCommand() {
    const config = await loadConfig();

    // Get database configurations and schema mappings
    const databases = getDatabaseConfigs(config);
    const schemaMapping = getSchemaMapping(config);

    // Prepare output directory
    const outDir = config.out || './housekit';
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    let hasChanges = false;

    // Process each database
    for (const [dbName, dbConfig] of Object.entries(databases)) {
        const schemaPath = schemaMapping[dbName];
        if (!schemaPath) {
            warn(`No schema path defined for database ${quoteName(dbName)}`);
            continue;
        }

        const currentTables = await loadSchema(schemaPath, { quiet: true });
        const tableNames = Object.keys(currentTables).sort();

        if (tableNames.length === 0) {
            continue;
        }

        // Create database-specific subdirectory
        const dbOutDir = join(outDir, dbName);
        if (!existsSync(dbOutDir)) mkdirSync(dbOutDir, { recursive: true });

        // Load previous Snapshot (if exists)
        const snapshotPath = join(dbOutDir, 'snapshot.json');
        let previousTables: Record<string, any> = {};

        if (existsSync(snapshotPath)) {
            previousTables = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
        }

        // Calculate Differences
        const sqlStatements: string[] = [];
        const changes: string[] = [];

        // New Tables
        for (const name of tableNames) {
            if (!previousTables[name]) {
                changes.push(`  • New table: ${quoteName(name)}`);
                sqlStatements.push(currentTables[name].toSQL() + ';');
            } else {
                // Changes in Existing Tables (New Columns)
                const currentCols = Object.keys(currentTables[name].$columns);
                const prevCols = Object.keys(previousTables[name].columns || {});

                const newCols = currentCols.filter(c => !prevCols.includes(c));

                for (const colName of newCols) {
                    changes.push(`  • New column in ${quoteName(name)}: ${quoteName(colName)}`);
                    const col = (currentTables[name].$columns as any)[colName];
                    const colDef = col.toSQL();
                    sqlStatements.push(`ALTER TABLE \`${name}\` ADD COLUMN \`${colName}\` ${colDef};`);
                }
            }
        }

        if (sqlStatements.length === 0) {
            continue;
        }

        hasChanges = true;

        // Generate SQL file
        const timestamp = new Date().getTime();
        const migrationName = `${timestamp}_migration.sql`;
        const migrationContent = sqlStatements.join('\n\n');

        writeFileSync(join(dbOutDir, migrationName), migrationContent);

        // Show changes summary
        console.log();
        info(`Database ${quoteName(dbName)}:`);
        changes.forEach(change => console.log(change));
        success(`Migration generated: ${join(dbOutDir, migrationName)}`);

        // Update Snapshot
        const newSnapshot: Record<string, any> = {};
        for (const name of tableNames) {
            const table = currentTables[name];
            const columnsSchema: Record<string, any> = {};
            for (const [colName, col] of Object.entries(table.$columns as Record<string, any>)) {
                columnsSchema[colName] = {
                    type: col.toSQL()
                };
            }
            newSnapshot[name] = {
                columns: columnsSchema
            };
        }

        writeFileSync(snapshotPath, JSON.stringify(newSnapshot, null, 2));
    }

    if (!hasChanges) {
        success('No pending changes');
    }
}
