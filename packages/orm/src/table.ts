import { ClickHouseColumn } from './column';
import { TTLRule } from './data-types';
import { EngineConfiguration, renderEngineSQL, isMergeTreeFamily, getVersionColumn, Engine } from './engines';
import { assertMetadataVersion, buildHousekitMetadata, defaultMetadataVersion, getMetadataDefaults, type MetadataVersion } from './metadata';

export interface TableOptions {
    /**
     * ClickHouse table engine configuration.
     * 
     * // Raw string (escape hatch)
     * customEngine: 'MergeTree()'
     * ```
     */
    engine?: EngineConfiguration;
    customEngine?: string;
    orderBy?: string | string[];
    partitionBy?: string | string[];
    primaryKey?: string | string[];
    logicalPrimaryKey?: string | string[]; // Logical PK (not enforced physically)
    ttl?: TTLRule | TTLRule[] | string; // Support helper objects, arrays, or raw strings
    appendOnly?: boolean; // OLAP default: true
    deduplicateBy?: string | string[]; // Helper for ReplacingMergeTree-style dedup
    versionColumn?: string; // Column used for deterministic deduplication (ReplacingMergeTree version)
    externallyManaged?: boolean; // Skip push/diff if true
    sampleBy?: string | string[]; // Added support for SAMPLE BY
    onCluster?: string;
    shardKey?: string | string[];
    materializedView?: {
        name: string;
        toTable: string;
        query: string;
        populate?: boolean;
    };
    defaultFinal?: boolean; // Prefer FINAL by default when querying this table
    metadataVersion?: MetadataVersion; // Version for Housekit metadata comment
    readOnly?: boolean; // Only used in metadata version >=1.2.0
    indices?: IndexDefinition[];
    projections?: ProjectionDefinition[];
    asyncInsert?: boolean; // Enable/disable async_insert for this table
}

export type IndexDefinition = {
    name: string;
    cols: ClickHouseColumn[];
    type: 'minmax' | 'set' | 'bloom_filter';
    granularity?: number;
};

export type ProjectionDefinition = {
    name: string;
    query: string;
};

export const index = (name: string) => ({
    on: (...cols: ClickHouseColumn[]) => ({
        type: (type: IndexDefinition['type'], granularity?: number): IndexDefinition => ({
            name,
            cols,
            type,
            granularity
        })
    })
});

export const projection = (name: string, query: string): ProjectionDefinition => ({
    name,
    query
});

export type RelationDefinition<TTarget extends TableDefinition<any> = TableDefinition<any>> =
    | {
        relation: 'one';
        name: string;
        table: TTarget;
        fields: ClickHouseColumn[];
        references: ClickHouseColumn[];
    }
    | {
        relation: 'many';
        name: string;
        table: TTarget;
        fields?: ClickHouseColumn[];
        references?: ClickHouseColumn[];
    };

export type TableColumns = Record<string, ClickHouseColumn<any, any, any>>;

export type TableRow<TCols extends TableColumns> = {
    [K in keyof TCols]: TCols[K] extends ClickHouseColumn<infer T, infer NotNull, any>
    ? NotNull extends true
    ? T
    : T | null
    : never;
};

export type TableInsert<TCols extends TableColumns> = {
    [K in keyof TCols as TCols[K] extends ClickHouseColumn<any, infer NotNull, infer Auto>
    ? NotNull extends true
    ? Auto extends true
    ? never
    : K
    : K
    : never]: TCols[K] extends ClickHouseColumn<infer T, any, any> ? T : never
};

// Helper to extract the TypeScript type from a ClickHouseColumn
type GetColumnType<T extends ClickHouseColumn> = T extends ClickHouseColumn<infer Type, infer IsNotNull, any>
    ? IsNotNull extends true ? Type : Type | null
    : never;

export type InferSelectModel<T extends { $columns: TableColumns }> = { [K in keyof T['$columns']]: GetColumnType<T['$columns'][K]> };

export type InferInsertModel<T extends { $columns: TableColumns }> = TableInsert<T['$columns']>;

