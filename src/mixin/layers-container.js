import { Collection } from 'ol'
import BaseLayer from 'ol/layer/Base'
import { merge as mergeObs, from as fromObs } from 'rxjs'
import { switchMap, map as mapObs } from 'rxjs/operators'
import { getLayerId, initializeLayer } from '../ol-ext'
import { obsFromOlEvent } from '../rx-ext'
import { instanceOf } from '../util/assert'
import { isFunction, map } from '../util/minilo'
import identMap from './ident-map'
import rxSubs from './rx-subs'

/**
 * @typedef {module:ol/layer/Base~BaseLayer|Object} LayerLike
 */

/**
 * Layers container mixin.
 */
export default {
  mixins: [
    identMap,
    rxSubs,
  ],
  computed: {
    /**
     * @returns {string[]}
     */
    layerIds () {
      if (!this.rev) return []

      return this.getLayers().map(getLayerId)
    },
    /**
     * @returns {string|undefined}
     */
    layersCollectionIdent () {
      if (!this.olObjIdent) return

      return this.makeIdent(this.olObjIdent, 'layers_collection')
    },
  },
  watch: {
    layersCollectionIdent (value, prevValue) {
      if (value && prevValue) {
        this.moveInstance(value, prevValue)
      } else if (value && !prevValue && this.$layersCollection) {
        this.setInstance(value, this.$layersCollection)
      } else if (!value && prevValue) {
        this.unsetInstance(prevValue)
      }
    },
  },
  created () {
    /**
     * @type {module:ol/Collection~Collection<module:ol/layer/Base~BaseLayer>}
     * @private
     */
    this._layersCollection = this.instanceFactoryCall(this.layersCollectionIdent, () => new Collection())

    this::defineServices()
    this::subscribeToCollectionEvents()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'layerIds',
      ]
    },
    /**
     * @returns {{readonly layersContainer: Object}}
     * @protected
     */
    getServices () {
      const vm = this

      return {
        get layersContainer () { return vm },
      }
    },
    async initializeLayer (layer) {
      if (isFunction(layer.resolveOlObject)) {
        layer = await layer.resolveOlObject()
      }

      return initializeLayer(layer)
    },
    /**
     * @param {LayerLike} layer
     * @return {Promise<void>}
     */
    async addLayer (layer) {
      layer = await this.initializeLayer(layer)

      instanceOf(layer, BaseLayer)

      if (this.getLayerById(getLayerId(layer)) == null) {
        this.$layersCollection.push(layer)
      }
    },
    /**
     * @param {LayerLike[]|module:ol/Collection~Collection<LayerLike>} layers
     * @returns {Promise<void>}
     */
    async addLayers (layers) {
      await Promise.all(map(layers, ::this.addLayer))
    },
    /**
     * @param {LayerLike} layer
     * @return {void}
     */
    async removeLayer (layer) {
      if (isFunction(layer.resolveOlObject)) {
        layer = await layer.resolveOlObject()
      }

      layer = this.getLayerById(getLayerId(layer))
      if (!layer) return

      this.$layersCollection.remove(layer)
    },
    /**
     * @param {LayerLike[]|module:ol/Collection~Collection<LayerLike>} layers
     * @returns {Promise<void>}
     */
    async removeLayers (layers) {
      await Promise.all(map(layers, ::this.removeLayer))
    },
    /**
     * @return {Array<module:ol/layer/Base~BaseLayer>}
     */
    getLayers () {
      return this.$layersCollection.getArray()
    },
    /**
     * @return {module:ol/Collection~Collection<module:ol/layer/Base~BaseLayer>}
     */
    getLayersCollection () {
      return this._layersCollection
    },
    /**
     * @param {string|number} layerId
     * @return {module:ol/layer/Base~BaseLayer|undefined}
     */
    getLayerById (layerId) {
      return this.getLayers().find(layer => {
        return getLayerId(layer) === layerId
      })
    },
    /**
     * @return {void}
     */
    clearLayers () {
      this.$layersCollection.clear()
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $layersCollection: {
      enumerable: true,
      get: this.getLayersCollection,
    },
  })
}

function subscribeToCollectionEvents () {
  const adds = obsFromOlEvent(this.$layersCollection, 'add').pipe(
    switchMap(({ type, element }) => fromObs(this.initializeLayer(element)).pipe(
      mapObs(element => ({ type, element })),
    )),
  )
  const removes = obsFromOlEvent(this.$layersCollection, 'remove')

  this.subscribeTo(mergeObs(adds, removes), ({ type, element }) => {
    ++this.rev

    this.$nextTick(() => {
      this.$emit(type + 'layer', element)
    })
  })
}
