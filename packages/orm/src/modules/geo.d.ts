import { ClickHouseColumn } from '../core';
import { SQLExpression } from '../expressions';
/**
 * Calculate great circle distance between two points using Haversine formula
 * @param point1 - First point (longitude, latitude)
 * @param point2 - Second point (longitude, latitude)
 * @param unit - Distance unit ('km' or 'mi')
 */
export declare function geoDistance(point1: ClickHouseColumn | SQLExpression, point2: ClickHouseColumn | SQLExpression, unit?: 'km' | 'mi'): SQLExpression;
/**
 * Calculate great circle distance between two points (ClickHouse native)
 * @param point1 - First point (longitude, latitude)
 * @param point2 - Second point (longitude, latitude)
 */
export declare function greatCircleDistance(point1: ClickHouseColumn | SQLExpression, point2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Calculate distance between two points using Euclidean distance
 * @param point1 - First point (x, y)
 * @param point2 - Second point (x, y)
 */
export declare function euclideanDistance(point1: ClickHouseColumn | SQLExpression, point2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Calculate Manhattan distance between two points
 * @param point1 - First point (x, y)
 * @param point2 - Second point (x, y)
 */
export declare function manhattanDistance(point1: ClickHouseColumn | SQLExpression, point2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Create a point from longitude and latitude
 * @param longitude - Longitude coordinate
 * @param latitude - Latitude coordinate
 */
export declare function geoPoint(longitude: ClickHouseColumn | SQLExpression | number, latitude: ClickHouseColumn | SQLExpression | number): SQLExpression;
/**
 * Extract longitude from point
 * @param point - Point column or expression
 */
export declare function geoLongitude(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract latitude from point
 * @param point - Point column or expression
 */
export declare function geoLatitude(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract x coordinate from point
 * @param point - Point column or expression
 */
export declare function geoX(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Extract y coordinate from point
 * @param point - Point column or expression
 */
export declare function geoY(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if point is within polygon
 * @param point - Point to check
 * @param polygon - Polygon to check against
 */
export declare function pointInPolygon(point: ClickHouseColumn | SQLExpression, polygon: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if polygon contains another polygon
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon
 */
export declare function polygonContains(polygon1: ClickHouseColumn | SQLExpression, polygon2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if two polygons intersect
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon
 */
export declare function polygonsIntersect(polygon1: ClickHouseColumn | SQLExpression, polygon2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Create a bounding box from two points (bottom-left and top-right)
 * @param point1 - Bottom-left point
 * @param point2 - Top-right point
 */
export declare function boundingBox(point1: ClickHouseColumn | SQLExpression, point2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if point is within bounding box
 * @param point - Point to check
 * @param bbox - Bounding box
 */
export declare function pointInBoundingBox(point: ClickHouseColumn | SQLExpression, bbox: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the minimum point of a bounding box
 * @param bbox - Bounding box
 */
export declare function bboxMin(bbox: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the maximum point of a bounding box
 * @param bbox - Bounding box
 */
export declare function bboxMax(bbox: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Calculate area of a polygon
 * @param polygon - Polygon column or expression
 */
export declare function polygonArea(polygon: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Calculate perimeter of a polygon
 * @param polygon - Polygon column or expression
 */
export declare function polygonPerimeter(polygon: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the centroid of a polygon
 * @param polygon - Polygon column or expression
 */
export declare function polygonCentroid(polygon: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Simplify a polygon (reduce number of points)
 * @param polygon - Polygon to simplify
 * @param epsilon - Simplification tolerance
 */
export declare function polygonSimplify(polygon: ClickHouseColumn | SQLExpression, epsilon: number): SQLExpression;
/**
 * Buffer a polygon (expand/contract by distance)
 * @param polygon - Polygon to buffer
 * @param distance - Buffer distance
 */
export declare function polygonBuffer(polygon: ClickHouseColumn | SQLExpression, distance: number): SQLExpression;
/**
 * Encode a point as geohash
 * @param point - Point to encode
 * @param precision - Geohash precision (1-12)
 */
export declare function geoHashEncode(point: ClickHouseColumn | SQLExpression, precision?: number): SQLExpression;
/**
 * Decode a geohash to a point
 * @param geohash - Geohash string to decode
 */
export declare function geoHashDecode(geohash: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get neighbors of a geohash
 * @param geohash - Geohash string
 */
export declare function geoHashNeighbors(geohash: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if two geohashes are neighbors
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 */
export declare function geoHashAreNeighbors(geohash1: ClickHouseColumn | SQLExpression, geohash2: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Find points within radius of a center point
 * @param center - Center point
 * @param radius - Search radius
 * @param points - Points to search
 */
export declare function pointsWithinRadius(center: ClickHouseColumn | SQLExpression, radius: number, points: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Find nearest neighbors to a point
 * @param point - Reference point
 * @param points - Array of points to search
 * @param k - Number of neighbors to find
 */
export declare function nearestNeighbors(point: ClickHouseColumn | SQLExpression, points: ClickHouseColumn | SQLExpression, k: number): SQLExpression;
/**
 * Cluster points using k-means
 * @param points - Array of points to cluster
 * @param k - Number of clusters
 */
export declare function kMeansClustering(points: ClickHouseColumn | SQLExpression, k: number): SQLExpression;
/**
 * Convert degrees to radians
 * @param degrees - Degrees value
 */
export declare function degreesToRadians(degrees: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert radians to degrees
 * @param radians - Radians value
 */
export declare function radiansToDegrees(radians: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert Web Mercator to WGS84
 * @param point - Point in Web Mercator coordinates
 */
export declare function webMercatorToWGS84(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Convert WGS84 to Web Mercator
 * @param point - Point in WGS84 coordinates
 */
export declare function wGS84ToWebMercator(point: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Check if a geometry is valid
 * @param geometry - Geometry to validate
 */
export declare function isValidGeometry(geometry: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the geometry type
 * @param geometry - Geometry column or expression
 */
export declare function geometryType(geometry: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the number of points in a geometry
 * @param geometry - Geometry column or expression
 */
export declare function geometryNumPoints(geometry: ClickHouseColumn | SQLExpression): SQLExpression;
/**
 * Get the number of interior rings in a polygon
 * @param polygon - Polygon column or expression
 */
export declare function polygonNumInteriorRings(polygon: ClickHouseColumn | SQLExpression): SQLExpression;