type InferInsertFromColumns<T> = T extends { $columns: infer TCols extends TableColumns } ? TableInsert<TCols> : never;
type InferSelectFromColumns<T> = T extends { $columns: infer TCols extends TableColumns } ? InferSelectModel<{ $columns: TCols }> : never;

// @internal - Used internally for clean autocomplete
export type CleanInsert<T> = T extends { $inferInsert: infer I } ? I : InferInsertFromColumns<T>;

// @internal - Used internally for clean autocomplete
export type CleanSelect<T> = T extends { $inferSelect: infer S } ? S : InferSelectFromColumns<T>;

export type InferInsertValue<TCols extends TableColumns, K extends keyof TCols> =
  TCols[K] extends ClickHouseColumn<infer Type, infer NotNull, any>
    ? NotNull extends true
      ? Type
      : Type | undefined | null
    : never;

export type TableInsertArray<T extends TableDefinition<TableColumns>> = T['$inferInsert'][];

export type TableModel<T extends TableDefinition<TableColumns>> = PublicSelectModel<T>;

export type InsertModel<T extends TableDefinition<TableColumns>> = PublicInsertModel<T>;

type PublicSelectModel<T extends TableDefinition<TableColumns>> = {
    [K in keyof T['$columns']]: GetColumnType<T['$columns'][K]>
};

type PublicInsertModel<T extends TableDefinition<TableColumns>> = TableInsert<T['$columns']>;

export type TableDefinition<TCols extends TableColumns, TOptions = TableOptions> = {
    $table: string;
    $columns: TCols;
    $options: TOptions;
    $relations?: Record<string, RelationDefinition>;
    toSQL(): string;
    toSQLs?(): string[];
    as(alias: string): TableDefinition<TCols, TOptions>;
    // Phantom types for inference
    $inferSelect: InferSelectModel<{ $columns: TCols }>;
    $inferInsert: InferInsertModel<{ $columns: TCols }>;
} & TCols;

// Internal table shape for cleaner public signatures.
export type TableRuntime<TInsert = any, TSelect = any, TOptions = TableOptions> = {
    $table: string;
    $columns: TableColumns;
    $options: TOptions;
    $relations?: Record<string, RelationDefinition>;
    toSQL(): string;
    toSQLs?(): string[];
    as(alias: string): TableRuntime<TInsert, TSelect, TOptions>;
    // Phantom types for inference
    $inferSelect: TSelect;
    $inferInsert: TInsert;
};

export interface VersionedMeta {
    baseName: string;
    version: string | number;
    aliasName?: string;
}

function attachTableName<T extends TableColumns>(tableName: string, columns: T) {
    for (const col of Object.values(columns)) {
        col.tableName = tableName;
    }
}

function assignColumnsToTable<T extends TableColumns>(target: any, columns: T, tableName: string) {
    for (const [key, col] of Object.entries(columns)) {
        const column = col as ClickHouseColumn;
        column.tableName = tableName;
        target[key] = column;
    }
    return target as TableDefinition<T>;
}

type CommonViewOptions = {
    onCluster?: string;
    orReplace?: boolean;
};

export interface ViewOptions extends CommonViewOptions {
    kind?: 'view';
}

export interface MaterializedViewOptions extends CommonViewOptions {
    kind?: 'materializedView';
    toTable?: string;
    engine?: EngineConfiguration;
    populate?: boolean;
}

