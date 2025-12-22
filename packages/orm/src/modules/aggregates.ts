import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

// =============================================================================
// AGGREGATE FUNCTIONS
// =============================================================================

/**
 * Count rows or non-null values in column
 * @param col - Column to count (optional, defaults to all rows)
 */
export function count(col?: ClickHouseColumn | SQLExpression): SQLExpression {
    if (!col) return sql<number>`count(*)`;
    return sql<number>`count(${col})`;
}

/**
 * Get minimum value
 * @param col - Column to find minimum
 */
export function min<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T> {
    return sql<T>`min(${col})`;
}

/**
 * Get maximum value
 * @param col - Column to find maximum
 */
export function max<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T> {
    return sql<T>`max(${col})`;
}

/**
 * Calculate sum of values
 * @param col - Column to sum
 */
export function sum(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`sum(${col})`;
}

/**
 * Calculate average of values
 * @param col - Column to average
 */
export function avg(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`avg(${col})`;
}

// =============================================================================
// CLICKHOUSE ANALYTICAL FUNCTIONS
// =============================================================================

/**
 * Count approximate unique values (HyperLogLog)
 * @param col - Column to count unique values
 */
export function uniq(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`uniq(${col})`;
}

/**
 * Count exact unique values (ClickHouse-native naming)
 * @param col - Column to count unique values
 */
export function uniqExact(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`uniqExact(${col})`;
}

/**
 * Count exact unique values (SQL-standard naming)
 * @param col - Column to count unique values
 */
export function countDistinct(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`uniqExact(${col})`;
}

// =============================================================================
// ANALYTICS AGGREGATES (very common in real ClickHouse workloads)
// =============================================================================

/**
 * Create an array from all values in the group
 * @param expr - Expression to aggregate into array
 */
export function groupArray<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T[]> {
    return sql<T[]>`groupArray(${expr})`;
}

/**
 * Create an array of unique values from all values in the group
 * @param expr - Expression to aggregate into unique array
 */
export function groupUniqArray<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T[]> {
    return sql<T[]>`groupUniqArray(${expr})`;
}

/**
 * Get any value from the group (non-deterministic)
 * @param expr - Expression to get any value from
 */
export function any<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T> {
    return sql<T>`any(${expr})`;
}

/**
 * Get any value from the group, preferring the last one
 * @param expr - Expression to get any value from
 */
export function anyLast<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T> {
    return sql<T>`anyLast(${expr})`;
}

/**
 * Get the value with the minimum weight
 * Extremely useful in logs/metrics/"latest state" queries
 * @param value - The value to return when weight is minimum
 * @param weight - The weight to compare
 */
export function argMin<T>(value: ClickHouseColumn<T, any, any> | SQLExpression<T>, weight: ClickHouseColumn | SQLExpression): SQLExpression<T> {
    return sql<T>`argMin(${value}, ${weight})`;
}

/**
 * Get the value with the maximum weight
 * Extremely useful in logs/metrics/"latest state" queries
 * @param value - The value to return when weight is maximum
 * @param weight - The weight to compare
 */
export function argMax<T>(value: ClickHouseColumn<T, any, any> | SQLExpression<T>, weight: ClickHouseColumn | SQLExpression): SQLExpression<T> {
    return sql<T>`argMax(${value}, ${weight})`;
}

// =============================================================================
// STATISTICAL FUNCTIONS
// =============================================================================

/**
 * Calculate standard deviation
 * @param col - Column to calculate standard deviation
 */
export function stddevSamp(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`stddevSamp(${col})`;
}

/**
 * Calculate population standard deviation
 * @param col - Column to calculate standard deviation
 */
export function stddevPop(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`stddevPop(${col})`;
}

/**
 * Calculate sample variance
 * @param col - Column to calculate variance
 */
export function varSamp(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`varSamp(${col})`;
}

/**
 * Calculate population variance
 * @param col - Column to calculate variance
 */
export function varPop(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`varPop(${col})`;
}

/**
 * Calculate median
 * @param col - Column to calculate median
 */
export function median(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`median(${col})`;
}

/**
 * Calculate quantile
 * @param col - Column to calculate quantile
 * @param level - Quantile level (0.0 to 1.0)
 */
export function quantile(col: ClickHouseColumn | SQLExpression, level: number): SQLExpression<number> {
    return sql<number>`quantile(${level})(${col})`;
}

