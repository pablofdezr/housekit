import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Return alternative value if column is null
 * @param col - Column to check
 * @param alt - Alternative value
 */
export declare function ifNull(col: ClickHouseColumn | SQLExpression, alt: any): SQLExpression;
/**
 * Simple if-then-else conditional
 * @param condition - Condition to evaluate
 * @param trueVal - Value if condition is true
 * @param falseVal - Value if condition is false
 */
export declare function sqlIf(condition: SQLExpression, trueVal: any, falseVal: any): SQLExpression;
/**
 * Multi-conditional function for ClickHouse case-like logic
 * Usage: multiIf(cond1, val1, cond2, val2, ..., default)
 */
export declare function multiIf(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression;
/**
 * Case When builder for analytics queries
 * Compiles to multiIf for better DX
 *
 * @example
 * caseWhen()
 *   .when(gt(events.count, 100), sql`'high'`)
 *   .when(gt(events.count, 50), sql`'medium'`)
 *   .otherwise(sql`'low'`)
 */
export declare function caseWhen(): CaseWhenBuilder;
declare class CaseWhenBuilder {
    private conditions;
    private values;
    private defaultValue?;
    /**
     * Add a condition-value pair
     * @param condition - The condition to evaluate
     * @param value - The value to return if condition is true
     */
    when(condition: ClickHouseColumn | SQLExpression, value: ClickHouseColumn | SQLExpression | any): this;
    /**
     * Set the default value (required)
     * @param value - The default value to return if all conditions are false
     */
    otherwise(value: ClickHouseColumn | SQLExpression | any): SQLExpression;
    /**
     * Build the final multiIf expression
     */
    private build;
}
/**
 * Return first non-null value
 * @param args - Values to check
 */
export declare function coalesce(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression;
/**
 * Return greatest value
 * @param args - Values to compare
 */
export declare function greatest(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression;
/**
 * Return smallest value
 * @param args - Values to compare
 */
export declare function least(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression;
/**
 * Check if value is null
 * @param col - Column or expression to check
 */
export declare function isNull(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if value is not null
 * @param col - Column or expression to check
 */
export declare function isNotNull(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to null if condition is met
 * @param condition - Condition to check
 * @param col - Column to convert to null
 */
export declare function nullIf(condition: SQLExpression, col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to null if value matches
 * @param col - Column to check
 * @param value - Value to match
 */
export declare function nullIfEqual(col: ClickHouseColumn | SQLExpression, value: any): SQLExpression;
/**
 * Logical NOT
 * @param expr - Expression to negate
 */
export declare function not(expr: SQLExpression): SQLExpression;
/**
 * Logical AND (multiple conditions)
 * @param exprs - Conditions to AND together
 */
export declare function and(...exprs: (SQLExpression | undefined | null | false)[]): SQLExpression | undefined;
/**
 * Logical OR (multiple conditions)
 * @param exprs - Conditions to OR together
 */
export declare function or(...exprs: (SQLExpression | undefined | null | false)[]): SQLExpression | undefined;
/**
 * Logical XOR (exclusive or)
 * @param expr1 - First expression
 * @param expr2 - Second expression
 */
export declare function xor(expr1: SQLExpression, expr2: SQLExpression): SQLExpression;
export {};
