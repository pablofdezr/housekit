import { ClickHouseColumn, type TableDefinition } from '../core';
import { v1, v3, v4, v5, v6, v7 } from 'uuid';

type UUIDVersion = 1 | 3 | 4 | 5 | 6 | 7;

type PreparedInsertColumn = {
    propKey: string;
    column: ClickHouseColumn;
    columnName: string;
    hasDefault: boolean;
    defaultValue: any;
    defaultFn: ((row: Record<string, any>) => any) | null;
    autoUUIDVersion: UUIDVersion | null;
    useServerUUID: boolean;
    transform: (value: any) => any;
};

export type InsertPlan = {
    columns: PreparedInsertColumn[];
    keyToColumn: Map<string, PreparedInsertColumn>;
    columnNames: string[];
    useCompact: boolean;
};

export function buildInsertPlan(table: TableDefinition<any>): InsertPlan {
    const columns: PreparedInsertColumn[] = [];
    const keyToColumn = new Map<string, PreparedInsertColumn>();

    for (const [propKey, colRaw] of Object.entries(table.$columns)) {
        const column = colRaw as ClickHouseColumn;
        const columnName = column.name;
        const transform = createTransform(column);
        const autoUUIDVersion = column.meta?.autoGenerate?.type === 'uuid'
            ? normalizeUUIDVersion(column.meta.autoGenerate.version)
            : null;
        const prepared: PreparedInsertColumn = {
            propKey,
            column,
            columnName,
            hasDefault: column.meta?.default !== undefined,
            defaultValue: column.meta?.default,
            defaultFn: column.meta?.defaultFn || null,
            autoUUIDVersion,
            useServerUUID: Boolean(autoUUIDVersion && column.meta?.defaultExpr && /generateuuid/i.test(column.meta.defaultExpr)),
            transform,
        };

        columns.push(prepared);
        keyToColumn.set(propKey, prepared);
        keyToColumn.set(columnName, prepared);
    }

    const columnNames = columns.map(c => c.columnName);
    const useCompact = columns.every(c => !c.useServerUUID);

    return { columns, keyToColumn, columnNames, useCompact };
}

export function processRowWithPlan(
    row: Record<string, any>,
    plan: InsertPlan,
    mode: 'compact' | 'json' = plan.useCompact ? 'compact' : 'json'
): Record<string, any> | any[] {
    if (mode === 'compact') {
        return processRowCompact(row, plan);
    }
    return processRowJson(row, plan);
}

function processRowJson(row: Record<string, any>, plan: InsertPlan): Record<string, any> {
    const newRow: Record<string, any> = {};

    for (const col of plan.columns) {
        // Check if user provided a value (by propKey or columnName)
        let value = row[col.propKey] !== undefined ? row[col.propKey] : row[col.columnName];

        if (value === undefined) {
            // No value provided - try to compute or generate one
            if (col.defaultFn) {
                // Execute defaultFn with the original row context
                value = col.defaultFn(row);
            } else if (col.autoUUIDVersion !== null) {
                if (!col.useServerUUID) {
                    value = generateUUID(col.autoUUIDVersion);
                }
            } else if (col.hasDefault) {
                value = col.defaultValue;
            }
        }

        if (value !== undefined) {
            newRow[col.columnName] = col.transform(value);
        }
    }

    return newRow;
}

export async function* processRowsStream(
    rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>,
    plan: InsertPlan,
    mode: 'compact' | 'json' = plan.useCompact ? 'compact' : 'json'
) {
    for await (const row of rows as any) {
        yield processRowWithPlan(row as any, plan, mode);
    }
}

function createTransform(col: ClickHouseColumn) {
    const hasJson = Boolean(col.meta?.isJson);
    const enumValues = col.meta?.enumValues;
    const enumSet = enumValues ? new Set(enumValues) : null;
    const needsJson = hasJson;
    const needsEnum = Boolean(enumSet);

    if (!needsJson && !needsEnum) {
        return (value: any) => {
            if (value instanceof Date) {
                return formatDate(value);
            }
            return value;
        };
    }

    return (value: any) => {
        let result = value;
        if (result instanceof Date) {
            result = formatDate(result);
        }

        if (needsJson && typeof result === 'object' && result !== null) {
            result = JSON.stringify(result);
        }

        if (enumSet && !enumSet.has(result)) {
            throw new Error(`❌ Invalid value '${result}' for enum column '${col.name}'. Allowed: ${enumValues!.join(', ')}`);
        }

        return result;
    };
}

function formatDate(date: Date) {
    const iso = date.toISOString();
    const [datePart, timePart] = iso.split('T');
    const [time] = timePart.split('.'); // strip milliseconds and Z
    return `${datePart} ${time}`;
}

function normalizeUUIDVersion(version: any): UUIDVersion {
    if (version === 1 || version === 3 || version === 4 || version === 5 || version === 6 || version === 7) {
        return version;
    }
    return 4;
}

function generateUUID(version: UUIDVersion): string {
    switch (version) {
        case 1:
            return v1();
        case 3:
            throw new Error('UUID v3 requires a name and namespace. Use v4, v6, or v7 for auto-generation.');
        case 4:
            return v4();
        case 5:
            throw new Error('UUID v5 requires a name and namespace. Use v4, v6, or v7 for auto-generation.');
        case 6:
            return v6();
        case 7:
            return v7();
        default:
            return v4();
    }
}

function processRowCompact(row: Record<string, any>, plan: InsertPlan) {
    const out: any[] = new Array(plan.columns.length);

    for (let i = 0; i < plan.columns.length; i++) {
        const col = plan.columns[i];
        const provided = row[col.propKey];
        const providedByName = row[col.columnName];
        const hasValue = provided !== undefined || providedByName !== undefined;

        if (hasValue) {
            const value = col.transform(provided !== undefined ? provided : providedByName);
            out[i] = value;
            continue;
        }

        // No value provided - try defaultFn first
        if (col.defaultFn) {
            const computed = col.defaultFn(row);
            out[i] = col.transform(computed);
            continue;
        }

        if (col.autoUUIDVersion !== null) {
            out[i] = col.useServerUUID ? undefined : generateUUID(col.autoUUIDVersion);
            continue;
        }

        if (col.hasDefault) {
            out[i] = col.defaultValue;
            continue;
        }

        if (col.useServerUUID) {
            throw new Error(`❌ Cannot use JSONCompactEachRow: column '${col.columnName}' relies on server-side default`);
        }

        throw new Error(`❌ Missing value for column '${col.columnName}'`);
    }

    return out;
}
