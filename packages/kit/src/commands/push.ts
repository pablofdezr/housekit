import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveDatabase } from '../db';
import { loadConfig, loadSchema } from '../loader';
import { detectSchemaDrift, TableAnalysis } from '../schema/analyzer';
import { analyzeExplain } from '../schema/parser';
import { confirmPrompt, error, info, quoteName, success, warn, title, box, bold } from '../ui';
import chalk from 'chalk';
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
        title('HouseKit Push — Data Synchronizer');
        info(`Schema: ${chalk.white.bold(schemaPath)}`);
        info(`Target: ${chalk.white.bold(dbName)}\n`);

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
            const changeDescriptions: string[] = [];
            if (adds.length || modifies.length || drops.length || optionChanges.length) {
                if (adds.length) {
                    changeDescriptions.push(chalk.green(`  + ${adds.length} addition(s)`));
                    adds.forEach(col => changeDescriptions.push(`    ${chalk.gray('•')} ${quoteName(col)}`));
                }
                if (modifies.length) {
                    changeDescriptions.push(chalk.blue(`  ~ ${modifies.length} modification(s)`));
                    modifies.forEach(col => changeDescriptions.push(`    ${chalk.gray('•')} ${quoteName(col)}`));
                }
                if (drops.length) {
                    changeDescriptions.push(chalk.red(`  - ${drops.length} drop(s)`));
                    drops.forEach(col => changeDescriptions.push(`    ${chalk.gray('•')} ${quoteName(col)}`));
                }
                if (optionChanges.length) {
                    changeDescriptions.push(chalk.magenta(`  * ${optionChanges.length} option change(s): ${optionChanges.join(', ')}`));
                }
            }

            if (warnings.length > 0) {
                warnings.forEach(w => changeDescriptions.push(chalk.yellow(`  ! ${w}`)));
                anyWarnings = true;
            }

            if (destructiveReasons.length > 0) {
                const header = destructiveReasons[0].includes('type change') ? 'Type Changes Required' : 'Schema Changes Detected';
                changeDescriptions.push(chalk.yellow.bold(`\n  ⚠ ${header}:`));
                destructiveReasons.forEach(reason => changeDescriptions.push(`    ${chalk.yellow('-')} ${reason}`));
            }

            if (changeDescriptions.length > 0) {
                box([
                    chalk.bold.white(`Table: ${quoteName(name)}`),
                    '',
                    ...changeDescriptions
                ].join('\n'), {
                    borderColor: destructiveReasons.length > 0 ? 'yellow' : 'cyan',
                    padding: 0
                });
            }

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
        
        // Handle AggregateError (multiple errors)
        if (e instanceof AggregateError) {
            error('Multiple errors occurred:');
            for (const err of e.errors) {
                error(`  • ${err instanceof Error ? err.message : String(err)}`);
                if (err instanceof Error && err.stack) {
                    const stackLines = err.stack.split('\n').slice(1, 3);
                    stackLines.forEach(line => error(`    ${line.trim()}`));
                }
            }
        } else if (e instanceof Error) {
            error(e.message);
            if (e.cause) {
                error(`Caused by: ${e.cause instanceof Error ? e.cause.message : String(e.cause)}`);
            }
        } else {
            error(String(e));
        }
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
