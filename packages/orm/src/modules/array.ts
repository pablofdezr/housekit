import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

// =============================================================================
// CORE ARRAY FUNCTIONS (ClickHouse-idiomatic and highly useful)
// =============================================================================

/**
 * Join array elements with a separator
 * @param separator - Separator string
 * @param col - Array column or expression
 */
export function arrayJoin(separator: string | ClickHouseColumn | SQLExpression, col?: ClickHouseColumn | SQLExpression) {
    if (col) {
        return sql`arrayJoin(${separator}, ${col})`;
    }
    return sql`arrayJoin(${separator})`;
}

/**
 * Apply a lambda function to each element of an array
 * @param lambda - Lambda function (e.g., 'x -> x * 2')
 * @param col - Array column or expression
 */
export function arrayMap(lambda: string, col: ClickHouseColumn | SQLExpression) {
    return sql`arrayMap(${lambda}, ${col})`;
}

/**
 * Filter array elements using a lambda function
 * @param lambda - Lambda function (e.g., 'x -> x > 0')
 * @param col - Array column or expression
 */
export function arrayFilter(lambda: string, col: ClickHouseColumn | SQLExpression) {
    return sql`arrayFilter(${lambda}, ${col})`;
}

/**
 * Get the length of an array
 * @param col - Array column or expression
 */
export function arrayLength(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayLength(${col})`;
}

// =============================================================================
// ADVANCED ARRAY FUNCTIONS (Power-user stuff)
// =============================================================================

/**
 * Reduce an array using a function
 * @param func - Aggregate function name (e.g., 'sum', 'avg', 'max')
 * @param col - Array column or expression
 */
export function arrayReduce(func: string, col: ClickHouseColumn | SQLExpression) {
    return sql`arrayReduce('${func}', ${col})`;
}

/**
 * Concatenate multiple arrays
 * @param arrays - Array columns or expressions to concatenate
 */
export function arrayConcat(...arrays: (ClickHouseColumn | SQLExpression)[]) {
    const params = arrays.map(arr => sql`${arr}`).join(', ');
    return sql`arrayConcat(${params})`;
}

// =============================================================================
// ADDITIONAL ARRAY HELPER FUNCTIONS
// =============================================================================

/**
 * Get element at specific index (1-based)
 * @param col - Array column or expression
 * @param index - Index (1-based)
 */
export function arrayElement(col: ClickHouseColumn | SQLExpression, index: number) {
    return sql`arrayElement(${col}, ${index})`;
}

/**
 * Check if array contains an element
 * @param col - Array column or expression
 * @param element - Element to search for
 */
export function arrayHas(col: ClickHouseColumn | SQLExpression, element: any) {
    return sql`has(${col}, ${element})`;
}

/**
 * Check if array has all elements from another array
 * @param col - Array column or expression
 * @param elements - Array of elements to check
 */
export function arrayHasAll(col: ClickHouseColumn | SQLExpression, elements: any[] | ClickHouseColumn | SQLExpression) {
    return sql`hasAll(${col}, ${elements})`;
}

/**
 * Check if array has any element from another array
 * @param col - Array column or expression
 * @param elements - Array of elements to check
 */
export function arrayHasAny(col: ClickHouseColumn | SQLExpression, elements: any[] | ClickHouseColumn | SQLExpression) {
    return sql`hasAny(${col}, ${elements})`;
}

/**
 * Get the first element of an array
 * @param col - Array column or expression
 */
export function arrayFirst(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayFirst(${col})`;
}

/**
 * Get the last element of an array
 * @param col - Array column or expression
 */
export function arrayLast(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayLast(${col})`;
}

/**
 * Sort an array
 * @param col - Array column or expression
 * @param ascending - Sort order (default: true for ascending)
 */
export function arraySort(col: ClickHouseColumn | SQLExpression, ascending = true) {
    return ascending ? sql`arraySort(${col})` : sql`arrayReverseSort(${col})`;
}

/**
 * Reverse an array
 * @param col - Array column or expression
 */
export function arrayReverse(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayReverse(${col})`;
}

/**
 * Get unique elements from an array
 * @param col - Array column or expression
 */
export function arrayDistinct(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayDistinct(${col})`;
}

/**
 * Count occurrences of an element in an array
 * @param col - Array column or expression
 * @param element - Element to count
 */
export function arrayCountMatches(col: ClickHouseColumn | SQLExpression, element: any) {
    return sql`countMatches(${col}, ${element})`;
}

/**
 * Check if array is empty
 * @param col - Array column or expression
 */
export function empty(col: ClickHouseColumn | SQLExpression) {
    return sql`empty(${col})`;
}

/**
 * Check if array is not empty
 * @param col - Array column or expression
 */
export function notEmpty(col: ClickHouseColumn | SQLExpression) {
    return sql`notEmpty(${col})`;
}

/**
 * Get the minimum value in an array
 * @param col - Array column or expression
 */
export function arrayMin(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayMin(${col})`;
}

/**
 * Get the maximum value in an array
 * @param col - Array column or expression
 */
export function arrayMax(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayMax(${col})`;
}

/**
 * Calculate the sum of array elements
 * @param col - Array column or expression
 */
export function arraySum(col: ClickHouseColumn | SQLExpression) {
    return sql`arraySum(${col})`;
}

/**
 * Calculate the average of array elements
 * @param col - Array column or expression
 */
export function arrayAvg(col: ClickHouseColumn | SQLExpression) {
    return sql`arrayAvg(${col})`;
}