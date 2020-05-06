import GeometryType from 'ol/geom/GeometryType'
import { fromLonLat, toLonLat, transform as baseTransform, transformExtent as baseTransformExtent } from 'ol/proj'
import { COORD_PRECISION, roundCoords, roundExtent } from './coord'

export const EPSG_4326 = 'EPSG:4326'
export const EPSG_3857 = 'EPSG:3857'

/**
 * @param {number[]} coordinate
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Coordinate|number[]}
 */
export function pointToLonLat (
  coordinate,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return roundCoords(GeometryType.POINT, toLonLat(coordinate, projection), precision)
}

/**
 * @param {number[]} coordinate
 * @param {module:ol/proj.ProjectionLike} [projection]
 * @param {number} [precision=COORD_PRECISION]
 * @return {number[]}
 */
export function pointFromLonLat (
  coordinate,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return roundCoords(GeometryType.POINT, fromLonLat(coordinate, projection), precision)
}

/**
 * @param {number[]} coordinate
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @returns {number[]}
 */
export function transformPoint (
  coordinate,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return transform(coordinate, sourceProjection, destProjection, precision)
}

/**
 * @param {number[]} coordinate
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @returns {number[]}
 */
export function transform (
  coordinate,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return roundCoords(GeometryType.POINT, baseTransform(coordinate, sourceProjection, destProjection), precision)
}

/**
 * @param {Array<number[]>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<number[]>}
 */
export function lineToLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => pointToLonLat(point, projection, precision))
}

/**
 * @param {Array<number[]>} coordinates
 * @param {ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<number[]>}
 */
export function lineFromLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => pointFromLonLat(point, projection, precision))
}

/**
 * @param {Array<number[]>} coordinates
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @returns {number[]}
 */
export function transformLine (
  coordinates,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => transformPoint(point, sourceProjection, destProjection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<number[]>>}
 */
export function polygonToLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => lineToLonLat(line, projection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<number[]>>}
 */
export function polygonFromLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => lineFromLonLat(line, projection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @returns {*}
 */
export function transformPolygon (
  coordinates,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => transformLine(line, sourceProjection, destProjection, precision))
}

/**
 * @param {Array<number[]>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<number[]>}
 */
export function multiPointToLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => pointToLonLat(point, projection, precision))
}

/**
 * @param {Array<number[]>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<number[]>}
 */
export function multiPointFromLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => pointFromLonLat(point, projection, precision))
}

/**
 * @param {Array<number[]>} coordinates
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<number[]>}
 */
export function transformMultiPoint (
  coordinates,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return coordinates.map(point => transformPoint(point, sourceProjection, destProjection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<number[]>>}
 */
export function multiLineToLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => lineToLonLat(line, projection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<number[]>>}
 */
export function multiLineFromLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => lineFromLonLat(line, projection, precision))
}

/**
 * @param {Array<Array<number[]>>} coordinates
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<number[]>>}
 */
export function transformMultiLine (
  coordinates,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return coordinates.map(line => transformLine(line, sourceProjection, destProjection, precision))
}

/**
 * @param {Array<Array<Array<number[]>>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<Array<number[]>>>}
 */
export function multiPolygonToLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(polygon => polygonToLonLat(polygon, projection, precision))
}

/**
 * @param {Array<Array<Array<number[]>>>} coordinates
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG_3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<Array<number[]>>>}
 */
export function multiPolygonFromLonLat (
  coordinates,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return coordinates.map(polygon => polygonFromLonLat(polygon, projection, precision))
}

/**
 * @param {Array<Array<Array<number[]>>>} coordinates
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @return {Array<Array<Array<number[]>>>}
 */
export function transformMultiPolygon (
  coordinates,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return coordinates.map(polygon => transformPolygon(polygon, sourceProjection, destProjection, precision))
}

/**
 * Transforms by geom type
 * @type {Object<string, function>}
 */
export const transforms = {
  [GeometryType.POINT]: {
    toLonLat: pointToLonLat,
    fromLonLat: pointFromLonLat,
    transform: transformPoint,
  },
  [GeometryType.LINE_STRING]: {
    toLonLat: lineToLonLat,
    fromLonLat: lineFromLonLat,
    transform: transformLine,
  },
  [GeometryType.POLYGON]: {
    toLonLat: polygonToLonLat,
    fromLonLat: polygonFromLonLat,
    transform: transformPolygon,
  },
  [GeometryType.MULTI_POINT]: {
    toLonLat: multiPointToLonLat,
    fromLonLat: multiPointFromLonLat,
    transform: transformMultiPoint,
  },
  [GeometryType.MULTI_LINE_STRING]: {
    toLonLat: multiLineToLonLat,
    fromLonLat: multiLineFromLonLat,
    transform: transformMultiLine,
  },
  [GeometryType.MULTI_POLYGON]: {
    toLonLat: multiPolygonToLonLat,
    fromLonLat: multiPolygonFromLonLat,
    transform: transformMultiPolygon,
  },
  [GeometryType.CIRCLE]: {
    toLonLat: pointToLonLat,
    fromLonLat: pointFromLonLat,
    transform: transformPoint,
  },
}

/**
 * @param {number[]} extent
 * @param {module:ol/proj.ProjectionLike} sourceProjection
 * @param {module:ol/proj.ProjectionLike} destProjection
 * @param {number} [precision=COORD_PRECISION]
 * @return {number[]}
 */
export function transformExtent (
  extent,
  sourceProjection,
  destProjection,
  precision = COORD_PRECISION,
) {
  return roundExtent(baseTransformExtent(extent, sourceProjection, destProjection), precision)
}

/**
 * @param {number[]} extent
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG:3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {number[]}
 */
export function extentFromLonLat (
  extent,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return transformExtent(extent, EPSG_4326, projection, precision)
}

/**
 * @param {number[]} extent
 * @param {module:ol/proj.ProjectionLike} [projection=EPSG:3857]
 * @param {number} [precision=COORD_PRECISION]
 * @return {number[]}
 */
export function extentToLonLat (
  extent,
  projection = EPSG_3857,
  precision = COORD_PRECISION,
) {
  return transformExtent(extent, projection, EPSG_4326, precision)
}
