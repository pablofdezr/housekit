import { ClickHouseColumn } from '../core';
import { type SQLExpression, type SQLValue } from '../expressions';
type OrderDirection = 'ASC' | 'DESC';
export type WindowPartition = ClickHouseColumn | SQLExpression;
export type WindowOrder = WindowPartition | {
    col: WindowPartition;
    dir?: OrderDirection;
};
export interface WindowSpec {
    partitionBy?: WindowPartition | WindowPartition[];
    orderBy?: WindowOrder | WindowOrder[];
}
export declare function over<T>(expr: SQLExpression<T>, spec?: WindowSpec): SQLExpression<T>;
export declare function rowNumber(spec?: WindowSpec): SQLExpression<number>;
export declare function rank(spec?: WindowSpec): SQLExpression<number>;
export declare function denseRank(spec?: WindowSpec): SQLExpression<number>;
export declare function lag<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, offset?: number, defaultValue?: SQLValue, spec?: WindowSpec): SQLExpression<T>;
export declare function lead<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, offset?: number, defaultValue?: SQLValue, spec?: WindowSpec): SQLExpression<T>;
export declare const windowFns: {
    over: typeof over;
    rowNumber: typeof rowNumber;
    rank: typeof rank;
    denseRank: typeof denseRank;
    lag: typeof lag;
    lead: typeof lead;
};
export {};
