import type { ClickHouseColumn, TableDefinition, TableRow } from '../core';
import type { SQLExpression } from '../expressions';

export type SelectionShape = Record<string, ClickHouseColumn | SQLExpression>;

type AliasKey<TValue, TFallback extends PropertyKey> = TValue extends { _alias: infer TAlias extends string } ? TAlias : TFallback;

export type SelectResult<TSelection extends SelectionShape> = {
    [K in keyof TSelection as AliasKey<TSelection[K], K & string>]:
    TSelection[K] extends ClickHouseColumn<infer V, infer NotNull, any>
    ? NotNull extends true
    ? V
    : V | null
    : TSelection[K] extends SQLExpression<infer TExpr>
    ? TExpr
    : never;
};

export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

export type InferQueryResult<TTable, TSelection> =
    [TSelection] extends [null] | [undefined]
    ? TTable extends { $columns: infer TCols extends Record<string, any> } ? TableRow<TCols> : any
    : TSelection extends SelectionShape
    ? Prettify<SelectResult<TSelection>>
    : TTable extends { $columns: infer TCols extends Record<string, any> } ? TableRow<TCols> : any;

export type NextResultForSelection<TTable, TSelection, TResult, TNextSelection> =
    [TResult] extends [InferQueryResult<TTable, TSelection>]
    ? InferQueryResult<TTable, TNextSelection>
    : TResult;

export type NextResultForTable<TTable, TSelection, TResult, TNextTable> =
    [TResult] extends [InferQueryResult<TTable, TSelection>]
    ? InferQueryResult<TNextTable, TSelection>
    : TResult;

export type QueryBuilderState<TCte = any> = {
    select: SelectionShape | null;
    table: TableDefinition<any> | null;
    prewhere: SQLExpression | null;
    sample: { ratio: number; offset?: number } | null;
    settings: Record<string, string | number | boolean> | null;
    distinct: boolean;
    // Support all ClickHouse join types including GLOBAL, ANY, ALL, ASOF, SEMI, ANTI
    joins: Array<{ type: string; table: string; on: SQLExpression | null }>;
    arrayJoins: Array<{ column: ClickHouseColumn | SQLExpression; alias?: string }>;
    ctes: Array<{ name: string; query: TCte }>;
    where: SQLExpression | null;
    limit: number | null;
    offset: number | null;
    orderBy: { col: ClickHouseColumn | SQLExpression; dir: 'ASC' | 'DESC' }[];
    groupBy: (ClickHouseColumn | SQLExpression)[];
    having: SQLExpression | null;
    final: boolean;
    windows: Record<string, string>;
    suggestions: string[];
};

// Helper type to extract array element type from Array<T>
export type ArrayElementType<T> = T extends Array<infer U> ? U : T;

// Type to transform result after ARRAY JOIN - converts array columns to their element types
export type ArrayJoinResult<TResult, TArrayJoinColumns extends (keyof TResult)[]> = {
    [K in keyof TResult]: K extends TArrayJoinColumns[number]
    ? ArrayElementType<TResult[K]>
    : TResult[K];
};

// Utilidad para desenrollar tipos Array
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;

// Transforma el resultado: Si la columna fue usada en arrayJoin, desenróllala.
export type ResultWithArrayJoin<TResult, TColumnName extends keyof TResult> = {
    [K in keyof TResult]: K extends TColumnName
    ? UnwrapArray<TResult[K]>
    : TResult[K];
};

// Para múltiples columnas en arrayJoin
export type ResultWithMultipleArrayJoins<TResult, TColumnNames extends (keyof TResult)[]> = {
    [K in keyof TResult]: K extends TColumnNames[number]
    ? UnwrapArray<TResult[K]>
    : TResult[K];
};

// Convierte un SelectResult (ej: { id: number, name: string }) 
// en un TableDefinition compatible (ej: { id: ClickHouseColumn<number>, ... })
export type SubqueryToTable<TResult> = TableDefinition<{
    [K in keyof TResult & string]: ClickHouseColumn<TResult[K]>
}>;
