import { loadConfig, loadSchema } from '../loader';
import { getSchemaMapping } from '../config';
import { error, info, success, warn, quoteName } from '../ui';
import { resolveDatabase } from '../db';
import { detectSchemaDrift } from '../schema/analyzer';

export async function dryRunCommand(options: { database?: string }) {
    const config = await loadConfig();
    const { client, name: dbName } = resolveDatabase(config, options.database);
    const schemaMapping = getSchemaMapping(config);
    const schemaPath = schemaMapping[dbName];

    let totalChanges = 0;
    let totalWarnings = 0;

    try {
        const tables = await loadSchema(schemaPath, { quiet: true });

        const analyses = await detectSchemaDrift(client, tables, {
            autoUpgradeMetadata: false,
            quiet: true
        });

        const changesByTable = analyses.filter(a => a.type !== 'no_changes' || a.warnings.length > 0);

        if (changesByTable.length === 0) {
            success('No changes detected between local schema and remote database');
            return;
        }

        info(`Found changes or warnings in ${changesByTable.length} table${changesByTable.length === 1 ? '' : 's'}:`);
        console.log();

        for (const change of changesByTable) {
            const { name, type, warnings, destructiveReasons, adds, modifies, drops, optionChanges, shadowPlan, rowCount } = change;

            if (type === 'create') {
                info(`Table ${quoteName(name)}: CREATE`);
                console.log(`  • Would create new table`);
                warnings.forEach(w => warn(`  ⚠ ${w}`));
                totalChanges++;
            } else if (type === 'modify') {
                info(`Table ${quoteName(name)}: MODIFY`);

                if (adds.length > 0) {
                    console.log(`  + Add columns:`);
                    adds.forEach(col => console.log(`    • ${quoteName(col)}`));
                }

                if (modifies.length > 0) {
                    console.log(`  ~ Modify columns:`);
                    modifies.forEach(col => console.log(`    • ${quoteName(col)}`));
                }

                if (drops.length > 0) {
                    warn(`  - Drop columns:`);
                    drops.forEach(col => warn(`    • ${quoteName(col)}`));
                }

                if (optionChanges.length > 0) {
                    warn(`  * Option changes: ${optionChanges.join(', ')}`);
                }

                if (destructiveReasons.length > 0) {
                    warn(`  ⚠ Destructive changes:`);
                    destructiveReasons.forEach(reason => warn(`    • ${reason}`));
                }

                if (shadowPlan) {
                    warn(`  ⚠ Would use shadow swap (${shadowPlan.length} statements)`);
                    if (rowCount > 0) {
                        warn(`    • Table has ${rowCount.toLocaleString()} row${rowCount === 1 ? '' : 's'}`);
                    }
                }

                warnings.forEach(w => warn(`  ⚠ ${w}`));
                totalChanges++;
            } else if (warnings.length > 0) {
                info(`Table ${quoteName(name)}: WARNINGS`);
                warnings.forEach(w => warn(`  ⚠ ${w}`));
            }

            totalWarnings += warnings.length;
            console.log();
        }

        // Summary
        const totalAdds = analyses.reduce((sum, a) => sum + a.adds.length, 0);
        const totalModifies = analyses.reduce((sum, a) => sum + a.modifies.length, 0);
        const totalDrops = analyses.reduce((sum, a) => sum + a.drops.length, 0);
        const totalCreates = analyses.filter(a => a.type === 'create').length;
        const totalShadowSwaps = analyses.filter(a => a.shadowPlan !== null).length;

        console.log();
        info('Summary:');
        if (totalCreates > 0) {
            console.log(`  • ${totalCreates} table${totalCreates === 1 ? '' : 's'} would be created`);
        }
        if (totalAdds > 0) {
            console.log(`  • ${totalAdds} column${totalAdds === 1 ? '' : 's'} would be added`);
        }
        if (totalModifies > 0) {
            console.log(`  • ${totalModifies} column${totalModifies === 1 ? '' : 's'} would be modified`);
        }
        if (totalDrops > 0) {
            warn(`  • ${totalDrops} column${totalDrops === 1 ? '' : 's'} would be dropped`);
        }
        if (totalShadowSwaps > 0) {
            warn(`  • ${totalShadowSwaps} table${totalShadowSwaps === 1 ? '' : 's'} would require shadow swap`);
        }
        if (totalWarnings > 0) {
            warn(`  • ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`);
        }

        if (totalChanges === 0 && totalWarnings === 0) {
            success('No changes detected');
        }

    } catch (e) {
        error('Dry run failed');
        error('Error during dry run:');
        error(String(e));
    } finally {
        await client.close();
    }
}
