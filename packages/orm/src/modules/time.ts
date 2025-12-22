import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

// =============================================================================
// TIME-SERIES HELPERS
// =============================================================================

/**
 * Get current timestamp
 */
export function timeNow(): SQLExpression {
    return sql`now()`;
}

/**
 * Get current date (without time)
 */
export function timeToday(): SQLExpression {
    return sql`today()`;
}

/**
 * Get yesterday's date (without time)
 */
export function timeYesterday(): SQLExpression {
    return sql`yesterday()`;
}

// =============================================================================
// DATE CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert to Date type (without time)
 * @param col - Date/datetime column or expression
 */
export function timeToDate(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toDate(${col})`;
}

/**
 * Convert to DateTime type
 * @param col - Date/datetime column or expression
 */
export function timeToDateTime(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toDateTime(${col})`;
}

/**
 * Convert to Unix timestamp (super common in time-series analytics)
 * @param col - DateTime column or expression
 */
export function toUnixTimestamp(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toUnixTimestamp(${col})`;
}

/**
 * Format datetime to string
 * @param col - DateTime column or expression
 * @param format - Format string (e.g., '%Y-%m-%d %H:%M:%S')
 */
export function timeFormatDateTime(col: ClickHouseColumn | SQLExpression, format: string): SQLExpression {
    return sql`formatDateTime(${col}, '${format}')`;
}

// =============================================================================
// DATE TRUNCATION FUNCTIONS
// =============================================================================

/**
 * Truncate to start of hour
 * @param col - DateTime column or expression
 */
export function timeToStartOfHour(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfHour(${col})`;
}

/**
 * Truncate to start of day
 * @param col - DateTime column or expression
 */
export function timeToStartOfDay(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfDay(${col})`;
}

/**
 * Truncate to start of week
 * @param col - DateTime column or expression
 */
export function timeToStartOfWeek(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfWeek(${col})`;
}

/**
 * Truncate to start of month
 * @param col - DateTime column or expression
 */
export function timeToStartOfMonth(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfMonth(${col})`;
}

/**
 * Truncate to start of quarter
 * @param col - DateTime column or expression
 */
export function toStartOfQuarter(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfQuarter(${col})`;
}

/**
 * Truncate to start of year
 * @param col - DateTime column or expression
 */
export function toStartOfYear(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toStartOfYear(${col})`;
}

/**
 * Truncate to start of interval (very flexible for custom time buckets)
 * @param col - DateTime column or expression
 * @param interval - Interval string (e.g., 'INTERVAL 1 HOUR', 'INTERVAL 15 MINUTE')
 * @param timezone - Optional timezone
 */
export function toStartOfInterval(
    col: ClickHouseColumn | SQLExpression, 
    interval: string,
    timezone?: string
): SQLExpression {
    if (timezone) {
        return sql`toStartOfInterval(${col}, ${interval}, '${timezone}')`;
    }
    return sql`toStartOfInterval(${col}, ${interval})`;
}

// =============================================================================
// DATE ARITHMETIC FUNCTIONS
// =============================================================================

/**
 * Calculate difference between two dates
 * @param unit - Unit of difference ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param start - Start date
 * @param end - End date
 */
export function dateDiff(
    unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second',
    start: ClickHouseColumn | SQLExpression,
    end: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`dateDiff('${unit}', ${start}, ${end})`;
}

/**
 * Add interval to date
 * @param unit - Unit to add ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param amount - Amount to add
 * @param date - Date to add to
 */
export function dateAdd(
    unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second',
    amount: number,
    date: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`dateAdd(${unit}, ${amount}, ${date})`;
}

/**
 * Subtract interval from date
 * @param unit - Unit to subtract ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param amount - Amount to subtract
 * @param date - Date to subtract from
 */
export function dateSub(
    unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second',
    amount: number,
    date: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`dateSub(${unit}, ${amount}, ${date})`;
}

// =============================================================================
// TIME ZONE FUNCTIONS
// =============================================================================

/**
 * Convert datetime to different timezone
 * @param col - DateTime column or expression
 * @param timezone - Target timezone
 */
export function toTimezone(col: ClickHouseColumn | SQLExpression, timezone: string): SQLExpression {
    return sql`toTimezone(${col}, '${timezone}')`;
}

/**
 * Get timezone offset for datetime
 * @param col - DateTime column or expression
 */
export function timeOffset(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`timeOffset(${col})`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract year from date
 * @param col - Date/datetime column or expression
 */
export function toYear(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toYear(${col})`;
}

/**
 * Extract quarter from date
 * @param col - Date/datetime column or expression
 */
export function toQuarter(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toQuarter(${col})`;
}

/**
 * Extract month from date
 * @param col - Date/datetime column or expression
 */
export function toMonth(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toMonth(${col})`;
}

/**
 * Extract day of month from date
 * @param col - Date/datetime column or expression
 */
export function toDayOfMonth(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toDayOfMonth(${col})`;
}

/**
 * Extract day of week from date
 * @param col - Date/datetime column or expression
 */
export function toDayOfWeek(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toDayOfWeek(${col})`;
}

/**
 * Extract hour from datetime
 * @param col - DateTime column or expression
 */
export function toHour(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toHour(${col})`;
}

/**
 * Extract minute from datetime
 * @param col - DateTime column or expression
 */
export function toMinute(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toMinute(${col})`;
}

/**
 * Extract second from datetime
 * @param col - DateTime column or expression
 */
export function toSecond(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toSecond(${col})`;
}

/**
 * Get ISO week number from date
 * @param col - Date/datetime column or expression
 */
export function toISOWeek(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toISOWeek(${col})`;
}

/**
 * Get week number from date (ClickHouse-specific)
 * @param col - Date/datetime column or expression
 */
export function toWeek(col: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`toWeek(${col})`;
}