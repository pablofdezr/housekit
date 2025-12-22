import { ClickHouseColumn } from '../core';
import { sql, type SQLExpression, type SQLValue, type ToSQLOptions } from '../expressions';

type OrderDirection = 'ASC' | 'DESC';

export type WindowPartition = ClickHouseColumn | SQLExpression;
export type WindowOrder = WindowPartition | { col: WindowPartition; dir?: OrderDirection };

export interface WindowSpec {
    partitionBy?: WindowPartition | WindowPartition[];
    orderBy?: WindowOrder | WindowOrder[];
}

class WindowExpression<T = any> implements SQLExpression<T> {
    readonly _type!: T;

    constructor(private base: SQLExpression<T>, private spec?: WindowSpec) { }

    as<TAlias extends string>(alias: TAlias) {
        const clone = new WindowExpression<T>(this.base, this.spec) as any;
        clone._alias = alias;
        return clone as SQLExpression<T> & { _alias: TAlias };
    }

    over(spec?: WindowSpec) {
        return new WindowExpression<T>(this.base, mergeSpecs(this.spec, spec));
    }

    toSQL(options?: ToSQLOptions) {
        const baseResult = this.base.toSQL(options);
        const params = { ...baseResult.params };
        const clause = buildWindowClause(this.spec, options, params);

        return {
            sql: `${baseResult.sql} OVER ${clause}`,
            params
        };
    }

    walk(visitor: (value: any, type: string) => void): string {
        const baseWalk = this.base.walk(visitor);
        
        const walkExpr = (expr: WindowPartition) => {
             if (expr instanceof ClickHouseColumn) {
                return expr.tableName ? `${expr.tableName}.${expr.name}` : expr.name;
            }
            return expr.walk(visitor);
        };

        const parts: string[] = [];
        const spec = this.spec;

        const partitions = normalizeArray(spec?.partitionBy);
        if (partitions.length > 0) {
            const partitionSql = partitions.map(part => walkExpr(part)).join(', ');
            parts.push(`PARTITION BY ${partitionSql}`);
        }

        const orderings = normalizeArray(spec?.orderBy).map(order => {
            if (order && typeof order === 'object' && 'col' in order) {
                return { col: (order as { col: WindowPartition; dir?: OrderDirection }).col, dir: order.dir };
            }
            return { col: order as WindowPartition, dir: undefined };
        });

        if (orderings.length > 0) {
            const orderSql = orderings
                .map(order => {
                    const rendered = walkExpr(order.col);
                    return order.dir ? `${rendered} ${order.dir}` : rendered;
                })
                .join(', ');
            parts.push(`ORDER BY ${orderSql}`);
        }

        const clause = parts.length === 0 ? '()' : `(${parts.join(' ')})`;
        
        return `${baseWalk} OVER ${clause}`;
    }
}

function mergeSpecs(current?: WindowSpec, next?: WindowSpec): WindowSpec | undefined {
    if (!current && !next) return undefined;
    return {
        partitionBy: next?.partitionBy ?? current?.partitionBy,
        orderBy: next?.orderBy ?? current?.orderBy
    };
}

function normalizeArray<T>(value?: T | T[]): T[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
}

function formatColumn(col: ClickHouseColumn, options?: ToSQLOptions) {
    if (options?.ignoreTablePrefix) {
        return `\`${col.name}\``;
    }
    return col.tableName ? `\`${col.tableName}\`.\`${col.name}\`` : `\`${col.name}\``;
}

function renderExpr(expr: WindowPartition, options: ToSQLOptions | undefined, params: Record<string, unknown>) {
    if (expr instanceof ClickHouseColumn) {
        return formatColumn(expr, options);
    }
    const res = expr.toSQL(options);
    Object.assign(params, res.params);
    return res.sql;
}

function buildWindowClause(spec: WindowSpec | undefined, options: ToSQLOptions | undefined, params: Record<string, unknown>) {
    const parts: string[] = [];

    const partitions = normalizeArray(spec?.partitionBy);
    if (partitions.length > 0) {
        const partitionSql = partitions.map(part => renderExpr(part, options, params)).join(', ');
        parts.push(`PARTITION BY ${partitionSql}`);
    }

    const orderings = normalizeArray(spec?.orderBy).map(order => {
        if (order && typeof order === 'object' && 'col' in order) {
            return { col: (order as { col: WindowPartition; dir?: OrderDirection }).col, dir: order.dir };
        }
        return { col: order as WindowPartition, dir: undefined };
    });

    if (orderings.length > 0) {
        const orderSql = orderings
            .map(order => {
                const rendered = renderExpr(order.col, options, params);
                return order.dir ? `${rendered} ${order.dir}` : rendered;
            })
            .join(', ');
        parts.push(`ORDER BY ${orderSql}`);
    }

    if (parts.length === 0) {
        return '()';
    }

    return `(${parts.join(' ')})`;
}

export function over<T>(expr: SQLExpression<T>, spec?: WindowSpec): SQLExpression<T> {
    return new WindowExpression<T>(expr, spec);
}

export function rowNumber(spec?: WindowSpec): SQLExpression<number> {
    return new WindowExpression<number>(sql`row_number()`, spec);
}

export function rank(spec?: WindowSpec): SQLExpression<number> {
    return new WindowExpression<number>(sql`rank()`, spec);
}

export function denseRank(spec?: WindowSpec): SQLExpression<number> {
    return new WindowExpression<number>(sql`dense_rank()`, spec);
}

export function lag<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, offset: number = 1, defaultValue?: SQLValue, spec?: WindowSpec): SQLExpression<T> {
    const base = defaultValue !== undefined
        ? sql`lag(${col}, ${offset}, ${defaultValue})`
        : sql`lag(${col}, ${offset})`;
    return new WindowExpression<T>(base, spec);
}

export function lead<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, offset: number = 1, defaultValue?: SQLValue, spec?: WindowSpec): SQLExpression<T> {
    const base = defaultValue !== undefined
        ? sql`lead(${col}, ${offset}, ${defaultValue})`
        : sql`lead(${col}, ${offset})`;
    return new WindowExpression<T>(base, spec);
}

export const windowFns = { over, rowNumber, rank, denseRank, lag, lead };
