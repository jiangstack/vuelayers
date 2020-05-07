import { Collection, Overlay } from 'ol'
import { from as fromObs, merge as mergeObs } from 'rxjs'
import { map as mapObs, mergeMap } from 'rxjs/operators'
import { getOverlayId, initializeOverlay } from '../ol-ext'
import { obsFromOlEvent } from '../rx-ext'
import { instanceOf } from '../util/assert'
import { isFunction, map } from '../util/minilo'
import identMap from './ident-map'
import rxSubs from './rx-subs'

/**
 * @typedef {module:ol/Overlay~Overlay|Object} OverlayLike
 */

/**
 * Overlays container mixin.
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
    overlayIds () {
      if (!this.rev) return []

      return this.getOverlays().map(getOverlayId)
    },
    /**
     * @returns {string|undefined}
     */
    overlaysCollectionIdent () {
      if (!this.olObjIdent) return

      return this.makeIdent(this.olObjIdent, 'overlays_collection')
    },
  },
  watch: {
    overlaysCollectionIdent (value, prevValue) {
      if (value && prevValue) {
        this.moveInstance(value, prevValue)
      } else if (value && !prevValue && this.$overlaysCollection) {
        this.setInstance(value, this.$overlaysCollection)
      } else if (!value && prevValue) {
        this.unsetInstance(prevValue)
      }
    },
  },
  created () {
    /**
     * @type {module:ol/Collection~Collection<module:ol/Overlay~Overlay>}
     * @private
     */
    this._overlaysCollection = this.instanceFactoryCall(this.overlaysCollectionIdent, () => new Collection())

    this::defineServices()
    this::subscribeToCollectionEvents()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'overlayIds',
      ]
    },
    /**
     * @returns {readonly overlaysContainer: Object}}
     * @protected
     */
    getServices () {
      const vm = this

      return {
        get overlaysContainer () { return vm },
      }
    },
    async initializeOverlay (overlay) {
      if (isFunction(overlay.resolveOlObject)) {
        overlay = await overlay.resolveOlObject()
      }

      return initializeOverlay(overlay)
    },
    /**
     * @param {OverlayLike} overlay
     * @return {void}
     */
    async addOverlay (overlay) {
      overlay = await this.initializeOverlay(overlay)

      instanceOf(overlay, Overlay)

      if (this.getOverlayById(getOverlayId(overlay)) == null) {
        this.$overlaysCollection.push(overlay)
      }
    },
    /**
     * @param {OverlayLike[]|module:ol/Collection~Collection<OverlayLike>} overlays
     * @returns {Promise<void>}
     */
    async addOverlays (overlays) {
      await Promise.all(map(overlays, ::this.addOverlay))
    },
    /**
     * @param {OverlayLike} overlay
     * @return {void}
     */
    async removeOverlay (overlay) {
      if (isFunction(overlay.resolveOlObject)) {
        overlay = await overlay.resolveOlObject()
      }

      overlay = this.getOverlayById(getOverlayId(overlay))
      if (!overlay) return

      this.$overlaysCollection.remove(overlay)
    },
    /**
     * @param {OverlayLike[]|module:ol/Collection~Collection<OverlayLike>} overlays
     * @returns {Promise<void>}
     */
    async removeOverlays (overlays) {
      await Promise.all(map(overlays, ::this.removeOverlay))
    },
    /**
     * @return {Array<module:ol/Overlay~Overlay>}
     */
    getOverlays () {
      return this.$overlaysCollection.getArray()
    },
    /**
     * @return {module:ol/Collection~Collection<module:ol/Overlay~Overlay>}
     */
    getOverlaysCollection () {
      return this._overlaysCollection
    },
    /**
     * @param {string|number} overlayId
     * @return {module:ol/Overlay~Overlay|undefined}
     */
    getOverlayById (overlayId) {
      return this.getOverlays().find(overlay => {
        return getOverlayId(overlay) === overlayId
      })
    },
    /**
     * @return {void}
     */
    clearOverlays () {
      this.$overlaysCollection.clear()
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $overlaysCollection: {
      enumerable: true,
      get: this.getOverlaysCollection,
    },
  })
}

function subscribeToCollectionEvents () {
  const adds = obsFromOlEvent(this.$overlaysCollection, 'add').pipe(
    mergeMap(({ type, element }) => fromObs(this.initializeOverlay(element)).pipe(
      mapObs(element => ({ type, element })),
    )),
  )
  const removes = obsFromOlEvent(this.$overlaysCollection, 'remove')

  this.subscribeTo(mergeObs(adds, removes), ({ type, element }) => {
    ++this.rev

    this.$nextTick(() => {
      this.$emit(type + 'overlay', element)
      // todo remove in v0.13.x
      this.$emit(type + ':overlay', element)
    })
  })
}
