import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

type Expr<T = any> = ClickHouseColumn<T, any, any> | SQLExpression<T>;

// =============================================================================
// JSON EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract string value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.name', '$.items[0].price')
 */
export function jsonExtractString(col: Expr, path: string): SQLExpression<string> {
    return sql<string>`JSONExtractString(${col}, ${path})`;
}

/**
 * Extract integer value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.age', '$.count')
 */
export function jsonExtractInt(col: Expr, path: string): SQLExpression<number> {
    return sql<number>`JSONExtractInt(${col}, ${path})`;
}

/**
 * Extract float value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.score', '$.price')
 */
export function jsonExtractFloat(col: Expr, path: string): SQLExpression<number> {
    return sql<number>`JSONExtractFloat(${col}, ${path})`;
}

/**
 * Extract boolean value from JSON
 * @param col - JSON column or expression
 * @param path - JSONPath expression (e.g., 'user.active', '$.enabled')
 */
export function jsonExtractBool(col: Expr, path: string): SQLExpression<boolean> {
    return sql<boolean>`JSONExtractBool(${col}, ${path})`;
}

/**
 * Generic JSON extraction with type specification
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param type - ClickHouse type literal (e.g., 'String', 'Int', 'Float', 'Bool', 'Array(String)')
 */
export function jsonExtract(col: Expr, path: string, type: string): SQLExpression<any> {
    return sql<any>`JSONExtract(${col}, ${path}, '${type}')`;
}

/**
 * Extract raw JSON value as string
 * Useful when you want to preserve the JSON structure
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export function jsonExtractRaw(col: Expr, path: string): SQLExpression<string> {
    return sql<string>`JSONExtractRaw(${col}, ${path})`;
}

// =============================================================================
// JSON INSPECTION FUNCTIONS
// =============================================================================

/**
 * Check if JSON has a specific path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export function jsonHas(col: Expr, path: string): SQLExpression<boolean> {
    return sql<boolean>`JSONHas(${col}, ${path})`;
}

/**
 * Extract all keys from JSON object at specified path
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export function jsonExtractKeys(col: Expr, path?: string): SQLExpression<any> {
    if (path) {
        return sql`JSONKeys(${col}, ${path})`;
    }
    return sql`JSONKeys(${col})`;
}

/**
 * Extract all values from JSON object at specified path
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export function jsonExtractValues(col: Expr, path?: string): SQLExpression<any> {
    if (path) {
        return sql`JSONValues(${col}, ${path})`;
    }
    return sql`JSONValues(${col})`;
}

/**
 * Extract keys and values as tuples from JSON object
 * Useful for introspecting JSON blobs
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export function jsonExtractKeysAndValues(col: Expr, path?: string): SQLExpression<any> {
    if (path) {
        return sql`JSONKeysAndValues(${col}, ${path})`;
    }
    return sql`JSONKeysAndValues(${col})`;
}

/**
 * Get the length of JSON array or object
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export function jsonLength(col: Expr, path?: string): SQLExpression<number> {
    if (path) {
        return sql<number>`JSONLength(${col}, ${path})`;
    }
    return sql<number>`JSONLength(${col})`;
}

/**
 * Get the type of JSON value at specified path
 * Returns: 'null', 'bool', 'number', 'string', 'array', 'object'
 * @param col - JSON column or expression
 * @param path - JSONPath expression (optional, defaults to root)
 */
export function jsonType(col: Expr, path?: string): SQLExpression<string> {
    if (path) {
        return sql<string>`JSONType(${col}, ${path})`;
    }
    return sql<string>`JSONType(${col})`;
}

// =============================================================================
// JSON MODIFICATION FUNCTIONS
// =============================================================================

/**
 * Insert value into JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param value - Value to insert
 */
export function jsonInsert(col: Expr, path: string, value: any): SQLExpression<any> {
    return sql<any>`JSONInsert(${col}, ${path}, ${value})`;
}

/**
 * Replace value in JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param value - Value to replace with
 */
export function jsonReplace(col: Expr, path: string, value: any): SQLExpression<any> {
    return sql<any>`JSONReplace(${col}, ${path}, ${value})`;
}

/**
 * Remove value from JSON at specified path
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export function jsonRemove(col: Expr, path: string): SQLExpression<any> {
    return sql<any>`JSONRemove(${col}, ${path})`;
}

// =============================================================================
// JSON PARSING FUNCTIONS
// =============================================================================

/**
 * Parse string as JSON
 * @param col - String column or expression containing JSON
 */
export function parseJSON(col: Expr): SQLExpression<any> {
    return sql<any>`parseJSON(${col})`;
}

/**
 * Parse string as JSONBestEffort (more tolerant)
 * @param col - String column or expression containing JSON
 */
export function parseJSONBestEffort(col: Expr): SQLExpression<any> {
    return sql<any>`parseJSONBestEffort(${col})`;
}

/**
 * Convert JSON to string
 * @param col - JSON column or expression
 */
export function jsonStringify(col: Expr): SQLExpression<string> {
    return sql<string>`JSONString(${col})`;
}

// =============================================================================
// JSON ARRAY FUNCTIONS
// =============================================================================

/**
 * Extract JSON array as ClickHouse array
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 * @param type - ClickHouse type for array elements (e.g., 'String', 'Int')
 */
export function jsonArrayExtract(col: Expr, path: string, type: string): SQLExpression<any> {
    return sql<any>`JSONArrayExtract(${col}, ${path}, '${type}')`;
}

/**
 * Get length of JSON array
 * @param col - JSON column or expression
 * @param path - JSONPath expression
 */
export function jsonArrayLength(col: Expr, path: string): SQLExpression<number> {
    return sql<number>`JSONArrayLength(${col}, ${path})`;
}
