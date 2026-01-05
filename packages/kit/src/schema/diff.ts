import { ClickHouseColumn, normalizeHousekitMetadata, upgradeMetadataVersion, renderEngineSQL, type IndexDefinition, type ProjectionDefinition } from '@housekit/orm';
import { quoteName } from '../ui';
import type { ParsedCreateOptions, ParsedIndex, ParsedProjection } from './parser';

export type RemoteTableDescription = {
    columns: Record<string, string>;
    defaults: Record<string, string>;
    options: ParsedCreateOptions;
    comment: string | null;
};

function columnType(col: ClickHouseColumn) {
    return col.toSQL();
}

function formatIndexExpression(cols: ClickHouseColumn[]) {
    if (!cols || cols.length === 0) return '';
    const parts = cols.map(c => `\`${c.name}\``);
    return cols.length > 1 ? `tuple(${parts.join(', ')})` : parts[0];
}

function canonicalIndexExpression(expr: string) {
    return (expr || '').replace(/`/g, '').replace(/\s+/g, '').toLowerCase();
}

function canonicalProjectionQuery(query: string) {
    return (query || '').replace(/\s+/g, '').toLowerCase();
}

function canonicalizeType(type: string) {
    let result = '';
    let inSingleQuote = false;
    for (let i = 0; i < type.length; i++) {
        const char = type[i];
        if (char === "'" && (i === 0 || type[i - 1] !== '\\')) {
            inSingleQuote = !inSingleQuote;
        }
        if (inSingleQuote || !/\s/.test(char)) {
            result += char;
        }
    }
    return result.toLowerCase();
}

function normalizeType(type: string): string {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let commentIndex = -1;

    for (let i = 0; i < type.length; i++) {
        const char = type[i];
        const prevChar = i > 0 ? type[i - 1] : '';

        if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        } else if (!inSingleQuote && !inDoubleQuote) {
            const remaining = type.substring(i);
            if (remaining.match(/^\s+COMMENT\s+/i)) {
                commentIndex = i;
                break;
            }
        }
    }

    if (commentIndex >= 0) {
        type = type.substring(0, commentIndex);
    }

    type = type.replace(/\s+DEFAULT\s+.*$/i, '');
    type = type.replace(/\s+MATERIALIZED\s+.*$/i, '');
    type = type.replace(/\s+ALIAS\s+.*$/i, '');
    type = type.replace(/\s+CODEC\s*\([^)]*\).*$/i, '');
    return type.trim();
}

function extractLocalDefault(col: ClickHouseColumn): string | null {
    if (col.meta?.defaultExpr) {
        return col.meta.defaultExpr;
    }
    if (col.meta?.default !== undefined) {
        const defaultValue = col.meta.default;
        if (typeof defaultValue === 'string') {
            return `'${defaultValue.replace(/'/g, "''")}'`;
        } else if (typeof defaultValue === 'number') {
            return String(defaultValue);
        } else if (typeof defaultValue === 'boolean') {
            return defaultValue ? '1' : '0';
        } else if (defaultValue === null) {
            return 'NULL';
        } else {
            return `'${String(defaultValue).replace(/'/g, "''")}'`;
        }
    }
    return null;
}

function normalizeDefault(defaultValue: string | null): string | null {
    if (!defaultValue) return null;
    let normalized = defaultValue.trim().replace(/\s+/g, ' ');

    if (normalized.includes('(') && normalized.includes(')')) {
        return normalized;
    }

    const singleQuoted = normalized.match(/^'([^']*)'$/);
    const doubleQuoted = normalized.match(/^"([^"]*)"$/);

    if (singleQuoted) {
        normalized = singleQuoted[1];
    } else if (doubleQuoted) {
        normalized = doubleQuoted[1];
    }

    return normalized;
}

