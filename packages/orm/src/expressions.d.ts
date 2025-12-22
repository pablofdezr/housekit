import { ClickHouseColumn } from './core';
export type SQLWrapper = SQLExpression | ClickHouseColumn | SQLValue;
export type SQLValue = string | number | boolean | Date | null | string[] | number[];
export interface ToSQLOptions {
    ignoreTablePrefix?: boolean;
    table?: {
        $columns: Record<string, any>;
    };
}
export type AliasedExpression<TResult = any, TAlias extends string = string> = SQLExpression<TResult> & {
    _alias: TAlias;
};
export interface SQLExpression<TResult = any> {
    _type: TResult;
    toSQL(options?: ToSQLOptions): {
        sql: string;
        params: Record<string, unknown>;
    };
    as<TAlias extends string>(alias: TAlias): AliasedExpression<TResult, TAlias>;
    walk(visitor: (value: any, type: string) => void): string;
}
export declare class SQL<TResult = any> implements SQLExpression<TResult> {
    readonly queryChunks: string[];
    readonly params: any[];
    readonly _type: TResult;
    constructor(queryChunks: string[], params: any[]);
    as<TAlias extends string>(alias: TAlias): AliasedExpression<TResult, TAlias>;
    walk(visitor: (value: any, type: string) => void): string;
    private formatColumn;
    toSQL(options?: ToSQLOptions): {
        sql: string;
        params: Record<string, unknown>;
    };
}
export declare function sql<T = any>(strings: TemplateStringsArray, ...args: any[]): SQLExpression<T>;
export declare namespace sql {
    var raw: (rawSql: string) => SQLExpression;
    var join: (expressions: (SQLExpression | ClickHouseColumn | SQLValue)[], separator?: SQLExpression | string) => SQLExpression;
}
/**
 * Typed SQL helper that preserves types for columns from a table definition.
 */
export declare function typedSQL<T extends Record<string, ClickHouseColumn>>(strings: TemplateStringsArray, ...args: Array<SQLValue | SQLExpression | T[keyof T]>): SQL<any>;
/**
 * Generic function call helper for any ClickHouse function
 * @param name Function name
 * @param args Function arguments
 * @example fn('hex', md5(users.email))
 * @example fn('length', users.interests)
 */
export declare function fn(name: string, ...args: (ClickHouseColumn | SQLExpression | SQLValue)[]): SQLExpression;
export declare function eq<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function ne<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function gt<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function gte<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function lt<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function lte<T>(col: ClickHouseColumn<T, any, any> | SQLExpression, val: T | SQLValue | ClickHouseColumn | SQLExpression): SQLExpression<any>;
export declare function inArray(col: ClickHouseColumn | SQLExpression, values: SQLValue[] | SQLExpression): SQLExpression<any>;
export declare function notInArray(col: ClickHouseColumn | SQLExpression, values: SQLValue[] | SQLExpression): SQLExpression<any>;
export declare function between(col: ClickHouseColumn | SQLExpression, min: SQLValue, max: SQLValue): SQLExpression<any>;
export declare function notBetween(col: ClickHouseColumn | SQLExpression, min: SQLValue, max: SQLValue): SQLExpression<any>;
export declare function has(col: ClickHouseColumn | SQLExpression, value: SQLValue): SQLExpression<any>;
export declare function hasAll(col: ClickHouseColumn | SQLExpression, values: SQLValue[]): SQLExpression<any>;
export declare function hasAny(col: ClickHouseColumn | SQLExpression, values: SQLValue[]): SQLExpression<any>;
export declare function asc(col: ClickHouseColumn | SQLExpression): {
    col: ClickHouseColumn<any, true, false> | SQLExpression<any>;
    dir: "ASC";
};
export declare function desc(col: ClickHouseColumn | SQLExpression): {
    col: ClickHouseColumn<any, true, false> | SQLExpression<any>;
    dir: "DESC";
};
