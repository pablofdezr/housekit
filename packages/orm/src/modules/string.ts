import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

// =============================================================================
// STRING MANIPULATION FUNCTIONS
// =============================================================================

/**
 * Get string length
 * @param col - Column or expression
 */
export function length(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`length(${col})`;
}

/**
 * Get string length in UTF-8 bytes
 * @param col - Column or expression
 */
export function lengthUTF8(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`lengthUTF8(${col})`;
}

/**
 * Convert to lowercase
 * @param col - Column or expression
 */
export function lower(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`lower(${col})`;
}

/**
 * Convert to uppercase
 * @param col - Column or expression
 */
export function upper(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`upper(${col})`;
}

/**
 * Reverse string
 * @param col - Column or expression
 */
export function reverse(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`reverse(${col})`;
}

/**
 * Repeat string N times
 * @param col - Column or expression
 * @param n - Number of repetitions
 */
export function repeat(col: ClickHouseColumn | SQLExpression, n: number): SQLExpression {
    return sql`repeat(${col}, ${n})`;
}

/**
 * Get substring
 * @param col - Column or expression
 * @param offset - Starting position (1-based)
 * @param length - Length of substring
 */
export function substring(
    col: ClickHouseColumn | SQLExpression, 
    offset: number, 
    length?: number
): SQLExpression {
    return length ? sql`substring(${col}, ${offset}, ${length})` : sql`substring(${col}, ${offset})`;
}

/**
 * Get substring from left
 * @param col - Column or expression
 * @param length - Length from left
 */
export function left(col: ClickHouseColumn | SQLExpression, length: number): SQLExpression {
    return sql`left(${col}, ${length})`;
}

/**
 * Get substring from right
 * @param col - Column or expression
 * @param length - Length from right
 */
export function right(col: ClickHouseColumn | SQLExpression, length: number): SQLExpression {
    return sql`right(${col}, ${length})`;
}

/**
 * Trim whitespace from string
 * @param col - Column or expression
 */
export function stringTrim(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`trim(${col})`;
}

/**
 * Trim left whitespace
 * @param col - Column or expression
 */
export function stringTrimLeft(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`trimLeft(${col})`;
}

/**
 * Trim right whitespace
 * @param col - Column or expression
 */
export function stringTrimRight(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`trimRight(${col})`;
}

// =============================================================================
// STRING SEARCH FUNCTIONS
// =============================================================================

/**
 * Check if string contains substring
 * @param col - Column or expression
 * @param substring - Substring to search for
 */
export function contains(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression {
    return sql`contains(${col}, ${substring})`;
}

/**
 * Check if string starts with substring
 * @param col - Column or expression
 * @param substring - Substring to check
 */
export function startsWith(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression {
    return sql`startsWith(${col}, ${substring})`;
}

/**
 * Check if string ends with substring
 * @param col - Column or expression
 * @param substring - Substring to check
 */
export function endsWith(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression {
    return sql`endsWith(${col}, ${substring})`;
}

/**
 * Find position of substring
 * @param col - Column or expression
 * @param substring - Substring to find
 */
export function position(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression {
    return sql`position(${substring}, ${col})`;
}

/**
 * Count occurrences of substring
 * @param col - Column or expression
 * @param substring - Substring to count
 */
export function countMatches(col: ClickHouseColumn | SQLExpression, substring: string): SQLExpression {
    return sql`countMatches(${col}, ${substring})`;
}

// =============================================================================
// STRING TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Concatenate strings
 * @param cols - Strings to concatenate
 */
export function concat(...cols: (ClickHouseColumn | SQLExpression | string)[]): SQLExpression {
    const params = cols.map(col => sql`${col}`).join(', ');
    return sql`concat(${params})`;
}

/**
 * Replace all occurrences of substring
 * @param col - Column or expression
 * @param pattern - Pattern to replace
 * @param replacement - Replacement string
 */
export function replace(
    col: ClickHouseColumn | SQLExpression, 
    pattern: string, 
    replacement: string
): SQLExpression {
    return sql`replace(${col}, ${pattern}, ${replacement})`;
}

/**
 * Replace using regex
 * @param col - Column or expression
 * @param pattern - Regex pattern
 * @param replacement - Replacement string
 */
export function replaceRegexpAll(
    col: ClickHouseColumn | SQLExpression, 
    pattern: string, 
    replacement: string
): SQLExpression {
    return sql`replaceRegexpAll(${col}, ${pattern}, ${replacement})`;
}

// =============================================================================
// PATTERN MATCHING FUNCTIONS
// =============================================================================

/**
 * Match using regex (returns 1 if matches, 0 if not)
 * @param col - Column or expression
 * @param pattern - Regex pattern
 */
export function match(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression {
    return sql`match(${col}, ${pattern})`;
}

/**
 * Check if string matches pattern (LIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export function like(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression {
    return sql`${col} LIKE ${pattern}`;
}

/**
 * Check if string matches pattern (NOT LIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export function notLike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression {
    return sql`${col} NOT LIKE ${pattern}`;
}

/**
 * Check if string matches pattern (ILIKE - case insensitive)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export function ilike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression {
    return sql`${col} ILIKE ${pattern}`;
}

/**
 * Check if string matches pattern (NOT ILIKE)
 * @param col - Column or expression
 * @param pattern - Pattern to match
 */
export function notIlike(col: ClickHouseColumn | SQLExpression, pattern: string): SQLExpression {
    return sql`${col} NOT ILIKE ${pattern}`;
}

// =============================================================================
// ENCODING AND HASHING FUNCTIONS
// =============================================================================

/**
 * Calculate SHA1 hash
 * @param col - Column or expression
 */
export function sha1(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`sha1(${col})`;
}

/**
 * Calculate SIP hash
 * @param col - Column or expression
 */
export function sipHash64(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`sipHash64(${col})`;
}

// =============================================================================
// MISCELLANEOUS STRING FUNCTIONS
// =============================================================================

/**
 * Split string by delimiter
 * @param col - Column or expression
 * @param delimiter - Delimiter string
 */
export function splitByChar(
    col: ClickHouseColumn | SQLExpression, 
    delimiter: string
): SQLExpression {
    return sql`splitByChar(${col}, ${delimiter})`;
}

/**
 * Split string by whitespace
 * @param col - Column or expression
 */
export function splitByWhitespace(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`splitByWhitespace(${col})`;
}