function extractComment(type: string): string | null {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let commentIndex = -1;

    for (let i = 0; i < type.length; i++) {
        const char = type[i];
        const prevChar = i > 0 ? type[i - 1] : '';

        if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        } else if (!inSingleQuote && !inDoubleQuote) {
            const remaining = type.substring(i);
            if (remaining.match(/^\s+COMMENT\s+/i)) {
                commentIndex = i;
                break;
            }
        }
    }

    if (commentIndex < 0) {
        return null;
    }

    const afterComment = type.substring(commentIndex);
    const commentMatch = afterComment.match(/COMMENT\s+(['"])(.*?)\1/i);
    if (commentMatch) {
        return commentMatch[2];
    }

    const unquotedMatch = afterComment.match(/COMMENT\s+([^\s,)]+)/i);
    if (unquotedMatch) {
        return unquotedMatch[1];
    }

    return null;
}

function cleanCommentString(comment: string | null): string | null {
    if (!comment) return null;
    let cleaned = comment.trim();
    if (cleaned.includes('\\"')) {
        cleaned = cleaned.replace(/\\"/g, '"');
    }
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned;
}

function normalizeComment(comment: string | null): string | null {
    const cleaned = cleanCommentString(comment);
    if (!cleaned) return null;
    return cleaned.trim().replace(/\s+/g, ' ');
}

function normalizeClause(val: any): string | undefined {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'string') return val.replace(/\s+/g, ' ').trim();
    if (typeof val === 'object' && 'expression' in val) return (val as any).expression;
    return String(val);
}

function normalizeTtlExpr(val?: string) {
    if (!val) return undefined;
    return val
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/tointervalday\((\d+)\)/g, 'interval$1day');
}

function canonicalName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function areNamesEquivalent(name1: string, name2: string): boolean {
    return canonicalName(name1) === canonicalName(name2);
}

function extractHousekitMetadata(comment: string | null) {
    if (!comment) return null;
    const cleaned = cleanCommentString(comment);
    if (!cleaned) return null;
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.housekit) return parsed.housekit;
    } catch {
        return null;
    }
    return null;
}

function mapColumnRefs(val: any, localCols: Record<string, ClickHouseColumn>): any {
    if (!val) return val;
    if (Array.isArray(val)) {
        return val.map(v => localCols[v]?.name || v);
    }
    if (typeof val === 'string') {
        const parts = val.split(',').map(p => p.trim());
        const mapped = parts.map(p => localCols[p]?.name || p);
        return mapped.length === 1 ? mapped[0] : mapped;
    }
    return val;
}

