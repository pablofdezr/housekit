import { ClickHouseColumn } from '../core';
import { sql, SQLExpression } from '../expressions';

// =============================================================================
// DISTANCE FUNCTIONS
// =============================================================================

/**
 * Calculate great circle distance between two points using Haversine formula
 * @param point1 - First point (longitude, latitude)
 * @param point2 - Second point (longitude, latitude)
 * @param unit - Distance unit ('km' or 'mi')
 */
export function geoDistance(
    point1: ClickHouseColumn | SQLExpression,
    point2: ClickHouseColumn | SQLExpression,
    unit: 'km' | 'mi' = 'km'
): SQLExpression {
    if (unit === 'mi') {
        return sql`greatCircleDistance(${point1}, ${point2}) * 0.621371`;
    }
    return sql`greatCircleDistance(${point1}, ${point2})`;
}

/**
 * Calculate great circle distance between two points (ClickHouse native)
 * @param point1 - First point (longitude, latitude)
 * @param point2 - Second point (longitude, latitude)
 */
export function greatCircleDistance(
    point1: ClickHouseColumn | SQLExpression,
    point2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`greatCircleDistance(${point1}, ${point2})`;
}

/**
 * Calculate distance between two points using Euclidean distance
 * @param point1 - First point (x, y)
 * @param point2 - Second point (x, y)
 */
export function euclideanDistance(
    point1: ClickHouseColumn | SQLExpression,
    point2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`sqrt(pow(${point1}.1 - ${point2}.1, 2) + pow(${point1}.2 - ${point2}.2, 2))`;
}

/**
 * Calculate Manhattan distance between two points
 * @param point1 - First point (x, y)
 * @param point2 - Second point (x, y)
 */
export function manhattanDistance(
    point1: ClickHouseColumn | SQLExpression,
    point2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`abs(${point1}.1 - ${point2}.1) + abs(${point1}.2 - ${point2}.2)`;
}

// =============================================================================
// POINT CREATION AND MANIPULATION
// =============================================================================

/**
 * Create a point from longitude and latitude
 * @param longitude - Longitude coordinate
 * @param latitude - Latitude coordinate
 */
export function geoPoint(
    longitude: ClickHouseColumn | SQLExpression | number,
    latitude: ClickHouseColumn | SQLExpression | number
): SQLExpression {
    return sql`(${longitude}, ${latitude})`;
}

/**
 * Extract longitude from point
 * @param point - Point column or expression
 */
export function geoLongitude(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${point}.1`;
}

/**
 * Extract latitude from point
 * @param point - Point column or expression
 */
export function geoLatitude(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${point}.2`;
}

/**
 * Extract x coordinate from point
 * @param point - Point column or expression
 */
