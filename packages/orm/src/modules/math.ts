import { ClickHouseColumn } from '../core';
import { sql, type SQLExpression } from '../expressions';

export const abs = (col: ClickHouseColumn | SQLExpression) => sql`abs(${col})`;

export const round = (col: ClickHouseColumn | SQLExpression, precision?: number) => {
    if (precision !== undefined) {
        return sql`round(${col}, ${precision})`;
    }
    return sql`round(${col})`;
};

export const floor = (col: ClickHouseColumn | SQLExpression) => sql`floor(${col})`;
export const ceil = (col: ClickHouseColumn | SQLExpression) => sql`ceil(${col})`;
export const sqrt = (col: ClickHouseColumn | SQLExpression) => sql`sqrt(${col})`;
export const power = (col: ClickHouseColumn | SQLExpression, exponent: number) => sql`power(${col}, ${exponent})`;

/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} + ${b}`` directly.
 */
export const plus = (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => sql`${a} + ${b}`;

/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} - ${b}`` directly.
 */
export const minus = (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => sql`${a} - ${b}`;

/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} * ${b}`` directly.
 */
export const mult = (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => sql`${a} * ${b}`;

/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} / ${b}`` directly.
 */
export const div = (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => sql`${a} / ${b}`;
