import { ClickHouseColumn } from '../core';
import { sql, type SQLExpression } from '../expressions';

type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;

export const cityHash64 = (col: Expr): SQLExpression<number> => sql<number>`cityHash64(${col})`;
export const md5 = (col: Expr): SQLExpression<string> => sql<string>`MD5(${col})`;
export const sha256 = (col: Expr): SQLExpression<string> => sql<string>`SHA256(${col})`;
