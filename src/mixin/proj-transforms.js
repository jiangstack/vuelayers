import {
  COORD_PRECISION,
  EPSG_3857,
  getMapDataProjection,
  readGeoJsonFeature,
  readGeoJsonGeometry,
  transformExtent,
  transformLine,
  transformMultiLine,
  transformMultiPoint,
  transformMultiPolygon,
  transformPoint,
  transformPolygon,
  writeGeoJsonFeature,
  writeGeoJsonGeometry,
} from '../ol-ext'
import { coalesce } from '../util/minilo'

/**
 * Mixin with helpers for projection transforms between current view projection and global defined projection.
 */
export default {
  computed: {
    /**
     * @return {module:ol/proj~ProjectionLike}
     */
    viewProjection () {
      if (this.rev && this.$viewVm) {
        return this.$viewVm.projection
      }
      return this.projection || EPSG_3857
    },
    /**
     * @return {module:ol/proj~ProjectionLike}
     */
    resolvedDataProjection () {
      return coalesce(
        this.dataProjection, // may or may not be present
        this.projection, // may or may not be present
        this.$mapVm?.resolvedDataProjection,
        this.$map && getMapDataProjection(this.$map),
        this.$options?.dataProjection,
        this.viewProjection,
      )
    },
  },
  methods: {
    pointToViewProj (point, precision = COORD_PRECISION) {
      return transformPoint(point, this.resolvedDataProjection, this.viewProjection, precision)
    },
    pointToDataProj (point, precision = COORD_PRECISION) {
      return transformPoint(point, this.viewProjection, this.resolvedDataProjection, precision)
    },
    lineToViewProj (line, precision = COORD_PRECISION) {
      return transformLine(line, this.resolvedDataProjection, this.viewProjection, precision)
    },
    lineToDataProj (line, precision = COORD_PRECISION) {
      return transformLine(line, this.viewProjection, this.resolvedDataProjection, precision)
    },
    polygonToViewProj (polygon, precision = COORD_PRECISION) {
      return transformPolygon(polygon, this.resolvedDataProjection, this.viewProjection, precision)
    },
    polygonToDataProj (polygon, precision = COORD_PRECISION) {
      return transformPolygon(polygon, this.viewProjection, this.resolvedDataProjection, precision)
    },
    multiPointToViewProj (multiPoint, precision = COORD_PRECISION) {
      return transformMultiPoint(multiPoint, this.resolvedDataProjection, this.viewProjection, precision)
    },
    multiPointToDataProj (multiPoint, precision = COORD_PRECISION) {
      return transformMultiPoint(multiPoint, this.viewProjection, this.resolvedDataProjection, precision)
    },
    multiLineToViewProj (multiLine, precision = COORD_PRECISION) {
      return transformMultiLine(multiLine, this.resolvedDataProjection, this.viewProjection, precision)
    },
    multiLineToDataProj (multiLine, precision = COORD_PRECISION) {
      return transformMultiLine(multiLine, this.viewProjection, this.resolvedDataProjection, precision)
    },
    multiPolygonToViewProj (multiPolygon, precision = COORD_PRECISION) {
      return transformMultiPolygon(multiPolygon, this.resolvedDataProjection, this.viewProjection, precision)
    },
    multiPolygonToDataProj (multiPolygon, precision = COORD_PRECISION) {
      return transformMultiPolygon(multiPolygon, this.viewProjection, this.resolvedDataProjection, precision)
    },

    extentToViewProj (extent, precision = COORD_PRECISION) {
      return transformExtent(extent, this.resolvedDataProjection, this.viewProjection, precision)
    },
    extentToDataProj (extent, precision = COORD_PRECISION) {
      return transformExtent(extent, this.viewProjection, this.resolvedDataProjection, precision)
    },

    writeGeometryInDataProj (geometry, precision = COORD_PRECISION) {
      return writeGeoJsonGeometry(geometry, this.viewProjection, this.resolvedDataProjection, precision)
    },
    writeGeometryInViewProj (geometry, precision = COORD_PRECISION) {
      return writeGeoJsonGeometry(geometry, this.viewProjection, this.viewProjection, precision)
    },
    readGeometryInDataProj (geometry, precision = COORD_PRECISION) {
      return readGeoJsonGeometry(geometry, this.viewProjection, this.resolvedDataProjection, precision)
    },

    writeFeatureInDataProj (feature, precision = COORD_PRECISION) {
      return writeGeoJsonFeature(feature, this.viewProjection, this.resolvedDataProjection, precision)
    },
    writeFeatureInViewProj (feature, precision = COORD_PRECISION) {
      return writeGeoJsonFeature(feature, this.viewProjection, this.viewProjection, precision)
    },
    readFeatureInDataProj (feature, precision = COORD_PRECISION) {
      return readGeoJsonFeature(feature, this.viewProjection, this.resolvedDataProjection, precision)
    },
  },
}