export function diffTable(
    table: any,
    localCols: Record<string, ClickHouseColumn>,
    remote: RemoteTableDescription,
    opts?: { autoUpgradeMetadata?: boolean }
) {
    const plan: string[] = [];
    const destructiveReasons: string[] = [];
    const drops: string[] = [];
    const warnings: string[] = [];
    const optionChanges: string[] = [];
    const adds: string[] = [];
    const modifies: string[] = [];
    const tableName = table.$table;
    let shadowPlan: string[] | null = null;

    const localByName: Record<string, ClickHouseColumn> = {};
    Object.values(localCols).forEach(col => { localByName[col.name] = col; });

    const remoteByCanon = new Map<string, { name: string; type: string }[]>();
    Object.entries(remote.columns).forEach(([name, type]) => {
        const canon = canonicalName(name);
        const arr = remoteByCanon.get(canon) || [];
        arr.push({ name, type });
        remoteByCanon.set(canon, arr);
    });

    const matchedRemotes = new Set<string>();
    const matchedCanon = new Set<string>();

    for (const col of Object.values(localByName)) {
        const name = col.name;
        const localTypeFull = columnType(col);
        const localTypeBase = normalizeType(localTypeFull);
        const localDefault = normalizeDefault(extractLocalDefault(col));
        const localComment = normalizeComment(extractComment(localTypeFull));

        const exactType = remote.columns[name];
        if (exactType) {
            matchedRemotes.add(name);
            matchedCanon.add(canonicalName(name));
            const remoteTypeBase = normalizeType(exactType);
            const remoteDefault = normalizeDefault(remote.defaults[name.toLowerCase()] || null);
            const remoteComment = normalizeComment(extractComment(exactType));

            if (canonicalizeType(remoteTypeBase) !== canonicalizeType(localTypeBase)) {
                destructiveReasons.push(`type change ${name}: ${exactType} -> ${localTypeFull}`);
                plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
                modifies.push(name);
            } else if (localDefault !== remoteDefault) {
                const defaultChangeDesc = remoteDefault
                    ? `default change ${name}: ${remoteDefault} -> ${localDefault || 'none'}`
                    : `default added ${name}: ${localDefault}`;
                destructiveReasons.push(defaultChangeDesc);
                plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
                modifies.push(name);
            } else if (localComment !== remoteComment) {
                const commentChangeDesc = remoteComment
                    ? `comment change ${name}: "${remoteComment}" -> "${localComment || ''}"`
                    : `comment added ${name}: "${localComment}"`;
                plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
                modifies.push(name);
            }
            continue;
        }

        const canon = canonicalName(name);
        const candidates = remoteByCanon.get(canon);
        const remoteEntry = candidates?.[0];
        if (!remoteEntry) {
            plan.push(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${name}\` ${localTypeFull}`);
            adds.push(name);
            continue;
        }
        matchedRemotes.add(remoteEntry.name);
        matchedCanon.add(canon);
        const remoteTypeBase = normalizeType(remoteEntry.type);
        const remoteDefault = normalizeDefault(remote.defaults[remoteEntry.name.toLowerCase()] || null);
        const remoteComment = normalizeComment(extractComment(remoteEntry.type));

        if (canonicalizeType(remoteTypeBase) !== canonicalizeType(localTypeBase)) {
            destructiveReasons.push(`type change ${remoteEntry.name}: ${remoteEntry.type} -> ${localTypeFull}`);
            plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
            modifies.push(name);
        } else if (localDefault !== remoteDefault) {
            const defaultChangeDesc = remoteDefault
                ? `default change ${name}: ${remoteDefault} -> ${localDefault || 'none'}`
                : `default added ${name}: ${localDefault}`;
            destructiveReasons.push(defaultChangeDesc);
            plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
            modifies.push(name);
        } else if (localComment !== remoteComment) {
            const commentChangeDesc = remoteComment
                ? `comment change ${name}: "${remoteComment}" -> "${localComment || ''}"`
                : `comment added ${name}: "${localComment}"`;
            plan.push(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${localTypeFull}`);
            modifies.push(name);
        } else if (remoteEntry.name !== name && !areNamesEquivalent(remoteEntry.name, name)) {
            warnings.push(`column name change detected: "${remoteEntry.name}" -> "${name}" (requires shadow swap)`);
            destructiveReasons.push(`column rename ${remoteEntry.name} -> ${name}`);
        }
    }

    for (const [remoteName] of Object.entries(remote.columns)) {
        const canon = canonicalName(remoteName);
        if (matchedRemotes.has(remoteName) || matchedCanon.has(canon)) continue;
        destructiveReasons.push(`column drop ${remoteName}`);
        drops.push(remoteName);
    }

    const remoteOpts = remote.options || {};
    const localOpts = table.$options || {};

    const compare = (label: string, local: any, remoteValue: any, action?: () => void) => {
        if (!local && !remoteValue) return;
        const l = label === 'ttl' ? normalizeTtlExpr(normalizeClause(local)) : normalizeClause(local);
        const r = label === 'ttl' ? normalizeTtlExpr(normalizeClause(remoteValue)) : normalizeClause(remoteValue);
        if ((l || 'unset') !== (r || 'unset')) {
            optionChanges.push(label);
            if (action) action();
            warnings.push(`${label} differs (remote="${r || 'unset'}", local="${l || 'unset'}")`);
        }
    };

    let localEngineSQL = 'MergeTree';
    if (localOpts.customEngine) {
        localEngineSQL = localOpts.customEngine;
    } else if (localOpts.engine) {
        localEngineSQL = renderEngineSQL(localOpts.engine);
    }

    const normalizeEngine = (engine: string) => engine.replace(/\s+/g, '').replace(/\(\)/g, '').toLowerCase();
    const localEngineNorm = normalizeEngine(localEngineSQL);
    const remoteEngineNorm = normalizeEngine(remoteOpts.engine || 'MergeTree');

    if (localEngineNorm !== remoteEngineNorm) {
        optionChanges.push('engine');
        destructiveReasons.push(`engine change (local="${localEngineSQL}", remote="${remoteOpts.engine}") (requires shadow swap)`);
        warnings.push('Engine mismatch requires full table recreation');
    }

    const mappedOrderBy = mapColumnRefs(localOpts.orderBy, localCols);
    compare('orderBy', mappedOrderBy, remoteOpts.orderBy, () => {
        destructiveReasons.push('order by change');
        plan.push(`ALTER TABLE \`${tableName}\` MODIFY ORDER BY (${normalizeClause(mappedOrderBy)})`);
    });

    const mappedPartitionBy = mapColumnRefs(localOpts.partitionBy, localCols);
    compare('partitionBy', mappedPartitionBy, remoteOpts.partitionBy, () => {
        destructiveReasons.push('partition change');
        plan.push(`ALTER TABLE \`${tableName}\` MODIFY PARTITION BY (${normalizeClause(mappedPartitionBy)})`);
    });

    compare('ttl', localOpts.ttl, remoteOpts.ttl, () => {
        destructiveReasons.push('ttl change');
        plan.push(`ALTER TABLE \`${tableName}\` MODIFY TTL ${normalizeClause(localOpts.ttl)}`);
    });

    const mappedPrimaryKey = mapColumnRefs(localOpts.primaryKey, localCols);
    compare('primaryKey', mappedPrimaryKey, remoteOpts.primaryKey, () => {
        destructiveReasons.push('primary key change');
        plan.push(`ALTER TABLE \`${tableName}\` MODIFY PRIMARY KEY (${normalizeClause(mappedPrimaryKey)})`);
    });

    const localIndexDefs = (localOpts.indices as IndexDefinition[] | undefined) ?? [];
    const remoteIndexDefs = (remoteOpts.indices as ParsedIndex[] | undefined) ?? [];

    const normalizedLocalIndices = localIndexDefs.map(idx => ({
        name: idx.name,
        nameCanon: canonicalName(idx.name),
        exprSql: formatIndexExpression(idx.cols),
        exprCanon: canonicalIndexExpression(formatIndexExpression(idx.cols)),
        type: idx.type.toLowerCase(),
        granularity: idx.granularity ?? 1
    }));

    const normalizedRemoteIndices = remoteIndexDefs.map(idx => ({
        original: idx,
        nameCanon: canonicalName(idx.name),
        exprCanon: canonicalIndexExpression(idx.expression),
        type: (idx.type || '').toLowerCase(),
        granularity: idx.granularity ?? 1
    }));

    const addIndexSql = (idx: typeof normalizedLocalIndices[number]) =>
        `ALTER TABLE \`${tableName}\` ADD INDEX \`${idx.name}\` ${idx.exprSql} TYPE ${idx.type}${idx.granularity ? ` GRANULARITY ${idx.granularity}` : ''}`;

    normalizedLocalIndices
        .filter(idx => idx.exprSql)
        .forEach(idx => {
            const remoteMatch = normalizedRemoteIndices.find(r => r.nameCanon === idx.nameCanon);
            if (!remoteMatch) {
                optionChanges.push(`index ${idx.name}`);
                plan.push(addIndexSql(idx));
                return;
            }

            if (remoteMatch.exprCanon !== idx.exprCanon || remoteMatch.type !== idx.type || remoteMatch.granularity !== idx.granularity) {
                optionChanges.push(`index ${idx.name}`);
                plan.push(`ALTER TABLE \`${tableName}\` DROP INDEX \`${remoteMatch.original.name}\``);
                plan.push(addIndexSql(idx));
            }
        });

    normalizedRemoteIndices.forEach(idx => {
        const hasLocal = normalizedLocalIndices.some(l => l.nameCanon === idx.nameCanon);
        if (!hasLocal) {
            warnings.push(`index ${quoteName(idx.original.name)} exists remotely but not locally`);
        }
    });

    const localProjectionDefs = (localOpts.projections as ProjectionDefinition[] | undefined) ?? [];
    const remoteProjectionDefs = (remoteOpts.projections as ParsedProjection[] | undefined) ?? [];

    const normalizedLocalProjections = localProjectionDefs
        .map(p => ({
            name: p.name,
            nameCanon: canonicalName(p.name),
            query: p.query.trim(),
            queryCanon: canonicalProjectionQuery(p.query)
        }))
        .filter(p => !!p.query);
    const normalizedRemoteProjections = remoteProjectionDefs.map(p => ({
        original: p,
        nameCanon: canonicalName(p.name),
        queryCanon: canonicalProjectionQuery(p.query)
    }));

    const addProjectionSql = (proj: typeof normalizedLocalProjections[number]) =>
        `ALTER TABLE \`${tableName}\` ADD PROJECTION \`${proj.name}\` (${proj.query})`;

    normalizedLocalProjections.forEach(proj => {
        const remoteMatch = normalizedRemoteProjections.find(r => r.nameCanon === proj.nameCanon);
        if (!remoteMatch) {
            optionChanges.push(`projection ${proj.name}`);
            plan.push(addProjectionSql(proj));
            return;
        }

        if (remoteMatch.queryCanon !== proj.queryCanon) {
            optionChanges.push(`projection ${proj.name}`);
            plan.push(`ALTER TABLE \`${tableName}\` DROP PROJECTION \`${remoteMatch.original.name}\``);
            plan.push(addProjectionSql(proj));
        }
    });

    normalizedRemoteProjections.forEach(proj => {
        const hasLocal = normalizedLocalProjections.some(p => p.nameCanon === proj.nameCanon);
        if (!hasLocal) {
            warnings.push(`projection ${quoteName(proj.original.name)} exists remotely but not locally`);
        }
    });

    const localMetadataVersion = String((table.$options?.metadataVersion ?? '1.2.0'));
    const localAppendOnly = localOpts.appendOnly ?? true;
    const localReadOnly = table.$options?.readOnly ?? false;
    const appendOnlyOverride = (table.$options && Object.prototype.hasOwnProperty.call(table.$options, 'appendOnly')) ? localAppendOnly : undefined;
    const readOnlyOverride = (table.$options && Object.prototype.hasOwnProperty.call(table.$options, 'readOnly')) ? localReadOnly : undefined;
    const remoteComment = remote.comment;
    const remoteMetaRaw = extractHousekitMetadata(remoteComment);
    const normalizedRemote = normalizeHousekitMetadata(remoteMetaRaw);
    const targetMeta = upgradeMetadataVersion(
        normalizedRemote?.meta ?? null,
        localMetadataVersion as any,
        { appendOnly: appendOnlyOverride, readOnly: readOnlyOverride }
    );
    const localMeta = { housekit: targetMeta };
    const localComment = JSON.stringify(localMeta);

    if (normalizedRemote) {
        if (normalizedRemote.meta.appendOnly !== targetMeta.appendOnly) {
            warnings.push(`appendOnly mismatch: DB=${normalizedRemote.meta.appendOnly}, code=${targetMeta.appendOnly}`);
        }
        if ('readOnly' in targetMeta) {
            const remoteReadOnly = 'readOnly' in normalizedRemote.meta ? normalizedRemote.meta.readOnly : false;
            if (remoteReadOnly !== targetMeta.readOnly) {
                warnings.push(`readOnly mismatch: DB=${remoteReadOnly}, code=${targetMeta.readOnly}`);
            }
        }
    }

    const remoteVersion = normalizedRemote?.version ?? null;
    const versionsMatch = !!remoteVersion && remoteVersion === localMetadataVersion;
    const remoteMetaMatches =
        versionsMatch &&
        normalizedRemote &&
        normalizedRemote.meta.appendOnly === targetMeta.appendOnly &&
        ('readOnly' in targetMeta ? ('readOnly' in normalizedRemote.meta ? normalizedRemote.meta.readOnly === targetMeta.readOnly : false) : !('readOnly' in normalizedRemote.meta));

    const remoteCommentForComparison = remoteMetaMatches ? localComment : remoteComment;

    const remoteVersionStr = remoteVersion ?? 'unset';
    const baseReason = normalizedRemote
        ? `version=${remoteVersionStr}, appendOnly=${normalizedRemote.meta.appendOnly ?? 'unset'}${'readOnly' in normalizedRemote.meta ? `, readOnly=${normalizedRemote.meta.readOnly}` : ''}`
        : `missing/invalid metadata`;

    if (!versionsMatch && normalizedRemote) {
        optionChanges.push(`metadata version mismatch: remote=${remoteVersionStr}, local=${localMetadataVersion} (${baseReason})`);
        if (opts?.autoUpgradeMetadata) {
            plan.push(`ALTER TABLE \`${tableName}\` MODIFY COMMENT '${localComment.replace(/'/g, "\\'")}'`);
            optionChanges.push(`metadata/comment (auto-upgrade to version=${localMetadataVersion}, appendOnly=${targetMeta.appendOnly}${'readOnly' in targetMeta ? `, readOnly=${targetMeta.readOnly}` : ''})`);
        }
    }

    if (!normalizedRemote) {
        optionChanges.push(`metadata/comment (remote missing housekit metadata; local expects version=${localMetadataVersion})`);
    }

    if (normalizeComment(remoteCommentForComparison) !== normalizeComment(localComment)) {
        if (versionsMatch || !normalizedRemote || opts?.autoUpgradeMetadata) {
            plan.push(`ALTER TABLE \`${tableName}\` MODIFY COMMENT '${localComment.replace(/'/g, "\\'")}'`);
        }
        const commentReason = normalizedRemote
            ? `metadata/comment (remote housekit metadata drift: ${baseReason}; local wants version=${localMetadataVersion}, appendOnly=${targetMeta.appendOnly}${'readOnly' in targetMeta ? `, readOnly=${targetMeta.readOnly}` : ''})`
            : `metadata/comment (remote missing housekit metadata; local will set version=${localMetadataVersion}, appendOnly=${targetMeta.appendOnly}${'readOnly' in targetMeta ? `, readOnly=${targetMeta.readOnly}` : ''})`;
        optionChanges.push(commentReason);
    }

    if (localOpts.onCluster && localOpts.onCluster !== remoteOpts.onCluster) {
        destructiveReasons.push(`cluster mismatch (local=${localOpts.onCluster}, remote=${remoteOpts.onCluster || 'unset'})`);
        warnings.push('Cluster change requires shadow swap');
    }

    const remoteColNames = Object.keys(remote.columns);
    const localColNames = Object.values(localByName).map(c => c.name);

    // Check if the only changes are additions AT THE END.
    // If we have modifies, drops, or option changes, it's a structural change.
    // If we have adds, we check if they are all at the end.
    let isOnlyAdditionsAtEnd = true;
    if (modifies.length > 0 || drops.length > 0 || optionChanges.length > 0 || destructiveReasons.some(r => !r.includes('added'))) {
        isOnlyAdditionsAtEnd = false;
    } else if (adds.length > 0) {
        // First N columns of local should match all remote columns in order
        for (let i = 0; i < remoteColNames.length; i++) {
            if (localColNames[i] !== remoteColNames[i]) {
                isOnlyAdditionsAtEnd = false;
                destructiveReasons.push('column reordering or insertion detected (requires shadow swap)');
                break;
            }
        }
    }

    const hasStructuralChanges = !isOnlyAdditionsAtEnd || warnings.some(w => w.includes('shadow swap'));

    if (hasStructuralChanges) {
        const shadowName = `${tableName}__shadow_${Date.now()}`;
        const baseSQLs: string[] = typeof table.toSQLs === 'function' ? table.toSQLs() : [table.toSQL()];
        const createSQL = baseSQLs[0].replace(new RegExp('`' + tableName + '`'), '`' + shadowName + '`');

        const incompatibleColumns = new Set<string>();
        for (const reason of destructiveReasons) {
            const typeChangeMatch = reason.match(/type change (\w+):/);
            if (typeChangeMatch) {
                const colName = typeChangeMatch[1];
                const remoteType = normalizeType(remote.columns[colName] || '');
                const localCol = localByName[colName];
                if (localCol) {
                    const localType = normalizeType(columnType(localCol));
                    const remoteIsArray = remoteType.startsWith('Array(');
                    const localIsArray = localType.startsWith('Array(');
                    const remoteIsMap = remoteType.startsWith('Map(');
                    const localIsMap = localType.startsWith('Map(');

                    if (remoteIsArray !== localIsArray || remoteIsMap !== localIsMap) {
                        incompatibleColumns.add(colName);
                    }
                }
            }
        }

        const commonCols = Object.keys(remote.columns)
            .filter(c => localByName[c] && !incompatibleColumns.has(c))
            .join(', ');
        const insertSQL = commonCols.length > 0
            ? `INSERT INTO \`${shadowName}\` (${commonCols}) SELECT ${commonCols} FROM \`${tableName}\``
            : null;

        const backupName = `${tableName}__backup_${Date.now()}`;
        const renameSQL = `RENAME TABLE \`${tableName}\` TO \`${backupName}\`, \`${shadowName}\` TO \`${tableName}\``;

        shadowPlan = [createSQL];
        if (insertSQL) shadowPlan.push(insertSQL);
        shadowPlan.push(renameSQL);
    }

    return { plan, destructiveReasons, drops, warnings, shadowPlan, adds, modifies, optionChanges };
}
