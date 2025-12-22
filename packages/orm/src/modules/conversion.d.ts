import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;
/**
 * Convert to string
 * @param col - Column or expression to convert
 */
export declare function toString(col: Expr): SQLExpression<string>;
export declare function toInt32(col: Expr): SQLExpression<number>;
/**
 * Convert to integer (alias for toInt32)
 */
export declare const toInteger: typeof toInt32;
/**
 * Convert to 64-bit integer
 * @param col - Column or expression to convert
 */
export declare function toInt64(col: Expr): SQLExpression<number>;
/**
 * Convert to 32-bit unsigned integer
 * @param col - Column or expression to convert
 */
export declare function toUInt32(col: Expr): SQLExpression<number>;
/**
 * Convert to 64-bit unsigned integer
 * @param col - Column or expression to convert
 */
export declare function toUInt64(col: Expr): SQLExpression<number>;
/**
 * Convert to 32-bit float
 * @param col - Column or expression to convert
 */
export declare function toFloat32(col: Expr): SQLExpression<number>;
/**
 * Convert to 64-bit float
 * @param col - Column or expression to convert
 */
export declare function toFloat64(col: Expr): SQLExpression<number>;
export declare function toBool(col: Expr): SQLExpression<boolean>;
/**
 * Convert to boolean (alias for toBool)
 */
export declare const toBoolean: typeof toBool;
/**
 * Convert to UUID
 * @param col - Column or expression to convert
 */
export declare function toUUID(col: Expr): SQLExpression<string>;
/**
 * Convert to Date type (without time)
 * @param col - Column or expression to convert
 */
export declare function toDate(col: Expr): SQLExpression<string>;
export declare function toDateTime(col: Expr): SQLExpression<string>;
/**
 * Convert to timestamp (alias for toDateTime)
 */
export declare const toTimestamp: typeof toDateTime;
/**
 * Convert to DateTime64 type
 * @param col - Column or expression to convert
 * @param precision - DateTime precision (default: 3)
 */
export declare function toDateTime64(col: Expr, precision?: number): SQLExpression<string>;
/**
 * Convert to lowercase
 * @param col - Column or expression to convert
 */
export declare function toLowercase(col: Expr): SQLExpression<string>;
/**
 * Convert to uppercase
 * @param col - Column or expression to convert
 */
export declare function toUppercase(col: Expr): SQLExpression<string>;
/**
 * Convert to title case (first letter uppercase, rest lowercase)
 * @param col - Column or expression to convert
 */
export declare function toTitleCase(col: Expr): SQLExpression<string>;
/**
 * Trim whitespace from string
 * @param col - Column or expression to trim
 */
export declare function convertTrim(col: Expr): SQLExpression<string>;
/**
 * Trim left whitespace
 * @param col - Column or expression to trim
 */
export declare function convertTrimLeft(col: Expr): SQLExpression<string>;
/**
 * Trim right whitespace
 * @param col - Column or expression to trim
 */
export declare function convertTrimRight(col: Expr): SQLExpression<string>;
/**
 * Left pad string
 * @param col - Column or expression to pad
 * @param length - Target length
 * @param fill - Fill character (default: space)
 */
export declare function leftPad(col: Expr, length: number, fill?: string): SQLExpression<string>;
/**
 * Right pad string
 * @param col - Column or expression to pad
 * @param length - Target length
 * @param fill - Fill character (default: space)
 */
export declare function rightPad(col: Expr, length: number, fill?: string): SQLExpression<string>;
/**
 * Convert to hexadecimal string
 * @param col - Column or expression to convert
 */
export declare function toHex(col: Expr): SQLExpression<string>;
/**
 * Convert from hexadecimal string
 * @param col - Column or expression to convert
 */
export declare function fromHex(col: Expr): SQLExpression<string>;
/**
 * Convert to base64 string
 * @param col - Column or expression to convert
 */
export declare function toBase64(col: Expr): SQLExpression<string>;
/**
 * Convert from base64 string
 * @param col - Column or expression to convert
 */
export declare function fromBase64(col: Expr): SQLExpression<string>;
/**
 * Convert to binary string
 * @param col - Column or expression to convert
 */
export declare function toBin(col: Expr): SQLExpression<string>;
/**
 * Convert from binary string
 * @param col - Column or expression to convert
 */
export declare function fromBin(col: Expr): SQLExpression<string>;
/**
 * URL encode string
 * @param col - Column or expression to encode
 */
export declare function urlEncode(col: Expr): SQLExpression<string>;
/**
 * URL decode string
 * @param col - Column or expression to decode
 */
export declare function urlDecode(col: Expr): SQLExpression<string>;
/**
 * HTML escape string
 * @param col - Column or expression to escape
 */
export declare function htmlEscape(col: Expr): SQLExpression<string>;
/**
 * HTML unescape string
 * @param col - Column or expression to unescape
 */
export declare function htmlUnescape(col: Expr): SQLExpression<string>;
/**
 * Format number with specified decimal places
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export declare function formatDecimal(col: Expr, precision: number): SQLExpression<string>;
/**
 * Format number in human-readable format
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export declare function formatReadableDecimal(col: Expr, precision: number): SQLExpression<string>;
/**
 * Format number with specified number of digits
 * @param col - Column or expression to format
 * @param digits - Total number of digits
 */
export declare function formatNumber(col: Expr, digits: number): SQLExpression<string>;
/**
 * Format bytes in human-readable format
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export declare function formatBytes(col: Expr, precision?: number): SQLExpression<string>;
/**
 * Format percentage
 * @param col - Column or expression to format
 * @param precision - Number of decimal places
 */
export declare function formatPercentage(col: Expr, precision?: number): SQLExpression<string>;
export {};
