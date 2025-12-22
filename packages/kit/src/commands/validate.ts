import { loadConfig, loadSchema } from '../loader';
import { getSchemaMapping } from '../config';
import { createSpinner, error, info, success, warn, quoteName } from '../ui';
import { resolveDatabase } from '../db';
import { detectSchemaDrift } from '../schema/analyzer';

export async function validateCommand(options: { database?: string; autoUpgradeMetadata?: boolean }) {
    const spinner = createSpinner('Validating schema');
    spinner.start();

    try {
        const config = await loadConfig();
        const { client, name: dbName } = resolveDatabase(config, options.database);
        const schemaMapping = getSchemaMapping(config);
        const schemaPath = schemaMapping[dbName];

        const tables = await loadSchema(schemaPath, { quiet: true });

        spinner.text = 'Comparing schemas';
        const analyses = await detectSchemaDrift(client, tables, {
            autoUpgradeMetadata: options.autoUpgradeMetadata,
            quiet: true
        });

        let isValid = true;
        let totalIssues = 0;
        const issuesByTable = new Map<string, Array<{ type: 'missing' | 'mismatch' | 'warning', message: string }>>();

        for (const analysis of analyses) {
            const { name, type, warnings, destructiveReasons, adds, modifies, drops, optionChanges, shadowPlan, externallyManaged } = analysis;
            const tableIssues: Array<{ type: 'missing' | 'mismatch' | 'warning', message: string }> = [];

            const label = externallyManaged ? ' (Externally Managed)' : '';

            if (type === 'create') {
                if (!externallyManaged) isValid = false;
                totalIssues++;
                tableIssues.push({ type: 'missing', message: `Table does not exist in database${label}` });
            } else if (type === 'modify') {
                if (!externallyManaged) isValid = false;
                totalIssues += adds.length + modifies.length + drops.length + optionChanges.length;

                adds.forEach(col => tableIssues.push({ type: 'mismatch', message: `Missing column: ${quoteName(col)}${label}` }));
                modifies.forEach(col => tableIssues.push({ type: 'mismatch', message: `Column mismatch: ${quoteName(col)}${label}` }));
                drops.forEach(col => tableIssues.push({ type: 'mismatch', message: `Extra column in database: ${quoteName(col)}${label}` }));
                optionChanges.forEach(change => tableIssues.push({ type: 'mismatch', message: `Table option mismatch: ${change}${label}` }));

                if (shadowPlan) {
                    tableIssues.push({ type: 'mismatch', message: `Table requires shadow migration (destructive changes detected)${label}` });
                }
            }

            warnings.forEach(warning => tableIssues.push({ type: 'warning', message: warning }));

            if (tableIssues.length > 0) {
                issuesByTable.set(name, tableIssues);
            }
        }

        spinner.stop();

        console.log();
        success(`Database: ${quoteName(dbName)}`);
        console.log();

        if (issuesByTable.size === 0) {
            success('✓ Schema validation passed!');
            info('All tables match the code schema.');
        } else {
            for (const [tableName, issues] of issuesByTable.entries()) {
                console.log();
                warn(`Table: ${quoteName(tableName)}`);

                issues.forEach(issue => {
                    if (issue.type === 'missing') error(`  ✗ ${issue.message}`);
                    else if (issue.type === 'mismatch') warn(`  ⚠ ${issue.message}`);
                    else info(`  ℹ ${issue.message}`);
                });
            }

            console.log();
            if (!isValid) {
                error(`✗ Schema validation failed!`);
                error(`Found ${totalIssues} issue(s) across ${issuesByTable.size} table(s).`);
                info('Run "housekit push" or "housekit dry-run" to see pending changes.');
            } else {
                warn(`⚠ Schema validation passed with warnings.`);
            }
        }

        await client.close();
    } catch (e) {
        spinner.fail('Failed to validate schema');
        error(String(e));
    }
}