/**
 * Calculate quantiles (multiple levels)
 * @param col - Column to calculate quantiles
 * @param levels - Array of quantile levels
 */
export function quantiles(col: ClickHouseColumn | SQLExpression, levels: number[]): SQLExpression<number[]> {
    const levelsStr = levels.join(', ');
    return sql<number[]>`quantiles(${levelsStr})(${col})`;
}

// =============================================================================
// CORRELATION AND COVARIANCE
// =============================================================================

/**
 * Calculate Pearson correlation coefficient
 * @param col1 - First column
 * @param col2 - Second column
 */
export function corr(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`corr(${col1}, ${col2})`;
}

/**
 * Calculate covariance
 * @param col1 - First column
 * @param col2 - Second column
 */
export function covarSamp(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`covarSamp(${col1}, ${col2})`;
}

/**
 * Calculate population covariance
 * @param col1 - First column
 * @param col2 - Second column
 */
export function covarPop(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`covarPop(${col1}, ${col2})`;
}

// =============================================================================
// RATE AND COUNTER FUNCTIONS
// =============================================================================

/**
 * Calculate rate per second (for counters and metrics)
 * @param col - Counter column
 * @param bucket - Time bucket column
 */
export function rate(col: ClickHouseColumn | SQLExpression, bucket: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`rate(${col})`;
}

/**
 * Calculate increase in counter value
 * @param col - Counter column
 * @param bucket - Time bucket column
 */
export function increase(col: ClickHouseColumn | SQLExpression, bucket?: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`increase(${col})`;
}

/**
 * Calculate delta between consecutive values
 * @param col - Column to calculate delta
 */
export function delta(col: ClickHouseColumn | SQLExpression): SQLExpression<number> {
    return sql<number>`delta(${col})`;
}

// =============================================================================
// TOP/BOTTOM FUNCTIONS
// =============================================================================

/**
 * Get top N values by frequency
 * @param col - Column to analyze
 * @param n - Number of top values to return
 */
export function topK<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]> {
    return sql<T[]>`topK(${n})(${col})`;
}

/**
 * Get bottom N values by frequency
 * @param col - Column to analyze
 * @param n - Number of bottom values to return
 */
export function bottomK<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]> {
    return sql<T[]>`bottomK(${n})(${col})`;
}

/**
 * Get top N values by sum
 * @param col - Column to analyze
 * @param n - Number of top values to return
 */
export function topSum<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]> {
    return sql<T[]>`topSum(${n})(${col})`;
}

/**
 * Get bottom N values by sum
 * @param col - Column to analyze
 * @param n - Number of bottom values to return
 */
export function bottomSum<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]> {
    return sql<T[]>`bottomSum(${n})(${col})`;
}

// =============================================================================
// CLICKHOUSE COMBINATORS (-If, -Array, -Map)
// =============================================================================

/**
 * Sum values if condition is met
 */
export function sumIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number> {
    return sql<number>`sumIf(${col}, ${condition})`;
}

/**
 * Count rows if condition is met
 */
export function countIf(condition: SQLExpression): SQLExpression<number> {
    return sql<number>`countIf(${condition})`;
}

/**
 * Average values if condition is met
 */
export function avgIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number> {
    return sql<number>`avgIf(${col}, ${condition})`;
}

/**
 * Minimum value if condition is met
 */
export function minIf<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, condition: SQLExpression): SQLExpression<T> {
    return sql<T>`minIf(${col}, ${condition})`;
}

/**
 * Maximum value if condition is met
 */
export function maxIf<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, condition: SQLExpression): SQLExpression<T> {
    return sql<T>`maxIf(${col}, ${condition})`;
}

/**
 * Approximate unique values if condition is met
 */
export function uniqIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number> {
    return sql<number>`uniqIf(${col}, ${condition})`;
}

/**
 * Exact unique values if condition is met
 */
export function uniqExactIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number> {
    return sql<number>`uniqExactIf(${col}, ${condition})`;
}

/**
 * Aggregates all array elements into a single array
 * @example t.array(1, 2), t.array(3, 4) -> [1, 2, 3, 4]
 */
export function groupArrayArray<T>(expr: ClickHouseColumn<T[], any, any> | SQLExpression<T[]>): SQLExpression<T[]> {
    return sql<T[]>`groupArrayArray(${expr})`;
}
