import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Get current timestamp
 */
export declare function timeNow(): SQLExpression;
/**
 * Get current date (without time)
 */
export declare function timeToday(): SQLExpression;
/**
 * Get yesterday's date (without time)
 */
export declare function timeYesterday(): SQLExpression;
/**
 * Convert to Date type (without time)
 * @param col - Date/datetime column or expression
 */
export declare function timeToDate(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to DateTime type
 * @param col - Date/datetime column or expression
 */
export declare function timeToDateTime(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert to Unix timestamp (super common in time-series analytics)
 * @param col - DateTime column or expression
 */
export declare function toUnixTimestamp(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Format datetime to string
 * @param col - DateTime column or expression
 * @param format - Format string (e.g., '%Y-%m-%d %H:%M:%S')
 */
export declare function timeFormatDateTime(col: ClickHouseColumn | SQLExpression, format: string): SQLExpression;
/**
 * Truncate to start of hour
 * @param col - DateTime column or expression
 */
export declare function timeToStartOfHour(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of day
 * @param col - DateTime column or expression
 */
export declare function timeToStartOfDay(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of week
 * @param col - DateTime column or expression
 */
export declare function timeToStartOfWeek(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of month
 * @param col - DateTime column or expression
 */
export declare function timeToStartOfMonth(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of quarter
 * @param col - DateTime column or expression
 */
export declare function toStartOfQuarter(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of year
 * @param col - DateTime column or expression
 */
export declare function toStartOfYear(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Truncate to start of interval (very flexible for custom time buckets)
 * @param col - DateTime column or expression
 * @param interval - Interval string (e.g., 'INTERVAL 1 HOUR', 'INTERVAL 15 MINUTE')
 * @param timezone - Optional timezone
 */
export declare function toStartOfInterval(col: ClickHouseColumn | SQLExpression, interval: string, timezone?: string): SQLExpression;
/**
 * Calculate difference between two dates
 * @param unit - Unit of difference ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param start - Start date
 * @param end - End date
 */
export declare function dateDiff(unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second', start: ClickHouseColumn | SQLExpression, end: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Add interval to date
 * @param unit - Unit to add ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param amount - Amount to add
 * @param date - Date to add to
 */
export declare function dateAdd(unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second', amount: number, date: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Subtract interval from date
 * @param unit - Unit to subtract ('year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second')
 * @param amount - Amount to subtract
 * @param date - Date to subtract from
 */
export declare function dateSub(unit: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second', amount: number, date: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert datetime to different timezone
 * @param col - DateTime column or expression
 * @param timezone - Target timezone
 */
export declare function toTimezone(col: ClickHouseColumn | SQLExpression, timezone: string): SQLExpression;
/**
 * Get timezone offset for datetime
 * @param col - DateTime column or expression
 */
export declare function timeOffset(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract year from date
 * @param col - Date/datetime column or expression
 */
export declare function toYear(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract quarter from date
 * @param col - Date/datetime column or expression
 */
export declare function toQuarter(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract month from date
 * @param col - Date/datetime column or expression
 */
export declare function toMonth(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract day of month from date
 * @param col - Date/datetime column or expression
 */
export declare function toDayOfMonth(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract day of week from date
 * @param col - Date/datetime column or expression
 */
export declare function toDayOfWeek(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract hour from datetime
 * @param col - DateTime column or expression
 */
export declare function toHour(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract minute from datetime
 * @param col - DateTime column or expression
 */
export declare function toMinute(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract second from datetime
 * @param col - DateTime column or expression
 */
export declare function toSecond(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get ISO week number from date
 * @param col - Date/datetime column or expression
 */
export declare function toISOWeek(col: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get week number from date (ClickHouse-specific)
 * @param col - Date/datetime column or expression
 */
export declare function toWeek(col: ClickHouseColumn | SQLExpression): SQLExpression;
