import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;

// =============================================================================
// TYPE CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert to string
 * @param col - Column or expression to convert
 */
export function toString(col: Expr): SQLExpression<string> {
    return sql<string>`toString(${col})`;
}

export function toInt32(col: Expr): SQLExpression<number> {
    return sql<number>`toInt32(${col})`;
}

/**
 * Convert to integer (alias for toInt32)
 */
export const toInteger = toInt32;

/**
 * Convert to 64-bit integer
 * @param col - Column or expression to convert
 */
export function toInt64(col: Expr): SQLExpression<number> {
    return sql<number>`toInt64(${col})`;
}

/**
 * Convert to 32-bit unsigned integer
 * @param col - Column or expression to convert
 */
export function toUInt32(col: Expr): SQLExpression<number> {
    return sql<number>`toUInt32(${col})`;
}

/**
 * Convert to 64-bit unsigned integer
 * @param col - Column or expression to convert
 */
export function toUInt64(col: Expr): SQLExpression<number> {
    return sql<number>`toUInt64(${col})`;
}

/**
 * Convert to 32-bit float
 * @param col - Column or expression to convert
 */
export function toFloat32(col: Expr): SQLExpression<number> {
    return sql<number>`toFloat32(${col})`;
}

/**
 * Convert to 64-bit float
 * @param col - Column or expression to convert
 */
export function toFloat64(col: Expr): SQLExpression<number> {
    return sql<number>`toFloat64(${col})`;
}

export function toBool(col: Expr): SQLExpression<boolean> {
    return sql<boolean>`toBool(${col})`;
}

/**
 * Convert to boolean (alias for toBool)
 */
export const toBoolean = toBool;

/**
 * Convert to UUID
 * @param col - Column or expression to convert
 */
export function toUUID(col: Expr): SQLExpression<string> {
    return sql<string>`toUUID(${col})`;
}

/**
 * Convert to Date type (without time)
 * @param col - Column or expression to convert
 */
export function toDate(col: Expr): SQLExpression<string> {
    return sql<string>`toDate(${col})`;
}

export function toDateTime(col: Expr): SQLExpression<string> {
    return sql<string>`toDateTime(${col})`;
}

/**
 * Convert to timestamp (alias for toDateTime)
 */
export const toTimestamp = toDateTime;

/**
 * Convert to DateTime64 type
 * @param col - Column or expression to convert
 * @param precision - DateTime precision (default: 3)
 */
export function toDateTime64(col: Expr, precision: number = 3): SQLExpression<string> {
    return sql<string>`toDateTime64(${col}, ${precision})`;
}

// =============================================================================
// STRING CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert to lowercase
 * @param col - Column or expression to convert
 */
export function toLowercase(col: Expr): SQLExpression<string> {
    return sql<string>`toLowercase(${col})`;
}

/**
 * Convert to uppercase
 * @param col - Column or expression to convert
 */
export function toUppercase(col: Expr): SQLExpression<string> {
    return sql<string>`toUppercase(${col})`;
}

/**
 * Convert to title case (first letter uppercase, rest lowercase)
 * @param col - Column or expression to convert
 */
export function toTitleCase(col: Expr): SQLExpression<string> {
    return sql<string>`toTitleCase(${col})`;
}

/**
 * Trim whitespace from string
 * @param col - Column or expression to trim
 */
export function convertTrim(col: Expr): SQLExpression<string> {
    return sql<string>`trim(${col})`;
}

/**
 * Trim left whitespace
 * @param col - Column or expression to trim
 */
export function convertTrimLeft(col: Expr): SQLExpression<string> {
    return sql<string>`trimLeft(${col})`;
}

/**
 * Trim right whitespace
 * @param col - Column or expression to trim
 */
export function convertTrimRight(col: Expr): SQLExpression<string> {
    return sql<string>`trimRight(${col})`;
}

/**
 * Left pad string
 * @param col - Column or expression to pad
 * @param length - Target length
 * @param fill - Fill character (default: space)
 */
export function leftPad(col: Expr, length: number, fill: string = ' '): SQLExpression<string> {
    return sql<string>`leftPad(${col}, ${length}, ${fill})`;
}

/**
 * Right pad string
 * @param col - Column or expression to pad
 * @param length - Target length
 * @param fill - Fill character (default: space)
 */
export function rightPad(col: Expr, length: number, fill: string = ' '): SQLExpression<string> {
    return sql<string>`rightPad(${col}, ${length}, ${fill})`;
}

// =============================================================================
// BINARY CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert to hexadecimal string
 * @param col - Column or expression to convert
 */
export function toHex(col: Expr): SQLExpression<string> {
    return sql<string>`toHex(${col})`;
}

/**
 * Convert from hexadecimal string
 * @param col - Column or expression to convert
 */
export function fromHex(col: Expr): SQLExpression<string> {
    return sql<string>`fromHex(${col})`;
}

/**
 * Convert to base64 string
 * @param col - Column or expression to convert
 */
export function toBase64(col: Expr): SQLExpression<string> {
    return sql<string>`toBase64(${col})`;
}

/**
 * Convert from base64 string
 * @param col - Column or expression to convert
 */
export function fromBase64(col: Expr): SQLExpression<string> {
    return sql<string>`fromBase64(${col})`;
}

/**
 * Convert to binary string
 * @param col - Column or expression to convert
 */
export function toBin(col: Expr): SQLExpression<string> {
    return sql<string>`toBin(${col})`;
}

/**
 * Convert from binary string
 * @param col - Column or expression to convert
 */
export function fromBin(col: Expr): SQLExpression<string> {
    return sql<string>`fromBin(${col})`;
}

// =============================================================================
// URL AND ENCODING FUNCTIONS
// =============================================================================

/**
 * URL encode string
 * @param col - Column or expression to encode
 */
export function urlEncode(col: Expr): SQLExpression<string> {
    return sql<string>`urlEncode(${col})`;
}

/**
 * URL decode string
 * @param col - Column or expression to decode
 */
export function urlDecode(col: Expr): SQLExpression<string> {
    return sql<string>`urlDecode(${col})`;
}

/**
 * HTML escape string
 * @param col - Column or expression to escape
 */
export function htmlEscape(col: Expr): SQLExpression<string> {
    return sql<string>`htmlEscape(${col})`;
}

/**
 * HTML unescape string
 * @param col - Column or expression to unescape
 */
export function htmlUnescape(col: Expr): SQLExpression<string> {
    return sql<string>`htmlUnescape(${col})`;
}

// =============================================================================
// FORMAT FUNCTIONS
// =============================================================================

/**
 * Format number with specified decimal places
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export function formatDecimal(col: Expr, precision: number): SQLExpression<string> {
    return sql<string>`formatDecimal(${col}, ${precision})`;
}

/**
 * Format number in human-readable format
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export function formatReadableDecimal(col: Expr, precision: number): SQLExpression<string> {
    return sql<string>`formatReadableDecimal(${col}, ${precision})`;
}

/**
 * Format number with specified number of digits
 * @param col - Column or expression to format
 * @param digits - Total number of digits
 */
export function formatNumber(col: Expr, digits: number): SQLExpression<string> {
    return sql<string>`formatNumber(${col}, ${digits})`;
}

/**
 * Format bytes in human-readable format
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export function formatBytes(col: Expr, precision: number = 2): SQLExpression<string> {
    return sql<string>`formatBytes(${col}, ${precision})`;
}

/**
 * Format percentage
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export function formatPercentage(col: Expr, precision: number = 2): SQLExpression<string> {
    return sql<string>`formatPercentage(${col}, ${precision})`;
}