export function chTable<T extends Record<string, ClickHouseColumn<any, any, any>>>(
    tableName: string,
    columns: T,
    options: TableOptions = {}
) {
    // Attach table name to columns for query builders (qualification)
    attachTableName(tableName, columns);

    let resolvedMetadataVersion: MetadataVersion;
    if (options.metadataVersion) {
        const versionStr = String(options.metadataVersion);
        assertMetadataVersion(versionStr);
        resolvedMetadataVersion = versionStr;
    } else {
        resolvedMetadataVersion = defaultMetadataVersion;
    }

    const defaults = getMetadataDefaults(resolvedMetadataVersion);

    const finalOptions: TableOptions = {
        appendOnly: options.appendOnly ?? defaults.appendOnly,
        metadataVersion: resolvedMetadataVersion,
        readOnly: options.readOnly ?? (defaults.readOnly ?? false),
        deduplicateBy: options.deduplicateBy,
        customEngine: options.customEngine,
        engine: options.engine,
        orderBy: options.orderBy,
        partitionBy: options.partitionBy,
        primaryKey: options.primaryKey,
        sampleBy: options.sampleBy,
        logicalPrimaryKey: options.logicalPrimaryKey,
        ttl: options.ttl,
        versionColumn: options.versionColumn,
        externallyManaged: options.externallyManaged,
        onCluster: options.onCluster,
        shardKey: options.shardKey,
        materializedView: options.materializedView,
        indices: options.indices,
        projections: options.projections,
        asyncInsert: options.asyncInsert
    };

    // Cluster Intelligence: If user specifies onCluster but no engine,
    // HouseKit suggests ReplicatedMergeTree for safety in distributed setups
    if (finalOptions.onCluster && !finalOptions.engine) {
        finalOptions.engine = Engine.ReplicatedMergeTree();
    }

    const engineConfig = finalOptions.engine;
    const engineStr = renderEngineSQL(engineConfig);

    // Check if this is a MergeTree-family engine (requires ORDER BY, etc.)
    const isMergeTreeFamilyEngine = isMergeTreeFamily(engineConfig);

    // Auto-detect ReplacingMergeTree for defaultFinal
    if (finalOptions.defaultFinal === undefined && /ReplacingMergeTree/i.test(engineStr)) {
        finalOptions.defaultFinal = true;
    }

    // Extract version column from typed engine config if not explicitly set
    if (!finalOptions.versionColumn) {
        const extractedVersion = getVersionColumn(engineConfig);
        if (extractedVersion) {
            finalOptions.versionColumn = extractedVersion;
        }
    }
    const onClusterClause = finalOptions.onCluster ? `ON CLUSTER ${finalOptions.onCluster}` : '';

    const normalizeList = (val: string | string[] | undefined) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(v => v.toString().trim()).filter(Boolean);
        return val.split(',').map(v => v.trim()).filter(Boolean);
    };

    const ensureColumnsExist = (label: string, raw: string | string[] | undefined) => {
        const identifiers = normalizeList(raw).filter(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v));

        // Create a set of valid column names from the columns object
        const validColumnNames = new Set(Object.values(columns).map(c => c.name));

        for (const id of identifiers) {
            // Check if the identifier exists as a property key OR as a column name
            const exists = columns[id] || validColumnNames.has(id);
            if (!exists) {
                // Also allow functions like toYYYYMM(created_at) - simple check
                // If it contains parens, we skip strict validation for now or implement a smarter parser
                if (id.includes('(')) continue;

                throw new Error(`Column "${id}" referenced in ${label} does not exist in table ${tableName}`);
            }
        }
    };

    if (isMergeTreeFamilyEngine) {
        if (!finalOptions.orderBy || normalizeList(finalOptions.orderBy).length === 0) {
            throw new Error(`orderBy is required for MergeTree-family tables (${tableName})`);
        }
        ensureColumnsExist('orderBy', finalOptions.orderBy);
        ensureColumnsExist('primaryKey', finalOptions.primaryKey);
        ensureColumnsExist('partitionBy', finalOptions.partitionBy);
        ensureColumnsExist('sampleBy', finalOptions.sampleBy);

        // Validate ReplacingMergeTree requires versionColumn
        // Note: With typed engines, we can get the version from the config
        if (engineStr.toLowerCase().includes('replacingmergetree') && !finalOptions.versionColumn) {
            throw new Error(`versionColumn is required for ReplacingMergeTree in table ${tableName}`);
        }

        // AGGRESSIVE: Warn if deduplicateBy or logicalPrimaryKey are used without a deduplicating engine.
        // ClickHouse doesn't have unique constraints; deduplication happens in background via specific engines.
        const isDeduplicationEngine = engineStr.toLowerCase().includes('replacingmergetree') ||
            engineStr.toLowerCase().includes('collapsingmergetree');

        if (finalOptions.engine?.type === 'MergeTree' && finalOptions.deduplicateBy) {
            console.warn(`[housekit] Table "${tableName}" uses "deduplicateBy" but engine is MergeTree. Deduplication won't happen. Did you mean ReplacingMergeTree?`);
        }

        if (finalOptions.logicalPrimaryKey && !isDeduplicationEngine) {
            console.warn(`[housekit] Table "${tableName}" uses "logicalPrimaryKey" but engine is ${finalOptions.engine?.type || 'MergeTree'}. Standard MergeTree does not enforce uniqueness. Did you mean ReplacingMergeTree or CollapsingMergeTree?`);
        }

        if (finalOptions.deduplicateBy) {
            ensureColumnsExist('deduplicateBy', finalOptions.deduplicateBy);
            if (!finalOptions.versionColumn) {
                throw new Error(`versionColumn is required when deduplicateBy is set in table ${tableName}`);
            }
            if (!columns[finalOptions.versionColumn]) {
                throw new Error(`versionColumn "${finalOptions.versionColumn}" not found in table ${tableName}`);
            }
        }
    } else {
        // Non MergeTree engines: still validate referenced columns if provided
        ensureColumnsExist('orderBy', finalOptions.orderBy);
        ensureColumnsExist('primaryKey', finalOptions.primaryKey);
        ensureColumnsExist('partitionBy', finalOptions.partitionBy);
        ensureColumnsExist('sampleBy', finalOptions.sampleBy);
    }

    // Create base object - we'll add columns as getters to ensure they're always resolved dynamically
    // This prevents issues when columns are accessed in object literals or other contexts
    const tableDefBase: any = {
        $table: tableName,
        $columns: columns,
        $options: finalOptions,
        // Phantom types for inference
        $inferSelect: undefined as any,
        $inferInsert: undefined as any,
        toSQL: () => {
            if (finalOptions.externallyManaged) {
                return ''; // No SQL for externally managed tables
            }

            const colDefs = Object.values(columns).map(col => {
                return `\`${col.name}\` ${col.toSQL()}`;
            });

            const formatIndexExpr = (cols: ClickHouseColumn[]) => {
                const parts = cols.map(c => `\`${c.name}\``);
                return cols.length > 1 ? `tuple(${parts.join(', ')})` : parts[0];
            };

            if (finalOptions.indices?.length) {
                for (const idx of finalOptions.indices) {
                    if (!idx.cols || idx.cols.length === 0) continue;
                    const expr = formatIndexExpr(idx.cols);
                    const granularity = idx.granularity ?? 1;
                    const granularityClause = granularity ? ` GRANULARITY ${granularity}` : '';
                    colDefs.push(`INDEX \`${idx.name}\` ${expr} TYPE ${idx.type}${granularityClause}`);
                }
            }

            if (finalOptions.projections?.length) {
                for (const proj of finalOptions.projections) {
                    const query = proj.query.trim();
                    if (!query) continue;
                    colDefs.push(`PROJECTION \`${proj.name}\` (${query})`);
                }
            }

            const clusterClause = finalOptions.onCluster ? ` ON CLUSTER ${finalOptions.onCluster}` : '';

            // Use the typed engine SQL renderer or custom engine string
            let finalEngineSQL = finalOptions.customEngine || engineStr;
            if (finalOptions.versionColumn && !finalEngineSQL.includes('Replacing')) {
                finalEngineSQL = `ReplacingMergeTree(${finalOptions.versionColumn})`;
            }

            let sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\`${clusterClause} (${colDefs.join(', ')}) ENGINE = ${finalEngineSQL}`;

            if (finalOptions.orderBy) {
                const orderBy = Array.isArray(finalOptions.orderBy) ? finalOptions.orderBy.join(', ') : finalOptions.orderBy;
                sql += ` ORDER BY (${orderBy})`;
            } else if (isMergeTreeFamilyEngine) {
                // MergeTree family requires ORDER BY
                // Default to tuple() if no PK/Order provided (technically valid but rarely desired)
                // Or use Primary Key if available
                if (finalOptions.primaryKey) {
                    const pk = Array.isArray(finalOptions.primaryKey) ? finalOptions.primaryKey.join(', ') : finalOptions.primaryKey;
                    sql += ` ORDER BY (${pk})`;
                } else {
                    sql += ` ORDER BY tuple()`;
                }
            }

            if (finalOptions.primaryKey) {
                const pk = Array.isArray(finalOptions.primaryKey) ? finalOptions.primaryKey.join(', ') : finalOptions.primaryKey;
                sql += ` PRIMARY KEY (${pk})`;
            }

            if (finalOptions.partitionBy) {
                const partition = Array.isArray(finalOptions.partitionBy) ? finalOptions.partitionBy.join(', ') : finalOptions.partitionBy;
                sql += ` PARTITION BY (${partition})`;
            }

            if (finalOptions.sampleBy) {
                const sample = Array.isArray(finalOptions.sampleBy) ? finalOptions.sampleBy.join(', ') : finalOptions.sampleBy;
                sql += ` SAMPLE BY (${sample})`;
            }

            if (finalOptions.ttl) {
                let ttlClause = '';
                if (Array.isArray(finalOptions.ttl)) {
                    const ttlParts = finalOptions.ttl.map(ttl => {
                        let part = ttl.expression;
                        if (ttl.action === 'TO DISK' && ttl.target) {
                            part += ` TO DISK '${ttl.target}'`;
                        } else if (ttl.action === 'TO VOLUME' && ttl.target) {
                            part += ` TO VOLUME '${ttl.target}'`;
                        }
                        // For DELETE we omit the keyword; ClickHouse defaults to delete
                        return part;
                    });
                    ttlClause = `TTL ${ttlParts.join(', ')}`;
                } else if (typeof finalOptions.ttl === 'string') {
                    ttlClause = `TTL ${finalOptions.ttl}`;
                } else {
                    // Single TTLRule object
                    const ttl = finalOptions.ttl;
                    let part = ttl.expression;
                    if (ttl.action === 'TO DISK' && ttl.target) {
                        part += ` TO DISK '${ttl.target}'`;
                    } else if (ttl.action === 'TO VOLUME' && ttl.target) {
                        part += ` TO VOLUME '${ttl.target}'`;
                    }
                    // DELETE is implicit
                    ttlClause = `TTL ${part}`;
                }
                sql += ` ${ttlClause}`;
            }

            // Add metadata comment
            const meta = {
                housekit: buildHousekitMetadata(resolvedMetadataVersion, {
                    appendOnly: finalOptions.appendOnly,
                    readOnly: finalOptions.readOnly
                })
            };
            const comment = JSON.stringify(meta);
            sql += ` COMMENT '${comment.replace(/'/g, "\\'")}'`;

            return sql;
        },
        toSQLs: function () {
            const base = this.toSQL();
            if (finalOptions.materializedView) {
                const mv = finalOptions.materializedView;
                const populateClause = mv.populate ? ' POPULATE' : '';
                const mvSQL = `CREATE MATERIALIZED VIEW IF NOT EXISTS \`${mv.name}\`${populateClause} TO \`${mv.toTable}\` AS ${mv.query}`;
                return [base, mvSQL];
            }
            return [base];
        },
        as: (alias: string) => {
            return chTable(alias, columns, { ...finalOptions, externallyManaged: true }) as TableDefinition<T, TableOptions>;
        }
    };

    return assignColumnsToTable(tableDefBase, columns, tableName) as TableDefinition<T, TableOptions>;
}

