import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Join array elements with a separator
 * @param separator - Separator string
 * @param col - Array column or expression
 */
export declare function arrayJoin(separator: string | ClickHouseColumn | SQLExpression, col?: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Apply a lambda function to each element of an array
 * @param lambda - Lambda function (e.g., 'x -> x * 2')
 * @param col - Array column or expression
 */
export declare function arrayMap(lambda: string, col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Filter array elements using a lambda function
 * @param lambda - Lambda function (e.g., 'x -> x > 0')
 * @param col - Array column or expression
 */
export declare function arrayFilter(lambda: string, col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get the length of an array
 * @param col - Array column or expression
 */
export declare function arrayLength(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Reduce an array using a function
 * @param func - Aggregate function name (e.g., 'sum', 'avg', 'max')
 * @param col - Array column or expression
 */
export declare function arrayReduce(func: string, col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Concatenate multiple arrays
 * @param arrays - Array columns or expressions to concatenate
 */
export declare function arrayConcat(...arrays: (ClickHouseColumn | SQLExpression)[]): SQLExpression<any>;
/**
 * Get element at specific index (1-based)
 * @param col - Array column or expression
 * @param index - Index (1-based)
 */
export declare function arrayElement(col: ClickHouseColumn | SQLExpression, index: number): SQLExpression<any>;
/**
 * Check if array contains an element
 * @param col - Array column or expression
 * @param element - Element to search for
 */
export declare function arrayHas(col: ClickHouseColumn | SQLExpression, element: any): SQLExpression<any>;
/**
 * Check if array has all elements from another array
 * @param col - Array column or expression
 * @param elements - Array of elements to check
 */
export declare function arrayHasAll(col: ClickHouseColumn | SQLExpression, elements: any[] | ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Check if array has any element from another array
 * @param col - Array column or expression
 * @param elements - Array of elements to check
 */
export declare function arrayHasAny(col: ClickHouseColumn | SQLExpression, elements: any[] | ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get the first element of an array
 * @param col - Array column or expression
 */
export declare function arrayFirst(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get the last element of an array
 * @param col - Array column or expression
 */
export declare function arrayLast(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Sort an array
 * @param col - Array column or expression
 * @param ascending - Sort order (default: true for ascending)
 */
export declare function arraySort(col: ClickHouseColumn | SQLExpression, ascending?: boolean): SQLExpression<any>;
/**
 * Reverse an array
 * @param col - Array column or expression
 */
export declare function arrayReverse(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get unique elements from an array
 * @param col - Array column or expression
 */
export declare function arrayDistinct(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Count occurrences of an element in an array
 * @param col - Array column or expression
 * @param element - Element to count
 */
export declare function arrayCountMatches(col: ClickHouseColumn | SQLExpression, element: any): SQLExpression<any>;
/**
 * Check if array is empty
 * @param col - Array column or expression
 */
export declare function empty(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Check if array is not empty
 * @param col - Array column or expression
 */
export declare function notEmpty(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get the minimum value in an array
 * @param col - Array column or expression
 */
export declare function arrayMin(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Get the maximum value in an array
 * @param col - Array column or expression
 */
export declare function arrayMax(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Calculate the sum of array elements
 * @param col - Array column or expression
 */
export declare function arraySum(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
/**
 * Calculate the average of array elements
 * @param col - Array column or expression
 */
export declare function arrayAvg(col: ClickHouseColumn | SQLExpression): SQLExpression<any>;
