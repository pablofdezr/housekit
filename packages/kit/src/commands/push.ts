import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveDatabase } from '../db';
import { loadConfig, loadSchema } from '../loader';
import { detectSchemaDrift, TableAnalysis } from '../schema/analyzer';
import { analyzeExplain } from '../schema/parser';
import { confirmPrompt, error, info, quoteName, success, warn } from '../ui';
import { getSchemaMapping } from '../config';

export async function pushCommand(options: { database?: string; logExplain?: boolean; autoUpgradeMetadata?: boolean }) {
    const shouldDumpExplain = Boolean(options.logExplain);

    const config = await loadConfig();
    const { client, name: dbName } = resolveDatabase(config, options.database);
    const schemaMapping = getSchemaMapping(config);
    const schemaPath = schemaMapping[dbName];
    let anyChanges = false;
    let anyWarnings = false;

    const dumpIfEnabled = async (statements: string[], tableName: string, shadow = false) => {
        if (!shouldDumpExplain) return;
        await dumpExplain(client, statements, tableName, shadow);
    };

    try {
        const tables = await loadSchema(schemaPath, { quiet: true });

        const analyses = await detectSchemaDrift(client, tables, {
            autoUpgradeMetadata: options.autoUpgradeMetadata,
            quiet: true
        });

        for (const analysis of analyses) {
            const { name, type, warnings, plan, shadowPlan, destructiveReasons, adds, modifies, drops, optionChanges, externallyManaged } = analysis;

            if (externallyManaged && type !== 'no_changes') {
                info(`  • ${quoteName(name)}: Skipping changes (Externally Managed)`);
                continue;
            }

            if (type === 'create') {
                warnings.forEach(w => warn(`  ! ${w}`));
                await dumpIfEnabled(plan, name);

                const proceed = await confirmPrompt(`Create table ${quoteName(name)}?`, true);
                if (!proceed) {
                    continue;
                }

                for (const sql of plan) {
                    await client.command({ query: sql });
                }
                success(`Created ${quoteName(name)}`);
                anyChanges = true;
                continue;
            }

            if (type === 'no_changes' && warnings.length === 0) {
                continue;
            }

            if (type === 'no_changes' && warnings.length > 0) {
                warnings.forEach(w => warn(`  ! ${w} (Table: ${quoteName(name)})`));
                anyWarnings = true;
                continue;
            }

            // type === 'modify'
            if (adds.length || modifies.length || drops.length || optionChanges.length) {
                if (adds.length) {
                    info(`  + ${quoteName(name)}: add`);
                    adds.forEach(col => info(`    - ${quoteName(col)}`));
                }
                if (modifies.length) {
                    info(`  ~ ${quoteName(name)}: modify`);
                    modifies.forEach(col => info(`    - ${quoteName(col)}`));
                }
                if (drops.length) {
                    warn(`  - ${quoteName(name)}: drop`);
                    drops.forEach(col => warn(`    - ${quoteName(col)}`));
                }
                if (optionChanges.length) {
                    warn(`  * ${quoteName(name)}: ${optionChanges.join(', ')}`);
                }
            }

            warnings.forEach(w => warn(`  ! ${w}`));
            if (destructiveReasons.length > 0) {
                warn(`  ⚠ ${quoteName(name)}: ${destructiveReasons[0].includes('type change') ? 'type changes' : 'changes'}`);
                destructiveReasons.forEach(reason => warn(`    - ${reason}`));
            }
            if (warnings.length > 0) anyWarnings = true;

            await dumpIfEnabled(plan, name);

            // Prefer shadow swap when there is any destructive change or drops
            if (shadowPlan) {
                const proceedShadow = await confirmPrompt(`Apply shadow swap (Blue-Green) to ${quoteName(name)}?`, true);
                if (proceedShadow) {
                    await dumpIfEnabled(shadowPlan, name, true);
                    for (const stmt of shadowPlan) {
                        await client.command({ query: stmt });
                    }
                    success(`Updated ${quoteName(name)} (via Shadow Swap)`);
                    anyChanges = true;
                    continue;
                }
            }

            if (plan.length === 0) {
                continue;
            }

            const proceed = await confirmPrompt(`Apply ${plan.length} change(s) to ${quoteName(name)}?`, destructiveReasons.length === 0 && drops.length === 0);
            if (!proceed) {
                continue;
            }

            for (const stmt of plan) {
                await dumpIfEnabled([stmt], name);
                await client.command({ query: stmt });
            }
            success(`Updated ${quoteName(name)}`);
            anyChanges = true;
        }

        if (!anyChanges && !anyWarnings) {
            success('No changes detected');
        } else if (anyChanges) {
            success('Push complete');
        }

    } catch (e) {
        error('Push failed');
        error('Error during push:');
        error(String(e));
    } finally {
        await client.close();
    }
}

async function dumpExplain(client: any, statements: string[], tableName: string, shadow = false) {
    if (statements.length === 0) return;
    try {
        const outDir = join(process.cwd(), '.housekit');
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        const explains: any[] = [];
        for (const stmt of statements) {
            if (stmt.trim().toUpperCase().startsWith('SELECT')) {
                try {
                    const res = await client.query({ query: `EXPLAIN ${stmt}` });
                    const text = await res.text();
                    explains.push({ stmt, plan: text, warnings: analyzeExplain(text) });
                } catch (e) {
                    explains.push({ stmt, plan: null, error: String(e) });
                }
            } else {
                explains.push({ stmt, plan: 'DDL statement (no EXPLAIN available)', warnings: [] });
            }
        }
        const file = join(outDir, `${tableName}${shadow ? '_shadow' : ''}_explain.log`);
        writeFileSync(file, JSON.stringify(explains, null, 2));
        info(`Query plan written to ${file}`);
    } catch (e) {
        warn(`Could not dump query plan for ${tableName}: ${String(e)}`);
    }
}