// Overload 1: New preferred signature with query in options
export function chView<T extends Record<string, ClickHouseColumn<any, any, any>>>(
    name: string,
    columns: T,
    options: ViewOptions & { query: string }
): TableDefinition<T, ViewOptions & { kind: 'view'; query: string }> & { toSQLs: () => string[] };

// Overload 2: Legacy signature with query as third parameter (for backward compatibility)
export function chView<T extends Record<string, ClickHouseColumn<any, any, any>>>(
    name: string,
    columns: T,
    query: string,
    options?: ViewOptions
): TableDefinition<T, ViewOptions & { kind: 'view'; query: string }> & { toSQLs: () => string[] };

// Implementation
export function chView<T extends Record<string, ClickHouseColumn<any, any, any>>>(
    name: string,
    columns: T,
    queryOrOptions: string | (ViewOptions & { query: string }),
    optionsParam?: ViewOptions
): TableDefinition<T, ViewOptions & { kind: 'view'; query: string }> & { toSQLs: () => string[] } {
    attachTableName(name, columns);

    // Determine which signature was used
    let query: string;
    let options: ViewOptions;

    if (typeof queryOrOptions === 'string') {
        // Legacy signature: chView(name, columns, query, options)
        query = queryOrOptions;
        options = optionsParam || {};
    } else {
        // New signature: chView(name, columns, { query, ...options })
        query = queryOrOptions.query;
        const { query: _, ...restOptions } = queryOrOptions;
        options = restOptions;
    }

    const onClusterClause = options.onCluster ? ` ON CLUSTER ${options.onCluster}` : '';
    const replaceClause = options.orReplace ? ' OR REPLACE' : '';
    const ifNotExistsClause = options.orReplace ? '' : ' IF NOT EXISTS';

    const toSQL = () => `CREATE${replaceClause} VIEW${ifNotExistsClause} \`${name}\`${onClusterClause} AS ${query}`;
    const base: any = {
        $table: name,
        $columns: columns,
        $options: { ...options, kind: 'view', query },
        toSQL,
        toSQLs: () => [toSQL()]
    };

    return assignColumnsToTable(base, columns, name) as TableDefinition<T, ViewOptions & { kind: 'view'; query: string }> & { toSQLs: () => string[] };
}