export function geoX(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${point}.1`;
}

/**
 * Extract y coordinate from point
 * @param point - Point column or expression
 */
export function geoY(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`${point}.2`;
}

// =============================================================================
// GEOMETRY RELATIONSHIPS
// =============================================================================

/**
 * Check if point is within polygon
 * @param point - Point to check
 * @param polygon - Polygon to check against
 */
export function pointInPolygon(
    point: ClickHouseColumn | SQLExpression,
    polygon: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`pointInPolygon(${point}, ${polygon})`;
}

/**
 * Check if polygon contains another polygon
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon
 */
export function polygonContains(
    polygon1: ClickHouseColumn | SQLExpression,
    polygon2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`polygonContains(${polygon1}, ${polygon2})`;
}

/**
 * Check if two polygons intersect
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon
 */
export function polygonsIntersect(
    polygon1: ClickHouseColumn | SQLExpression,
    polygon2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`polygonsIntersect(${polygon1}, ${polygon2})`;
}

// =============================================================================
// BOUNDING BOX FUNCTIONS
// =============================================================================

/**
 * Create a bounding box from two points (bottom-left and top-right)
 * @param point1 - Bottom-left point
 * @param point2 - Top-right point
 */
export function boundingBox(
    point1: ClickHouseColumn | SQLExpression,
    point2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`boundingBox(${point1}, ${point2})`;
}

/**
 * Check if point is within bounding box
 * @param point - Point to check
 * @param bbox - Bounding box
 */
export function pointInBoundingBox(
    point: ClickHouseColumn | SQLExpression,
    bbox: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`pointInBoundingBox(${point}, ${bbox})`;
}

/**
 * Get the minimum point of a bounding box
 * @param bbox - Bounding box
 */
export function bboxMin(bbox: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`bboxMin(${bbox})`;
}

/**
 * Get the maximum point of a bounding box
 * @param bbox - Bounding box
 */
export function bboxMax(bbox: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`bboxMax(${bbox})`;
}

// =============================================================================
// POLYGON OPERATIONS
// =============================================================================

/**
 * Calculate area of a polygon
 * @param polygon - Polygon column or expression
 */
export function polygonArea(polygon: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`polygonArea(${polygon})`;
}

/**
 * Calculate perimeter of a polygon
 * @param polygon - Polygon column or expression
 */
export function polygonPerimeter(polygon: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`polygonPerimeter(${polygon})`;
}

/**
 * Get the centroid of a polygon
 * @param polygon - Polygon column or expression
 */
export function polygonCentroid(polygon: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`polygonCentroid(${polygon})`;
}

/**
 * Simplify a polygon (reduce number of points)
 * @param polygon - Polygon to simplify
 * @param epsilon - Simplification tolerance
 */
export function polygonSimplify(
    polygon: ClickHouseColumn | SQLExpression,
    epsilon: number
): SQLExpression {
    return sql`polygonSimplify(${polygon}, ${epsilon})`;
}

/**
 * Buffer a polygon (expand/contract by distance)
 * @param polygon - Polygon to buffer
 * @param distance - Buffer distance
 */
export function polygonBuffer(
    polygon: ClickHouseColumn | SQLExpression,
    distance: number
): SQLExpression {
    return sql`polygonBuffer(${polygon}, ${distance})`;
}

// =============================================================================
// GEOHASH FUNCTIONS
// =============================================================================

/**
 * Encode a point as geohash
 * @param point - Point to encode
 * @param precision - Geohash precision (1-12)
 */
export function geoHashEncode(
    point: ClickHouseColumn | SQLExpression,
    precision: number = 10
): SQLExpression {
    return sql`geoHashEncode(${point}, ${precision})`;
}

/**
 * Decode a geohash to a point
 * @param geohash - Geohash string to decode
 */
export function geoHashDecode(geohash: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`geoHashDecode(${geohash})`;
}

/**
 * Get neighbors of a geohash
 * @param geohash - Geohash string
 */
export function geoHashNeighbors(geohash: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`geoHashNeighbors(${geohash})`;
}

/**
 * Check if two geohashes are neighbors
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 */
export function geoHashAreNeighbors(
    geohash1: ClickHouseColumn | SQLExpression,
    geohash2: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`geoHashAreNeighbors(${geohash1}, ${geohash2})`;
}

// =============================================================================
// CLUSTERING AND SPATIAL INDEXING
// =============================================================================

/**
 * Find points within radius of a center point
 * @param center - Center point
 * @param radius - Search radius
 * @param points - Points to search
 */
export function pointsWithinRadius(
    center: ClickHouseColumn | SQLExpression,
    radius: number,
    points: ClickHouseColumn | SQLExpression
): SQLExpression {
    return sql`arrayFilter(x -> greatCircleDistance(${center}, x) <= ${radius}, ${points})`;
}

/**
 * Find nearest neighbors to a point
 * @param point - Reference point
 * @param points - Array of points to search
 * @param k - Number of neighbors to find
 */
export function nearestNeighbors(
    point: ClickHouseColumn | SQLExpression,
    points: ClickHouseColumn | SQLExpression,
    k: number
): SQLExpression {
    return sql`arraySlice(arraySort(x -> greatCircleDistance(${point}, x), ${points}), 1, ${k})`;
}

/**
 * Cluster points using k-means
 * @param points - Array of points to cluster
 * @param k - Number of clusters
 */
export function kMeansClustering(
    points: ClickHouseColumn | SQLExpression,
    k: number
): SQLExpression {
    return sql`kMeans(${points}, ${k})`;
}

// =============================================================================
// COORDINATE SYSTEM CONVERSIONS
// =============================================================================

/**
 * Convert degrees to radians
 * @param degrees - Degrees value
 */
export function degreesToRadians(degrees: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`radians(${degrees})`;
}

/**
 * Convert radians to degrees
 * @param radians - Radians value
 */
export function radiansToDegrees(radians: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`degrees(${radians})`;
}

/**
 * Convert Web Mercator to WGS84
 * @param point - Point in Web Mercator coordinates
 */
export function webMercatorToWGS84(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`webMercatorToWGS84(${point})`;
}

/**
 * Convert WGS84 to Web Mercator
 * @param point - Point in WGS84 coordinates
 */
export function wGS84ToWebMercator(point: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`wGS84ToWebMercator(${point})`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a geometry is valid
 * @param geometry - Geometry to validate
 */
export function isValidGeometry(geometry: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`isValidGeometry(${geometry})`;
}

/**
 * Get the geometry type
 * @param geometry - Geometry column or expression
 */
export function geometryType(geometry: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`geometryType(${geometry})`;
}

/**
 * Get the number of points in a geometry
 * @param geometry - Geometry column or expression
 */
export function geometryNumPoints(geometry: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`geometryNumPoints(${geometry})`;
}

/**
 * Get the number of interior rings in a polygon
 * @param polygon - Polygon column or expression
 */
export function polygonNumInteriorRings(polygon: ClickHouseColumn | SQLExpression): SQLExpression {
    return sql`polygonNumInteriorRings(${polygon})`;
}