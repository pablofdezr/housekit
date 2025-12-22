import type { ClickHouseClient } from '@clickhouse/client';
import { ClickHouseColumn, detectMaterializedViewDrift, extractMVQuery } from '@housekit/orm';
import type { TableDefinition, TableColumns } from '@housekit/orm';
import { diffTable, type RemoteTableDescription } from './diff';
import { parseColumnsFromCreate, parseCreate } from './parser';
import { info, quoteName } from '../ui';

export interface TableAnalysis {
    name: string;
    type: 'create' | 'modify' | 'no_changes';
    adds: string[];
    modifies: string[];
    drops: string[];
    optionChanges: string[];
    destructiveReasons: string[];
    warnings: string[];
    plan: string[];
    shadowPlan: string[] | null;
    rowCount: number;
    table: any;
    remote: RemoteTableDescription | null;
    externallyManaged: boolean;
}

export interface AnalysisOptions {
    autoUpgradeMetadata?: boolean;
    quiet?: boolean;
}

/**
 * Detects schema drift between the local schema and the remote database.
 * Centralizes the logic used by push, dry-run, and validate commands.
 */
export async function detectSchemaDrift(
    client: ClickHouseClient,
    localSchema: Record<string, any>,
    options: AnalysisOptions = {}
): Promise<TableAnalysis[]> {
    const results: TableAnalysis[] = [];

    for (const [name, table] of Object.entries(localSchema)) {
        const tableOpts = (table as any).$options || {};
        const isExternallyManaged = !!tableOpts.externallyManaged;

        const cols: Record<string, ClickHouseColumn> = (table as any).$columns || {};
        const tableWarnings: string[] = [];

        // Basic sanity checks for MergeTree family
        // These are common warnings that shouldn't block but should be reported
        if (tableOpts.deduplicateBy && !tableOpts.versionColumn) {
            tableWarnings.push(`uses deduplicateBy without versionColumn. Consider setting versionColumn to make dedup deterministic.`);
        }

        if (Array.isArray(tableOpts.deduplicateBy)) {
            for (const key of tableOpts.deduplicateBy) {
                if (!cols[key]) {
                    tableWarnings.push(`deduplicateBy column ${quoteName(key)} not found in ${quoteName(name)}`);
                }
            }
        } else if (typeof tableOpts.deduplicateBy === 'string') {
            if (!cols[tableOpts.deduplicateBy]) {
                tableWarnings.push(`deduplicateBy column ${quoteName(tableOpts.deduplicateBy)} not found in ${quoteName(name)}`);
            }
        }

        if (tableOpts.versionColumn && !cols[tableOpts.versionColumn]) {
            tableWarnings.push(`versionColumn ${quoteName(tableOpts.versionColumn)} not found in ${quoteName(name)}`);
        }

        const remote = await describeTable(client, name, options.quiet ?? true);
        const rowCount = await countRows(client, name);

        if (!remote) {
            // Table doesn't exist - it's a creation
            const sqls: string[] = typeof (table as any).toSQLs === 'function'
                ? (table as any).toSQLs()
                : [table.toSQL()];

            results.push({
                name,
                type: 'create',
                adds: [],
                modifies: [],
                drops: [],
                optionChanges: [],
                destructiveReasons: [],
                warnings: tableWarnings,
                plan: sqls,
                shadowPlan: null,
                rowCount: 0,
                table: table as any,
                remote: null,
                externallyManaged: isExternallyManaged,
            });
            continue;
        }

        if (remote && (table as any).$kind === 'materializedView') {
            const remoteCreateRes = await client.query({
                query: `SHOW CREATE TABLE \`${name}\``,
                format: 'JSONEachRow'
            });
            const remoteCreateParsed = await remoteCreateRes.json() as any;
            const remoteCreateRows = Array.isArray(remoteCreateParsed) ? remoteCreateParsed : (remoteCreateParsed?.data ?? []);
            const remoteStatement = (remoteCreateRows[0] as any)?.statement || '';
            const remoteQuery = extractMVQuery(remoteStatement);

            const drift = detectMaterializedViewDrift(table as any, remoteQuery || '');
            if (drift.hasDrift) {
                results.push({
                    name,
                    type: 'modify',
                    adds: [],
                    modifies: [],
                    drops: [],
                    optionChanges: ['query'],
                    destructiveReasons: ['materialized view query change'],
                    warnings: tableWarnings,
                    plan: [table.toSQL()],
                    shadowPlan: null, // MVs don't support shadow swaps easily yet
                    rowCount,
                    table: table as any,
                    remote,
                    externallyManaged: isExternallyManaged,
                });
                continue;
            }
        }

        const diff = diffTable(table as any, cols, remote, {
            autoUpgradeMetadata: options.autoUpgradeMetadata
        });

        const allWarnings = [...tableWarnings, ...diff.warnings];
        const hasChanges = diff.plan.length > 0 || diff.shadowPlan !== null;

        results.push({
            name,
            type: hasChanges ? 'modify' : 'no_changes',
            adds: diff.adds,
            modifies: diff.modifies,
            drops: diff.drops,
            optionChanges: diff.optionChanges,
            destructiveReasons: diff.destructiveReasons,
            warnings: allWarnings,
            plan: Array.isArray(diff.plan) ? diff.plan : [],
            shadowPlan: diff.shadowPlan,
            rowCount,
            table: table as any,
            remote,
            externallyManaged: isExternallyManaged,
        });
    }

    return results;
}

