import debounce from 'debounce-promise'
import { Collection, Feature, getUid } from 'ol'
import { Style } from 'ol/style'
import { from as fromObs, merge as mergeObs } from 'rxjs'
import { map as mapObs, mergeMap, tap } from 'rxjs/operators'
import {
  CIRCLE_SERIALIZE_PROP,
  createStyle,
  dumpStyle,
  getFeatureId,
  getFeatureProperties,
  initializeFeature,
  isGeoJSONFeature,
  setFeatureId,
  setFeatureProperties,
  STYLE_SERIALIZE_PROP,
} from '../ol-ext'
import { obsFromOlEvent } from '../rx-ext'
import { instanceOf } from '../util/assert'
import { clonePlainObject, get, isArray, isEqual, isFunction, isPlainObject, map } from '../util/minilo'
import identMap from './ident-map'
import { FRAME_TIME } from './ol-cmp'
import projTransforms from './proj-transforms'
import rxSubs from './rx-subs'

/**
 * @typedef {module:ol/Feature~Feature|Object} FeatureLike
 */

/**
 * Features container
 */
export default {
  mixins: [
    identMap,
    rxSubs,
    projTransforms,
  ],
  computed: {
    /**
     * @type {Array<string|number>}
     */
    featureIds () {
      if (!this.rev) return []

      return this.getFeatures().map(getFeatureId)
    },
    /**
     * @type {Object[]}
     */
    featuresViewProj () {
      if (!this.rev) return []

      return this.getFeatures().map(f => this.writeFeatureInViewProj(f))
    },
    /**
     * @type {Object[]}
     */
    featuresDataProj () {
      if (!this.rev) return []

      return this.getFeatures().map(f => this.writeFeatureInDataProj(f))
    },
    /**
     * @returns {string|undefined}
     */
    featuresCollectionIdent () {
      if (!this.olObjIdent) return

      return this.makeIdent(this.olObjIdent, 'features_collection')
    },
  },
  watch: {
    featuresDataProj: {
      deep: true,
      handler: debounce(async function (value, prev) {
        await this.onFeaturesChanged(value, prev)
      }, FRAME_TIME),
    },
    featuresCollectionIdent (value, prevValue) {
      if (value && prevValue) {
        this.moveInstance(value, prevValue)
      } else if (value && !prevValue && this.$featuresCollection) {
        this.setInstance(value, this.$featuresCollection)
      } else if (!value && prevValue) {
        this.unsetInstance(prevValue)
      }
    },
  },
  created () {
    /**
     * @type {module:ol/Collection~Collection<module:ol/Feature~Feature>}
     * @private
     */
    this._featuresCollection = this.instanceFactoryCall(this.featuresCollectionIdent, () => new Collection())
    this._featureSubs = {}

    this::defineServices()
    this::subscribeToCollectionEvents()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'featureIds',
        'featuresViewProj',
        'featuresDataProj',
      ]
    },
    /**
     * @returns {{readonly featuresContainer: Object}}
     * @protected
     */
    getServices () {
      const vm = this

      return {
        get featuresContainer () { return vm },
      }
    },
    /**
     * @param {FeatureLike} feature
     * @return {Promise<Feature>}
     * @protected
     */
    async initializeFeature (feature) {
      if (isFunction(feature?.resolveOlObject)) {
        feature = await feature.resolveOlObject()
      } else if (isPlainObject(feature)) {
        feature = this.readFeatureInDataProj(feature)
      }

      return initializeFeature(feature)
    },
    /**
     * @param {FeatureLike[]|module:ol/Collection~Collection<FeatureLike>} features
     * @return {Promise<void>}
     */
    async addFeatures (features) {
      await Promise.all(map(features, ::this.addFeature))
    },
    /**
     * @param {FeatureLike} feature
     * @return {Promise<void>}
     */
    async addFeature (feature) {
      feature = await this.initializeFeature(feature)

      instanceOf(feature, Feature)
      // todo add hash {featureId => featureIdx, ....}
      const foundFeature = this.getFeatureById(getFeatureId(feature))
      if (foundFeature == null) {
        this.$featuresCollection.push(feature)
      }
    },
    /**
     * @param {FeatureLike[]|module:ol/Collection~Collection<FeatureLike>} features
     * @return {Promise<void>}
     */
    async removeFeatures (features) {
      await Promise.all(map(features, ::this.removeFeature))
    },
    /**
     * @param {FeatureLike} feature
     * @return {Promise<void>}
     */
    async removeFeature (feature) {
      if (isFunction(feature.resolveOlObject)) {
        feature = await feature.resolveOlObject()
      }

      feature = this.getFeatureById(getFeatureId(feature))
      if (!feature) return

      this.$featuresCollection.remove(feature)
    },
    /**
     * @return {void}
     */
    clearFeatures () {
      this.$featuresCollection.clear()
    },
    /**
     * @param {string|number} featureId
     * @return {module:ol/Feature~Feature|undefined}
     */
    getFeatureById (featureId) {
      // todo add hash {featureId => featureIdx, ....}
      return this.$featuresCollection.getArray().find(feature => {
        return getFeatureId(feature) === featureId
      })
    },
    /**
     * @return {Array<module:ol/Feature~Feature>}
     */
    getFeatures () {
      return this.$featuresCollection.getArray()
    },
    /**
     * @return {module:ol/Collection~Collection<module:ol/Feature~Feature>}
     */
    getFeaturesCollection () {
      return this._featuresCollection
    },
    /**
     * @param {module:ol/Collection~Collection<module:ol/Feature~Feature>} feature
     * @return {boolean}
     */
    hasFeature (feature) {
      return this.getFeatureById(getFeatureId(feature)) != null
    },
    /**
     * @returns {boolean}
     */
    hasFeatures () {
      return this.getFeatures().length === 0
    },
    onFeaturesChanged (features, prevFeatures) {
      if (isEqual(features, prevFeatures)) return

      this.$emit('update:features', clonePlainObject(features))
    },
    updateFeature (feature, newFeatureJson) {
      const featureJson = this.writeFeatureInDataProj(feature)

      if (isEqual(featureJson, newFeatureJson)) return

      const newFeature = this.readFeatureInDataProj(newFeatureJson)

      if (getFeatureId(feature) !== getFeatureId(newFeature)) {
        setFeatureId(feature, getFeatureId(newFeature))
      }

      const properties = getFeatureProperties(newFeature)
      const currentProperties = getFeatureProperties(feature)
      if (!isEqual(properties, currentProperties)) {
        setFeatureProperties(feature, properties)
      }

      const geomJson = get(newFeatureJson, `properties.${CIRCLE_SERIALIZE_PROP}`) || newFeatureJson.geometry || null
      const currentGeomJson = get(featureJson, `properties.${CIRCLE_SERIALIZE_PROP}`) || featureJson.geometry || null
      if (!isEqual(geomJson, currentGeomJson)) {
        feature.setGeometry(newFeature.getGeometry() || null)
      }

      let styleJson = get(newFeatureJson, `properties.${STYLE_SERIALIZE_PROP}`) || null
      if (styleJson && !isArray(styleJson)) {
        styleJson = [styleJson]
      }
      const style = styleJson ? styleJson.map(style => createStyle(style, geom => this.readGeometryInDataProj(geom))) : null
      let currentStyle = feature.getStyle() || null
      if (currentStyle instanceof Style) {
        currentStyle = [currentStyle]
      }
      const currentStyleJson = currentStyle ? currentStyle.map(
        style => dumpStyle(style, geom => this.writeGeometryInDataProj(geom))) : null
      if (!style || !currentStyle || isFunction(currentStyle)) {
        if (style !== currentStyle) {
          feature.setStyle(style)
        }
      } else {
        if (!isEqual(styleJson, currentStyleJson)) {
          feature.setStyle(style)
        }
      }
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $featuresCollection: {
      enumerable: true,
      get: this.getFeaturesCollection,
    },
  })
}