/**
 * Define a reusable set of columns with type inference.
 */
export function defineColumns<T extends TableColumns>(cols: T): T {
    return cols;
}

/**
 * Compose column sets, throwing on duplicate keys to avoid accidental overrides.
 */
export function extendColumns<Base extends TableColumns, Extra extends TableColumns>(base: Base, extra: Extra): Base & Extra {
    for (const key of Object.keys(extra)) {
        if (key in base) {
            throw new Error(`Column "${key}" already exists in base definition`);
        }
    }
    return { ...(base as any), ...(extra as any) };
}

/**
 * Define a versioned table (e.g., base_v2) with optional view alias to point to the latest version.
 */
export function versionedTable<T extends TableColumns>(
    baseName: string,
    version: string | number,
    columns: T,
    options: TableOptions & { latestAlias?: boolean; aliasName?: string } = {}
): TableDefinition<T> & { $versionMeta: VersionedMeta; toSQLs: () => string[] } {
    const actualName = `${baseName}_v${version}`;
    const baseTable = chTable(actualName, columns, options);
    const aliasName = options.aliasName || baseName;
    const latestAlias = options.latestAlias ?? true;

    const viewSQL = latestAlias
        ? `CREATE VIEW IF NOT EXISTS \`${aliasName}\` AS SELECT * FROM \`${actualName}\``
        : null;

    return {
        ...baseTable,
        $versionMeta: { baseName, version, aliasName: latestAlias ? aliasName : undefined },
        toSQLs: () => viewSQL ? [baseTable.toSQL(), viewSQL] : [baseTable.toSQL()]
    };
}