/**
 * Fetches the description of a remote table, including its columns, defaults, and options.
 */
export async function describeTable(
    client: ClickHouseClient,
    tableName: string,
    quiet = false
): Promise<RemoteTableDescription | null> {
    try {
        if (!quiet) info(`Checking if table ${tableName} exists...`);
        const res = await client.query({
            query: `DESCRIBE TABLE \`${tableName}\``,
            format: 'JSONEachRow'
        });
        const describeParsed = await res.json() as any;
        const rows = Array.isArray(describeParsed) ? describeParsed : (describeParsed?.data ?? []);

        if (!Array.isArray(rows)) {
            throw new TypeError('Unexpected DESCRIBE format');
        }

        const map: Record<string, string> = {};
        rows.forEach((r: any) => { map[r.name] = r.type; });

        if (!quiet) info(`Found existing table ${tableName} with ${Object.keys(map).length} columns`);

        // Try to get table comment directly
        let tableComment: string | null = null;
        try {
            const commentRes = await client.query({
                query: `SELECT comment FROM system.tables WHERE name = {table:String} LIMIT 1`,
                query_params: { table: tableName },
                format: 'JSONEachRow'
            });
            const commentParsed = await commentRes.json() as any;
            const commentRows = Array.isArray(commentParsed) ? commentParsed : (commentParsed?.data ?? []);
            if (Array.isArray(commentRows) && commentRows.length > 0) {
                tableComment = (commentRows[0] as any)?.comment ?? null;
            }
        } catch {
            // ignore, we'll parse from SHOW CREATE if needed
        }

        const createRes = await client.query({
            query: `SHOW CREATE TABLE \`${tableName}\``,
            format: 'JSONEachRow'
        });
        const createParsed = await createRes.json() as any;
        const createRows = Array.isArray(createParsed) ? createParsed : (createParsed?.data ?? []);

        if (!Array.isArray(createRows) || createRows.length === 0) {
            throw new TypeError('Unexpected SHOW CREATE format');
        }

        const statement = (createRows[0] as any)?.statement || '';
        const parsedOptions = parseCreate(statement);

        const defaultsMap: Record<string, string> = {};
        const columnDefs = parseColumnsFromCreate(statement);
        columnDefs.forEach(def => {
            const actualColName = Object.keys(map).find(n => n.toLowerCase() === def.name.toLowerCase());
            if (actualColName) {
                map[actualColName] = def.definition;
            }
            if (def.defaultValue) {
                defaultsMap[def.name.toLowerCase()] = def.defaultValue;
            }
        });

        const commentMatch = statement.match(/COMMENT\s+'((?:[^']|'')*)'/);
        if (commentMatch && !tableComment) {
            tableComment = commentMatch[1].replace(/''/g, "'");
        }

        return {
            columns: map,
            defaults: defaultsMap,
            options: parsedOptions,
            comment: tableComment
        };
    } catch (e) {
        return null;
    }
}

/**
 * Counts rows in a given table.
 */
export async function countRows(client: ClickHouseClient, tableName: string): Promise<number> {
    try {
        const res = await client.query({
            query: `SELECT count() AS cnt FROM \`${tableName}\``,
            format: 'JSONEachRow'
        });
        const parsed = await res.json() as any;
        const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
        if (!Array.isArray(rows)) {
            throw new TypeError('Unexpected COUNT format');
        }
        return Number((rows[0] as any)?.cnt ?? 0);
    } catch {
        return -1;
    }
}