function subscribeToCollectionEvents () {
  const adds = obsFromOlEvent(this.$featuresCollection, 'add').pipe(
    mergeMap(({ type, element }) => fromObs(this.initializeFeature(element)).pipe(
      mapObs(element => ({ type, element })),
    )),
    tap(({ type, element }) => {
      if (!element.vm?.length) {
        const unwatch = this.$watch(
          () => (this.inputFeatures || []).find(f => getFeatureId(f) === getFeatureId(element)),
          (featureJson, prevFeatureJson) => {
            if (isEqual(featureJson, prevFeatureJson)) return

            if (isGeoJSONFeature(featureJson)) {
              this.updateFeature(element, featureJson)
            } else {
              unwatch()
            }
          },
          {
            deep: true,
          },
        )
      }

      const uid = getUid(element)
      const propChanges = obsFromOlEvent(element, 'propertychange')
      const changes = obsFromOlEvent(element, 'change')
      const events = mergeObs(
        propChanges,
        changes,
      )
      this._featureSubs[uid] = this.subscribeTo(events, () => {
        ++this.rev
      })
    }),
  )
  const removes = obsFromOlEvent(this.$featuresCollection, 'remove').pipe(
    tap(({ type, element }) => {
      element.vm.forEach(vm => {
        if (vm.$options.name === 'VlVirtualFeature' && vm.$vq.closest(this)) {
          vm.$destroy()
        }
      })

      const uid = getUid(element)
      if (this._featureSubs[uid]) {
        this.unsubscribe(this._featureSubs[uid])
        delete this._featureSubs[uid]
      }
    }),
  )
  this.subscribeTo(mergeObs(adds, removes), ({ type, element }) => {
    ++this.rev

    this.$nextTick(() => {
      this.$emit(type + 'feature', element)
      // todo remove in v0.13.x
      this.$emit(type + ':feature', element)
    })
  })
}
