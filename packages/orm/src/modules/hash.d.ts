import { ClickHouseColumn } from '../core';
import { type SQLExpression } from '../expressions';
type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;
export declare const cityHash64: (col: Expr) => SQLExpression<number>;
export declare const md5: (col: Expr) => SQLExpression<string>;
export declare const sha256: (col: Expr) => SQLExpression<string>;
export {};
