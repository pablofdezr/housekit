import { ClickHouseColumn, type TableDefinition } from '../core';
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
export declare function buildInsertPlan(table: TableDefinition<any>): InsertPlan;
export declare function processRowWithPlan(row: Record<string, any>, plan: InsertPlan, mode?: 'compact' | 'json'): Record<string, any> | any[];
export declare function processRowsStream(rows: AsyncIterable<Record<string, any>> | Iterable<Record<string, any>>, plan: InsertPlan, mode?: 'compact' | 'json'): AsyncGenerator<any[] | Record<string, any>, void, unknown>;
export {};
