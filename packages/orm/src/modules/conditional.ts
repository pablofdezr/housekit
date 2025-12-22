import { ClickHouseColumn } from '../core';
import { sql, SQLExpression, SQL } from '../expressions';

// =============================================================================
// CONDITIONAL FUNCTIONS
// =============================================================================

/**
 * Return alternative value if column is null
 * @param col - Column to check
 * @param alt - Alternative value
 */
export function ifNull(col: ClickHouseColumn | SQLExpression, alt: any): SQLExpression {
    return sql`ifNull(${col}, ${alt})`;
}

/**
 * Simple if-then-else conditional
 * @param condition - Condition to evaluate
 * @param trueVal - Value if condition is true
 * @param falseVal - Value if condition is false
 */
export function sqlIf(
    condition: SQLExpression, 
    trueVal: any, 
    falseVal: any
): SQLExpression {
    return sql`if(${condition}, ${trueVal}, ${falseVal})`;
}

/**
 * Multi-conditional function for ClickHouse case-like logic
 * Usage: multiIf(cond1, val1, cond2, val2, ..., default)
 */
export function multiIf(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression {
    if (args.length < 3) {
        throw new Error('multiIf requires at least 3 arguments: condition, value, default');
    }
    if (args.length % 2 === 0) {
        throw new Error('multiIf requires an odd number of arguments: condition-value pairs plus a default value');
    }
    
    const params = args.map(arg => sql`${arg}`).join(', ');
    return sql`multiIf(${params})`;
}

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
export function caseWhen() {
    return new CaseWhenBuilder();
}

class CaseWhenBuilder {
    private conditions: (ClickHouseColumn | SQLExpression)[] = [];
    private values: (ClickHouseColumn | SQLExpression | any)[] = [];
    private defaultValue?: ClickHouseColumn | SQLExpression | any;

    /**
     * Add a condition-value pair
     * @param condition - The condition to evaluate
     * @param value - The value to return if condition is true
     */
    when(condition: ClickHouseColumn | SQLExpression, value: ClickHouseColumn | SQLExpression | any) {
        this.conditions.push(condition);
        this.values.push(value);
        return this;
    }

    /**
     * Set the default value (required)
     * @param value - The default value to return if all conditions are false
     */
    otherwise(value: ClickHouseColumn | SQLExpression | any): SQLExpression {
        this.defaultValue = value;
        return this.build();
    }

    /**
     * Build the final multiIf expression
     */
    private build(): SQLExpression {
        if (!this.defaultValue) {
            throw new Error('CaseWhenBuilder requires a default value via .otherwise()');
        }

        const args: (ClickHouseColumn | SQLExpression | any)[] = [];
        
        // Add condition-value pairs
        for (let i = 0; i < this.conditions.length; i++) {
            args.push(this.conditions[i]);
            args.push(this.values[i]);
        }
        
        // Add default value
        args.push(this.defaultValue);

        return multiIf(...args);
    }
}

// =============================================================================
// COALESCE AND COMPARISON FUNCTIONS
// =============================================================================

/**
 * Return first non-null value
 * @param args - Values to check
 */
export function coalesce(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression {
    const chunks: string[] = ['coalesce('];
    const params: any[] = [];

    args.forEach((arg, i) => {
        params.push(arg);
        if (i < args.length - 1) {
            chunks.push(', ');
        }
    });
    chunks.push(')');

    return new SQL(chunks, params);
}

/**
 * Return greatest value
 * @param args - Values to compare
 */
export function greatest(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression {
    const chunks: string[] = ['greatest('];
    const params: any[] = [];

    args.forEach((arg, i) => {
        params.push(arg);
        if (i < args.length - 1) {
            chunks.push(', ');
        }
    });
    chunks.push(')');

    return new SQL(chunks, params);
}

/**
 * Return smallest value
 * @param args - Values to compare
 */
export function least(...args: (ClickHouseColumn | SQLExpression | any)[]): SQLExpression {
    const chunks: string[] = ['least('];
    const params: any[] = [];

    args.forEach((arg, i) => {
        params.push(arg);
        if (i < args.length - 1) {
            chunks.push(', ');
        }
    });
    chunks.push(')');

    return new SQL(chunks, params);
}

// =============================================================================
// NULL HANDLING FUNCTIONS
// =============================================================================

/**
 * Check if value is null
 * @param col - Column or expression to check
 */
export function isNull(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${col} IS NULL`;
}

/**
 * Check if value is not null
 * @param col - Column or expression to check
 */
export function isNotNull(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${col} IS NOT NULL`;
}

/**
 * Convert to null if condition is met
 * @param condition - Condition to check
 * @param col - Column to convert to null
 */
export function nullIf(condition: SQLExpression, col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`nullIf(${col}, ${condition})`;
}

/**
 * Convert to null if value matches
 * @param col - Column to check
 * @param value - Value to match
 */
export function nullIfEqual(col: ClickHouseColumn | SQLExpression, value: any): SQLExpression {
    return sql`nullIf(${col}, ${value})`;
}

// =============================================================================
// LOGICAL FUNCTIONS
// =============================================================================

/**
 * Logical NOT
 * @param expr - Expression to negate
 */
export function not(expr: SQLExpression): SQLExpression {
    return sql`NOT (${expr})`;
}

/**
 * Logical AND (multiple conditions)
 * @param exprs - Conditions to AND together
 */
export function and(...exprs: (SQLExpression | undefined | null | false)[]): SQLExpression | undefined {
    const filtered = exprs.filter((e): e is SQLExpression => !!e);
    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];

    const finalChunks: string[] = ['('];
    const finalParams: any[] = [];

    filtered.forEach((e, i) => {
        finalParams.push(e);
        if (i < filtered.length - 1) {
            finalChunks.push(') AND (');
        } else {
            finalChunks.push(')');
        }
    });

    return new SQL(finalChunks, finalParams);
}

/**
 * Logical OR (multiple conditions)
 * @param exprs - Conditions to OR together
 */
export function or(...exprs: (SQLExpression | undefined | null | false)[]): SQLExpression | undefined {
    const filtered = exprs.filter((e): e is SQLExpression => !!e);
    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];

    const finalChunks: string[] = ['('];
    const finalParams: any[] = [];

    filtered.forEach((e, i) => {
        finalParams.push(e);
        if (i < filtered.length - 1) {
            finalChunks.push(') OR (');
        } else {
            finalChunks.push(')');
        }
    });

    return new SQL(finalChunks, finalParams);
}

/**
 * Logical XOR (exclusive or)
 * @param expr1 - First expression
 * @param expr2 - Second expression
 */
export function xor(expr1: SQLExpression, expr2: SQLExpression): SQLExpression {
    return sql`xor(${expr1}, ${expr2})`;
}
