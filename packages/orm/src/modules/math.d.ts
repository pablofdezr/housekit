import { ClickHouseColumn } from '../core';
import { type SQLExpression } from '../expressions';
export declare const abs: (col: ClickHouseColumn | SQLExpression) => SQLExpression<any>;
export declare const round: (col: ClickHouseColumn | SQLExpression, precision?: number) => SQLExpression<any>;
export declare const floor: (col: ClickHouseColumn | SQLExpression) => SQLExpression<any>;
export declare const ceil: (col: ClickHouseColumn | SQLExpression) => SQLExpression<any>;
export declare const sqrt: (col: ClickHouseColumn | SQLExpression) => SQLExpression<any>;
export declare const power: (col: ClickHouseColumn | SQLExpression, exponent: number) => SQLExpression<any>;
/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} + ${b}`` directly.
 */
export declare const plus: (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => SQLExpression<any>;
/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} - ${b}`` directly.
 */
export declare const minus: (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => SQLExpression<any>;
/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} * ${b}`` directly.
 */
export declare const mult: (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => SQLExpression<any>;
/**
 * ⚠️ Advanced: Low-value arithmetic wrapper.
 * Consider using `sql`${a} / ${b}`` directly.
 */
export declare const div: (a: ClickHouseColumn | SQLExpression | number, b: ClickHouseColumn | SQLExpression | number) => SQLExpression<any>;
