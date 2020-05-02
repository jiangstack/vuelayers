import Feature from 'ol/Feature'
import { GeoJSON as BaseGeoJSON, MVT } from 'ol/format'
import { Circle, LineString } from 'ol/geom'
import { isEmpty } from 'ol/obj'
import { getLength } from 'ol/sphere'
import { clonePlainObject, isArray, isFunction, noop, omit } from '../util/minilo'
import { createCircularPolygon, isCircleGeom } from './geom'
import { EPSG_4326, transformPoint } from './proj'

/**
 * @param {Object} [options]
 * @return {GeoJSON}
 */
export function createGeoJsonFmt (options) {
  return new GeoJSON(options)
}

/**
 * @param [options]
 * @return {MVT}
 */
export function createMvtFmt (options) {
  return new MVT(options)
}

class GeoJSON extends BaseGeoJSON {
  constructor (options = {}) {
    super(options)

    this.defaultDecimals = options.decimals
    this.defaultStyleReader = options.styleReader || noop
    this.defaultStyleWriter = options.styleWriter || noop
  }

  adaptOptions (options) {
    return super.adaptOptions({
      decimals: this.defaultDecimals,
      styleReader: this.defaultStyleReader,
      styleWriter: this.defaultStyleWriter,
      ...options,
    })
  }

  writeGeometryObject (geometry, options) {
    options = this.adaptOptions(options)

    if (isCircleGeom(geometry)) {
      let center = geometry.getCenter().slice()
      const end = [center[0] + geometry.getRadius(), center[1]]
      const radius = getLength(new LineString([center, end]), options.featureProjection)
      center = transformPoint(center, options.featureProjection, EPSG_4326)
      geometry = createCircularPolygon(center, radius)
      options.featureProjection = EPSG_4326
    }

    return super.writeGeometryObject(geometry, options)
  }

  writeFeatureObject (feature, options) {
    options = this.adaptOptions(options)

    /** @type {GeoJSONFeature} */
    const object = {
      type: 'Feature',
      geometry: null,
      properties: null,
    }

    const id = feature.getId()
    if (id !== undefined) {
      object.id = id
    }

    /* eslint-disable quote-props */

    const geometry = feature.getGeometry()
    if (geometry) {
      object.geometry = this.writeGeometryObject(geometry, options)
      if (isCircleGeom(geometry)) {
        object.properties = {
          ...object.properties || {},
          'vl_circle': {
            center: transformPoint(
              geometry.getCenter(),
              options.featureProjection,
              options.dataProjection,
            ),
            radius: geometry.getRadius(),
          },
        }
      }
    }

    const properties = feature.getProperties()
    delete properties[feature.getGeometryName()]
    if (!isEmpty(properties)) {
      object.properties = {
        ...object.properties || {},
        ...properties,
      }
    }

    let style = feature.getStyle()
    if (style && !isFunction(style)) {
      isArray(style) || (style = [style])
      object.properties = {
        ...object.properties || {},
        'vl_style': style.map(style => options.styleWriter(
          style,
          geometry => this.writeGeometryObject(geometry, options),
        )),
      }
    }

    /* eslint-enable quote-props */

    return object
  }

  readFeatureFromObject (object, options) {
    options = this.adaptOptions(options)
    /**
     * @type {GeoJSONFeature}
     */
    let geoJSONFeature
    if (object.type === 'Feature') {
      geoJSONFeature = clonePlainObject(object)
    } else {
      geoJSONFeature = {
        type: 'Feature',
        geometry: clonePlainObject(object),
        properties: null,
      }
    }

    const feature = new Feature()

    /* eslint-disable dot-notation */

    if (geoJSONFeature.properties && geoJSONFeature.properties['vl_circle']) {
      options.circle = geoJSONFeature.properties['vl_circle']
      delete geoJSONFeature.properties['vl_circle']
    }
    const geometry = this.readGeometryFromObject(geoJSONFeature.geometry, options)
    if (this.geometryName_) {
      feature.setGeometryName(this.geometryName_)
    } else if (this.extractGeometryName_ && 'geometry_name' in geoJSONFeature !== undefined) {
      feature.setGeometryName(geoJSONFeature.geometry_name)
    }
    feature.setGeometry(geometry)

    if ('id' in geoJSONFeature) {
      feature.setId(geoJSONFeature.id)
    }

    if (geoJSONFeature.properties) {
      if (geoJSONFeature.properties['vl_style']) {
        let style = geoJSONFeature.properties['vl_style']
        isArray(style) || (style = [style])
        feature.setStyle(
          style.map(style => options.styleReader(
            style,
            geometry => this.readGeometryFromObject(geometry, omit(options, ['circle'])),
          )),
        )
        delete geoJSONFeature.properties['vl_style']
      }

      feature.setProperties(geoJSONFeature.properties, true)
    }

    /* eslint-enable dot-notation */

    return feature
  }

  readGeometryFromObject (object, options) {
    options = this.adaptOptions(options)

    if (options.circle?.center && options.circle?.radius) {
      return new Circle(
        transformPoint(
          options.circle.center,
          options.dataProjection,
          options.featureProjection,
        ),
        options.circle.radius,
      )
    }

    return super.readGeometryFromObject(clonePlainObject(object), options)
  }
}
