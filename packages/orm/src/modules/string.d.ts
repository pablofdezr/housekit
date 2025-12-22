import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Get string length
 * @param col - Column or expression
 */
export declare function length(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get string length in UTF-8 bytes
 * @param col - Column or expression
 */
export declare function lengthUTF8(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to lowercase
 * @param col - Column or expression
 */
export declare function lower(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to uppercase
 * @param col - Column or expression
 */
export declare function upper(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Reverse string
 * @param col - Column or expression
 */
export declare function reverse(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Repeat string N times
 * @param col - Column or expression
 * @param n - Number of repetitions
 */
export declare function repeat(col: ClickHouseColumn | SQLExpression, n: number): SQLExpression;
/**
 * Get substring
 * @param col - Column or expression
 * @param offset - Starting position (1-based)
 * @param length - Length of substring
 */
export declare function substring(col: ClickHouseColumn | SQLExpression, offset: number, length?: number): SQLExpression;
/**
 * Get substring from left
 * @param col - Column or expression
 * @param length - Length from left
 */
export declare function left(col: ClickHouseColumn | SQLExpression, length: number): SQLExpression;
/**
 * Get substring from right
 * @param col - Column or expression
 * @param length - Length from right
 */
export declare function right(col: ClickHouseColumn | SQLExpression, length: number): SQLExpression;
/**
 * Trim whitespace from string
 * @param col - Column or expression
 */
export declare function stringTrim(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Trim left whitespace
 * @param col - Column or expression
 */
export declare function stringTrimLeft(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Trim right whitespace
 * @param col - Column or expression
 */
export declare function stringTrimRight(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if string contains substring
 * @param col - Column or expression
 * @param substring - Substring to search for
 */
export declare function contains(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression;
/**
 * Check if string starts with substring
 * @param col - Column or expression
 * @param substring - Substring to check
 */
export declare function startsWith(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression;
/**
 * Check if string ends with substring
 * @param col - Column or expression
 * @param substring - Substring to check
 */
export declare function endsWith(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression;
/**
 * Find position of substring
 * @param col - Column or expression
 * @param substring - Substring to find
 */
export declare function position(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression;
/**
 * Count occurrences of substring
 * @param col - Column or expression
 * @param substring - Substring to count
 */
export declare function countMatches(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression;
/**
 * Concatenate strings
 * @param cols - Strings to concatenate
 */
export declare function concat(...cols: (ClickHouseColumn | SQLExpression | string)[]): SQLExpression;
/**
 * Replace all occurrences of substring
 * @param col - Column or expression
 * @param pattern - Pattern to replace
 * @param replacement - Replacement string
 */
export declare function replace(col: ClickHouseColumn | SQLExpression, pattern: string, replacement: string): SQLExpression;
/**
 * Replace using regex
 * @param col - Column or expression
 * @param pattern - Regex pattern
 * @param replacement - Replacement string
 */
export declare function replaceRegexpAll(col: ClickHouseColumn | SQLExpression, pattern: string, replacement: string): SQLExpression;
/**
 * Match using regex (returns 1 if matches, 0 if not)
 * @param col - Column or expression
 * @param pattern - Regex pattern
 */
export declare function match(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression;
/**
 * Check if string matches pattern (LIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export declare function like(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression;
/**
 * Check if string matches pattern (NOT LIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export declare function notLike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression;
/**
 * Check if string matches pattern (ILIKE - case insensitive)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export declare function ilike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression;
/**
 * Check if string matches pattern (NOT ILIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export declare function notIlike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression;
/**
 * Calculate SHA1 hash
 * @param col - Column or expression
 */
export declare function sha1(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Calculate SIP hash
 * @param col - Column or expression
 */
export declare function sipHash64(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Split string by delimiter
 * @param col - Column or expression
 * @param delimiter - Delimiter string
 */
export declare function splitByChar(col: ClickHouseColumn | SQLExpression, delimiter: string): SQLExpression;
/**
 * Split string by whitespace
 * @param col - Column or expression
 */
export declare function splitByWhitespace(col: ClickHouseColumn | SQLExpression): SQLExpression;