/**
 * Define a derived (aggregated) table with a backing table and materialized view.
 */
export function deriveTable<T extends TableColumns>(
    source: TableDefinition<T>,
    config: {
        name: string;
        groupBy: string | string[];
        aggregates: Record<string, string>; // alias -> expression
        options?: TableOptions;
    }
): TableDefinition<any> & { toSQLs: () => string[] } {
    const groupList = Array.isArray(config.groupBy) ? config.groupBy : [config.groupBy];
    const groupCols = groupList.map(g => g.trim()).filter(Boolean);

    const targetColumns: Record<string, ClickHouseColumn> = {};

    for (const g of groupCols) {
        const col = (source.$columns as any)[g];
        targetColumns[g] = col ? col : new ClickHouseColumn<any>(g, 'String');
    }

    for (const [alias] of Object.entries(config.aggregates)) {
        targetColumns[alias] = new ClickHouseColumn<number>(alias, 'Float64');
    }

    const opts: TableOptions = {
        engine: Engine.AggregatingMergeTree(),
        orderBy: groupCols,
        partitionBy: config.options?.partitionBy,
        primaryKey: config.options?.primaryKey,
        ttl: config.options?.ttl,
        onCluster: config.options?.onCluster,
        shardKey: config.options?.shardKey,
        logicalPrimaryKey: config.options?.logicalPrimaryKey,
        appendOnly: config.options?.appendOnly ?? true
    };

    const derived = chTable(config.name, targetColumns as any, opts);

    const groupBySQL = groupCols.join(', ');
    const aggSQL = Object.entries(config.aggregates)
        .map(([alias, expr]) => `${expr} AS \`${alias}\``)
        .join(', ');
    const selectParts = [];
    if (groupCols.length > 0) selectParts.push(groupBySQL);
    if (aggSQL) selectParts.push(aggSQL);
    const selectSQL = selectParts.join(', ');

    const mvSQL = `CREATE MATERIALIZED VIEW IF NOT EXISTS \`${config.name}_mv\` TO \`${config.name}\` AS SELECT ${selectSQL} FROM \`${source.$table}\` GROUP BY ${groupBySQL}`;

    return {
        ...derived,
        toSQLs: () => [derived.toSQL(), mvSQL]
    };
}

