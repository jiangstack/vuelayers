import debounce from 'debounce-promise'
import { from as fromObs, merge as mergeObs } from 'rxjs'
import { map as mapObs, skipWhile, switchMap } from 'rxjs/operators'
import { getLayerId, initializeLayer, roundExtent, setLayerId } from '../ol-ext'
import { obsFromOlChangeEvent, obsFromOlEvent, obsFromVueEvent } from '../rx-ext'
import { assert } from '../util/assert'
import { addPrefix, hasProp, isEqual, isNumber, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import waitFor from '../util/wait-for'
import olCmp, { FRAME_TIME } from './ol-cmp'
import projTransforms from './proj-transforms'
import stubVNode from './stub-vnode'

/**
 * Base layer mixin.
 */
export default {
  mixins: [
    stubVNode,
    projTransforms,
    olCmp,
  ],
  stubVNode: {
    attrs () {
      return {
        id: this.vmId,
        class: this.vmClass,
      }
    },
  },
  props: {
    // ol/layer/Base
    /**
     * A CSS class name to set to the layer element.
     * @type {string}
     */
    className: {
      type: String,
      default: 'ol-layer',
    },
    /**
     * @type {number}
     */
    opacity: {
      type: Number,
      default: 1,
    },
    /**
     * @type {boolean}
     */
    visible: {
      type: Boolean,
      default: true,
    },
    /**
     * @type {number[]|undefined}
     */
    extent: {
      type: Array,
      validator: value => value.length === 4 && value.every(isNumber),
    },
    /**
     * @type {number|undefined}
     */
    zIndex: Number,
    /**
     * @type {number|undefined}
     */
    minResolution: Number,
    /**
     * @type {number|undefined}
     */
    maxResolution: Number,
    /**
     * @type {number|undefined}
     */
    minZoom: Number,
    /**
     * @type {number|undefined}
     */
    maxZoom: Number,
  },
  computed: {
    extentDataProj () {
      if (!this.extent) return

      return roundExtent(this.extent)
    },
    extentViewProj () {
      if (!this.extent) return

      return this.extentToViewProj(this.extent)
    },
    currentId () {
      if (this.rev && this.$layer) {
        return getLayerId(this.$layer)
      }

      return this.id
    },
    currentExtentDataProj () {
      if (!this.currentExtentViewProj) return

      return this.extentToDataProj(this.extentViewProj)
    },
    currentExtentViewProj () {
      if (this.rev && this.$layer) {
        const extent = this.$layer.getExtent()
        if (!extent) return

        return roundExtent(extent)
      }

      return this.extent
    },
    currentMaxResolution () {
      if (this.rev && this.$layer) {
        return this.$layer.getMaxResolution()
      }

      return this.maxResolution
    },
    currentMinResolution () {
      if (this.rev && this.$layer) {
        return this.$layer.getMinResolution()
      }

      return this.minResolution
    },
    currentMaxZoom () {
      if (this.rev && this.$layer) {
        return this.$layer.getMaxZoom()
      }

      return this.maxZoom
    },
    currentMinZoom () {
      if (this.rev && this.$layer) {
        return this.$layer.getMinZoom()
      }

      return this.minZoom
    },
    currentOpacity () {
      if (this.rev && this.$layer) {
        return this.$layer.getOpacity()
      }

      return this.opacity
    },
    currentVisible () {
      if (this.rev && this.$layer) {
        return this.$layer.getVisible()
      }

      return this.visible
    },
    currentZIndex () {
      if (this.rev && this.$layer) {
        return this.$layer.getZIndex()
      }

      return this.zIndex
    },
  },
  watch: {
    async opacity (value) {
      await this.setOpacity(value)
    },
    currentOpacity: debounce(function (value) {
      if (value === this.opacity) return

      this.$emit('update:opacity', value)
    }, FRAME_TIME),
    async visible (value) {
      await this.setVisible(value)
    },
    currentVisible: debounce(function (value) {
      if (value === this.visible) return

      this.$emit('update:visible', value)
    }, FRAME_TIME),
    async extentViewProj (value) {
      await this.setExtent(value)
    },
    currentExtentViewProj: debounce(function (value) {
      if (isEqual(value, this.extentViewProj)) return

      this.$emit('update:extent', value.slice())
    }, FRAME_TIME),
    async zIndex (value) {
      await this.setZIndex(value)
    },
    currentZIndex: debounce(function (value) {
      if (value === this.zIndex) return

      this.$emit('update:zIndex', value)
    }, FRAME_TIME),
    async minResolution (value) {
      await this.setMinResolution(value)
    },
    currentMinResolution: debounce(function (value) {
      if (value === this.minResolution) return

      this.$emit('update:minResolution', value)
    }, FRAME_TIME),
    async maxResolution (value) {
      await this.setMaxResolution(value)
    },
    currentMaxResolution: debounce(function (value) {
      if (value === this.maxResolution) return

      this.$emit('update:maxResolution', value)
    }, FRAME_TIME),
    async minZoom (value) {
      await this.setMinZoom(value)
    },
    currentMinZoom: debounce(function (value) {
      if (value === this.minZoom) return

      this.$emit('update:minZoom', value)
    }, FRAME_TIME),
    async maxZoom (value) {
      await this.setMaxZoom(value)
    },
    currentMaxZoom: debounce(function (value) {
      if (value === this.maxZoom) return

      this.$emit('update:maxZoom', value)
    }, FRAME_TIME),
  },
  created () {
    this::defineServices()
  },
  methods: {
    /**
     * @returns {Promise<void>}
     * @protected
     */
    async beforeInit () {
      try {
        await waitFor(
          () => this.$mapVm != null,
          obsFromVueEvent(this.$eventBus, [
            this.$olObjectEventEnum.CREATE_ERROR,
          ]).pipe(
            mapObs(([vm]) => hasProp(vm, '$map') && this.$vq.closest(vm)),
          ),
          1000,
        )

        return this::olCmp.methods.beforeInit()
      } catch (err) {
        err.message = 'Wait for $mapVm injection: ' + err.message
        throw err
      }
    },
    /**
     * @return {Promise<module:ol/layer/Base~BaseLayer>}
     * @protected
     */
    async createOlObject () {
      return initializeLayer(await this.createLayer(), this.currentId)
    },
    /**
     * @return {module:ol/layer/Base~BaseLayer|Promise<module:ol/layer/Base~BaseLayer>}
     * @protected
     * @abstract
     */
    createLayer () {
      throw new Error('Not implemented method: createLayer')
    },
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::olCmp.methods.triggerProps(),
        'currentExtentDataProj',
        'currentExtentViewProj',
        'currentMaxResolution',
        'currentMinResolution',
        'currentMaxZoom',
        'currentMinZoom',
        'currentOpacity',
        'currentVisible',
        'currentZIndex',
      ]
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
      if (this.$layersContainer) {
        await this.$layersContainer.addLayer(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async unmount () {
      if (this.$layersContainer) {
        await this.$layersContainer.removeLayer(this)
      }

      return this::olCmp.methods.unmount()
    },
    /**
     * @returns {Object}
     * @protected
     */
    getServices () {
      const vm = this

      return mergeDescriptors(
        this::olCmp.methods.getServices(),
        {
          get layerVm () { return vm },
        },
      )
    },
    /**
     * @return {void}
     * @protected
     */
    subscribeAll () {
      this::olCmp.methods.subscribeAll()
      this::subscribeToLayerEvents()
    },
    /**
     * @return {Promise<module:ol/layer/Base~BaseLayer>}
     */
    resolveLayer: olCmp.methods.resolveOlObject,
    ...pick(olCmp.methods, [
      'init',
      'deinit',
      'beforeMount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'resolveOlObject',
    ]),
    /**
     * @returns {Promise<string|number>}
     */
    async getId () {
      return getLayerId(await this.resolveLayer())
    },
    /**
     * @param {string|number} id
     * @returns {Promise<void>}
     */
    async setId (id) {
      assert(!!id, 'Invalid layer id')

      if (id === await this.getId()) return

      setLayerId(await this.resolveLayer(), id)
    },
    /**
     * @returns {Promise<number[]|undefined>}
     */
    async getExtent () {
      const extent = (await this.resolveLayer().getExtent())
      if (extent) return

      return roundExtent(extent)
    },
    /**
     * @param {number[]} extent
     * @returns {Promise<void>}
     */
    async setExtent (extent) {
      if (isEqual(extent, await this.getExtent())) return
      if (extent) {
        extent = this.extentToViewProj(extent)
      }
      (await this.resolveLayer()).setExtent(extent)
    },
    /**
     * @returns {Promise<number>}
     */
    async getMaxResolution () {
      return (await this.resolveLayer()).getMaxResolution()
    },
    /**
     * @param {number} resolution
     * @returns {Promise<void>}
     */
    async setMaxResolution (resolution) {
      if (resolution === await this.getMaxResolution()) return

      (await this.resolveLayer()).setMaxResolution(resolution)
    },
    /**
     * @returns {Promise<number>}
     */
    async getMinResolution () {
      return (await this.resolveLayer()).getMinResolution()
    },
    /**
     * @param {number} resolution
     * @returns {Promise<void>}
     */
    async setMinResolution (resolution) {
      if (resolution === await this.getMinResolution()) return

      (await this.resolveLayer()).setMinResolution(resolution)
    },
    /**
     * @returns {Promise<number>}
     */
    async getMaxZoom () {
      return (await this.resolveLayer()).getMaxZoom()
    },
    /**
     * @param {number} zoom
     * @returns {Promise<void>}
     */
    async setMaxZoom (zoom) {
      if (zoom === await this.getMaxZoom()) return

      (await this.resolveLayer()).setMaxZoom(zoom)
    },
    /**
     * @returns {Promise<number>}
     */
    async getMinZoom () {
      return (await this.resolveLayer()).getMinZoom()
    },
    /**
     * @param {number} zoom
     * @returns {Promise<void>}
     */
    async setMinZoom (zoom) {
      if (zoom === await this.getMinZoom()) return

      (await this.resolveLayer()).setMinZoom(zoom)
    },
    /**
     * @returns {Promise<number>}
     */
    async getOpacity () {
      return (await this.resolveLayer()).getOpacity()
    },
    /**
     * @param {number} opacity
     * @returns {Promise<void>}
     */
    async setOpacity (opacity) {
      if (opacity === await this.getOpacity()) return

      (await this.resolveLayer()).setOpacity(opacity)
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getVisible () {
      return (await this.resolveLayer()).getVisible()
    },
    /**
     * @param {boolean} visible
     * @returns {Promise<void>}
     */
    async setVisible (visible) {
      if (visible === await this.getVisible()) return

      (await this.resolveLayer()).setVisible(visible)
    },
    /**
     * @returns {Promise<number>}
     */
    async getZIndex () {
      return (await this.resolveLayer()).getZIndex()
    },
    /**
     * @param {number} zIndex
     * @returns {Promise<void>}
     */
    async setZIndex (zIndex) {
      if (zIndex === await this.getZIndex()) return

      (await this.resolveLayer()).setZIndex(zIndex)
    },
    /**
     * @param {number[]} pixel
     * @return {boolean}
     */
    async isAtPixel (pixel) {
      const layer = await this.resolveLayer()

      return this.$mapVm.forEachLayerAtPixel(pixel, mapLayer => mapLayer === layer)
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    /**
     * @type {module:ol/layer/Base~BaseLayer|undefined}
     */
    $layer: {
      enumerable: true,
      get: () => this.$olObject,
    },
    /**
     * @type {Object|undefined}
     */
    $mapVm: {
      enumerable: true,
      get: () => this.$services?.mapVm,
    },
    /**
     * @type {Object|undefined}
     */
    $viewVm: {
      enumerable: true,
      get: () => this.$services?.viewVm,
    },
    /**
     * @type {Object|undefined}
     */
    $layersContainer: {
      enumerable: true,
      get: () => this.$services?.layersContainer,
    },
  })
}

async function subscribeToLayerEvents () {
  const prefixKey = addPrefix('current')
  const propChanges = mergeObs(
    obsFromOlChangeEvent(this.$layer, [
      'id',
      'opacity',
      'visible',
      'zIndex',
      'minResolution',
      'maxResolution',
      'minZoom',
      'maxZoom',
    ], true, evt => ({
      ...evt,
      compareWith: this[prefixKey(evt.prop)],
    })),
    obsFromOlChangeEvent(this.$layer, 'extent', true).pipe(
      switchMap(({ prop }) => fromObs(this.getExtent()).pipe(
        mapObs(extent => ({
          prop,
          value: extent,
          compareWith: this.currentExtentDataProj,
        })),
      )),
    ),
  ).pipe(
    skipWhile(({ value, compareWith }) => isEqual(value, compareWith)),
  )
  const changes = obsFromOlEvent(this.$layer, 'change')
  const events = mergeObs(
    propChanges,
    changes,
  )
  this.subscribeTo(events, () => {
    ++this.rev
  })
}
