import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;
/**
 * Extract string value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.name', '$.items[0].price')
 */
export declare function jsonExtractString(col: Expr, path: string): SQLExpression<string>;
/**
 * Extract integer value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.age', '$.count')
 */
export declare function jsonExtractInt(col: Expr, path: string): SQLExpression<number>;
/**
 * Extract float value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.score', '$.price')
 */
export declare function jsonExtractFloat(col: Expr, path: string): SQLExpression<number>;
/**
 * Extract boolean value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.active', '$.enabled')
 */
export declare function jsonExtractBool(col: Expr, path: string): SQLExpression<boolean>;
/**
 * Generic JSON extraction with type specification
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param type - ClickHouse type literal (e.g., 'String', 'Int', 'Float', 'Bool', 'Array(String)')
 */
export declare function jsonExtract(col: Expr, path: string, type: string): SQLExpression<any>;
/**
 * Extract raw JSON value as string
 * Useful when you want to preserve the JSON structure
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export declare function jsonExtractRaw(col: Expr, path: string): SQLExpression<string>;
/**
 * Check if JSON has a specific path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export declare function jsonHas(col: Expr, path: string): SQLExpression<boolean>;
/**
 * Extract all keys from JSON object at specified path
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export declare function jsonExtractKeys(col: Expr, path?: string): SQLExpression<any>;
/**
 * Extract all values from JSON object at specified path
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export declare function jsonExtractValues(col: Expr, path?: string): SQLExpression<any>;
/**
 * Extract keys and values as tuples from JSON object
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export declare function jsonExtractKeysAndValues(col: Expr, path?: string): SQLExpression<any>;
/**
 * Get the length of JSON array or object
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export declare function jsonLength(col: Expr, path?: string): SQLExpression<number>;
/**
 * Get the type of JSON value at specified path
 * Returns: 'null', 'bool', 'number', 'string', 'array', 'object'
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export declare function jsonType(col: Expr, path?: string): SQLExpression<string>;
/**
 * Insert value into JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param value - Value to insert
 */
export declare function jsonInsert(col: Expr, path: string, value: any): SQLExpression<any>;
/**
 * Replace value in JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param value - Value to replace with
 */
export declare function jsonReplace(col: Expr, path: string, value: any): SQLExpression<any>;
/**
 * Remove value from JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export declare function jsonRemove(col: Expr, path: string): SQLExpression<any>;
/**
 * Parse string as JSON
 * @param col - String column or expression containing JSON
 */
export declare function parseJSON(col: Expr): SQLExpression<any>;
/**
 * Parse string as JSONBestEffort (more tolerant)
 * @param col - String column or expression containing JSON
 */
export declare function parseJSONBestEffort(col: Expr): SQLExpression<any>;
/**
 * Convert JSON to string
 * @param col - JSON column or expression
 */
export declare function jsonStringify(col: Expr): SQLExpression<string>;
/**
 * Extract JSON array as ClickHouse array
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param type - ClickHouse type for array elements (e.g., 'String', 'Int')
 */
export declare function jsonArrayExtract(col: Expr, path: string, type: string): SQLExpression<any>;
/**
 * Get length of JSON array
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export declare function jsonArrayLength(col: Expr, path: string): SQLExpression<number>;
export {};