/**
 * Render CREATE statements for preview.
 */
export function renderSchema(def: TableDefinition<any>) {
    if (typeof (def as any).toSQLs === 'function') {
        return (def as any).toSQLs().join('\n\n');
    }
    return def.toSQL();
}

/**
 * Generate a TypeScript type from a table definition (best effort mapping).
 */
export function generateTypes<T extends TableColumns>(def: TableDefinition<T>, typeName?: string) {
    const name = typeName || pascalCase(def.$table);
    const lines = Object.entries(def.$columns).map(([key, col]) => {
        const tsType = clickHouseToTS(col.type);
        const optional = col.isNull ? '?' : '';  // If isNull is true, field is optional
        return `  ${key}${optional}: ${tsType};`;
    });
    return `export interface ${name} {\n${lines.join('\n')}\n}`;
}

function clickHouseToTS(type: string): string {
    const normalized = type.replace(/\s+/g, '').toLowerCase();

    const arrayMatch = normalized.match(/^array\((.+)\)$/);
    if (arrayMatch) {
        return `${clickHouseToTS(arrayMatch[1])}[]`;
    }

    if (normalized.startsWith('map(')) return 'Record<string, any>';
    if (normalized.includes('uuid')) return 'string';

    if (normalized.startsWith('decimal')) {
        // Represent as string to avoid precision loss
        return 'string';
    }
    if (normalized.startsWith('int') || normalized.startsWith('uint') || normalized.startsWith('float')) return 'number';
    if (normalized.startsWith('bool')) return 'boolean';
    if (normalized.startsWith('date') || normalized.startsWith('datetime')) return 'string';
    if (normalized.startsWith('enum')) return 'string';
    if (normalized.startsWith('aggregatefunction')) return 'any';
    if (normalized.startsWith('lowcardinality(')) {
        const inner = normalized.slice('lowcardinality('.length, -1);
        return clickHouseToTS(inner);
    }
    return 'string';
}

function pascalCase(name: string) {
    return name.replace(/(^|_|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}
