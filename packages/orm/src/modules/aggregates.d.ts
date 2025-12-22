import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Count rows or non-null values in column
 * @param col - Column to count (optional, defaults to all rows)
 */
export declare function count(col?: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get minimum value
 * @param col - Column to find minimum
 */
export declare function min<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T>;
/**
 * Get maximum value
 * @param col - Column to find maximum
 */
export declare function max<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T>;
/**
 * Calculate sum of values
 * @param col - Column to sum
 */
export declare function sum(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate average of values
 * @param col - Column to average
 */
export declare function avg(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Count approximate unique values (HyperLogLog)
 * @param col - Column to count unique values
 */
export declare function uniq(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Count exact unique values (ClickHouse-native naming)
 * @param col - Column to count unique values
 */
export declare function uniqExact(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Count exact unique values (SQL-standard naming)
 * @param col - Column to count unique values
 */
export declare function countDistinct(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Create an array from all values in the group
 * @param expr - Expression to aggregate into array
 */
export declare function groupArray<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T[]>;
/**
 * Create an array of unique values from all values in the group
 * @param expr - Expression to aggregate into unique array
 */
export declare function groupUniqArray<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T[]>;
/**
 * Get any value from the group (non-deterministic)
 * @param expr - Expression to get any value from
 */
export declare function any<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T>;
/**
 * Get any value from the group, preferring the last one
 * @param expr - Expression to get any value from
 */
export declare function anyLast<T>(expr: ClickHouseColumn<T, any, any> | SQLExpression<T>): SQLExpression<T>;
/**
 * Get the value with the minimum weight
 * Extremely useful in logs/metrics/"latest state" queries
 * @param value - The value to return when weight is minimum
 * @param weight - The weight to compare
 */
export declare function argMin<T>(value: ClickHouseColumn<T, any, any> | SQLExpression<T>, weight: ClickHouseColumn | SQLExpression): SQLExpression<T>;
/**
 * Get the value with the maximum weight
 * Extremely useful in logs/metrics/"latest state" queries
 * @param value - The value to return when weight is maximum
 * @param weight - The weight to compare
 */
export declare function argMax<T>(value: ClickHouseColumn<T, any, any> | SQLExpression<T>, weight: ClickHouseColumn | SQLExpression): SQLExpression<T>;
/**
 * Calculate standard deviation
 * @param col - Column to calculate standard deviation
 */
export declare function stddevSamp(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate population standard deviation
 * @param col - Column to calculate standard deviation
 */
export declare function stddevPop(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate sample variance
 * @param col - Column to calculate variance
 */
export declare function varSamp(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate population variance
 * @param col - Column to calculate variance
 */
export declare function varPop(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate median
 * @param col - Column to calculate median
 */
export declare function median(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate quantile
 * @param col - Column to calculate quantile
 * @param level - Quantile level (0.0 to 1.0)
 */
export declare function quantile(col: ClickHouseColumn | SQLExpression, level: number): SQLExpression<number>;
/**
 * Calculate quantiles (multiple levels)
 * @param col - Column to calculate quantiles
 * @param levels - Array of quantile levels
 */
export declare function quantiles(col: ClickHouseColumn | SQLExpression, levels: number[]): SQLExpression<number[]>;
/**
 * Calculate Pearson correlation coefficient
 * @param col1 - First column
 * @param col2 - Second column
 */
export declare function corr(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate covariance
 * @param col1 - First column
 * @param col2 - Second column
 */
export declare function covarSamp(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate population covariance
 * @param col1 - First column
 * @param col2 - Second column
 */
export declare function covarPop(col1: ClickHouseColumn | SQLExpression, col2: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate rate per second (for counters and metrics)
 * @param col - Counter column
 * @param bucket - Time bucket column
 */
export declare function rate(col: ClickHouseColumn | SQLExpression, bucket: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate increase in counter value
 * @param col - Counter column
 * @param bucket - Time bucket column
 */
export declare function increase(col: ClickHouseColumn | SQLExpression, bucket?: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Calculate delta between consecutive values
 * @param col - Column to calculate delta
 */
export declare function delta(col: ClickHouseColumn | SQLExpression): SQLExpression<number>;
/**
 * Get top N values by frequency
 * @param col - Column to analyze
 * @param n - Number of top values to return
 */
export declare function topK<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]>;
/**
 * Get bottom N values by frequency
 * @param col - Column to analyze
 * @param n - Number of bottom values to return
 */
export declare function bottomK<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]>;
/**
 * Get top N values by sum
 * @param col - Column to analyze
 * @param n - Number of top values to return
 */
export declare function topSum<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]>;
/**
 * Get bottom N values by sum
 * @param col - Column to analyze
 * @param n - Number of bottom values to return
 */
export declare function bottomSum<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, n: number): SQLExpression<T[]>;
/**
 * Sum values if condition is met
 */
export declare function sumIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number>;
/**
 * Count rows if condition is met
 */
export declare function countIf(condition: SQLExpression): SQLExpression<number>;
/**
 * Average values if condition is met
 */
export declare function avgIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number>;
/**
 * Minimum value if condition is met
 */
export declare function minIf<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, condition: SQLExpression): SQLExpression<T>;
/**
 * Maximum value if condition is met
 */
export declare function maxIf<T>(col: ClickHouseColumn<T, any, any> | SQLExpression<T>, condition: SQLExpression): SQLExpression<T>;
/**
 * Approximate unique values if condition is met
 */
export declare function uniqIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number>;
/**
 * Exact unique values if condition is met
 */
export declare function uniqExactIf(col: ClickHouseColumn | SQLExpression, condition: SQLExpression): SQLExpression<number>;
/**
 * Aggregates all array elements into a single array
 * @example t.array(1, 2), t.array(3, 4) -> [1, 2, 3, 4]
 */
export declare function groupArrayArray<T>(expr: ClickHouseColumn<T[], any, any> | SQLExpression<T[]>): SQLExpression<T[]>;
