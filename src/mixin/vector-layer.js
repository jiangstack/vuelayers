import debounce from 'debounce-promise'
import { skipWhile } from 'rxjs/operators'
import { obsFromOlChangeEvent } from '../rx-ext'
import { addPrefix, isEqual, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import layer from './layer'
import { FRAME_TIME } from './ol-cmp'
import styleContainer from './style-container'

export default {
  mixins: [
    styleContainer,
    layer,
  ],
  props: {
    // ol/layer/BaseVector
    /**
     * @type {function|undefined}
     */
    renderOrder: Function,
    /**
     * @type {number}
     */
    renderBuffer: {
      type: Number,
      default: 100,
    },
    /**
     * @type {boolean}
     */
    declutter: Boolean,
    /**
     * When set to `true`, feature batches will be recreated during animations.
     * @type {boolean}
     */
    updateWhileAnimating: Boolean,
    /**
     * When set to `true`, feature batches will be recreated during interactions.
     * @type {boolean}
     */
    updateWhileInteracting: Boolean,
  },
  computed: {
    currentRenderOrder () {
      if (this.rev && this.$layer) {
        return this.$layer.getRenderOrder()
      }

      return this.renderOrder
    },
  },
  watch: {
    async renderOrder (value) {
      await this.setRenderOrder(value)
    },
    currentRenderOrder: debounce(function (value) {
      if (value === this.renderOrder) return

      this.$emit('update:renderOrder', value)
    }, FRAME_TIME),
    async renderBuffer (value) {
      if (value === await this.getRenderBuffer()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('renderBuffer changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
    async declutter (value) {
      if (value === await this.getDeclutter()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('declutter changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
    async updateWhileAnimating (value) {
      if (value === await this.getUpdateWhileAnimating()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('updateWhileAnimating changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
    async updateWhileInteracting (value) {
      if (value === await this.getUpdateWhileInteracting()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('updateWhileInteracting changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::layer.methods.triggerProps(),
        'currentRenderOrder',
      ]
    },
    /**
     * @returns {Object}
     * @protected
     */
    getServices () {
      return mergeDescriptors(
        this::layer.methods.getServices(),
        this::styleContainer.methods.getServices(),
      )
    },
    /**
     * @returns {void}
     */
    subscribeAll () {
      this::layer.methods.subscribeAll()
      this::subscribeToLayerEvents()
    },
    ...pick(layer.methods, [
      'beforeInit',
      'init',
      'deinit',
      'beforeMount',
      'mount',
      'unmount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'resolveOlObject',
      'resolveLayer',
    ]),
    /**
     * @return {Promise<StyleTarget|undefined>}
     */
    getStyleTarget: layer.methods.resolveLayer,
    /**
     * @returns {Promise<boolean>}
     */
    async getDeclutter () {
      return (await this.resolveLayer()).getDeclutter()
    },
    /**
     * @returns {Promise<number>}
     */
    async getRenderBuffer () {
      return (await this.resolveLayer()).getRenderBuffer()
    },
    /**
     * @returns {Promise<function>}
     */
    async getRenderOrder () {
      return (await this.resolveLayer()).getRenderOrder()
    },
    /**
     * @param {function} renderOrder
     * @returns {Promise<void>}
     */
    async setRenderOrder (renderOrder) {
      const layer = await this.resolveLayer()

      if (renderOrder === layer.getRenderOrder()) return

      layer.setRenderOrder(renderOrder)
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getUpdateWhileAnimating () {
      return (await this.resolveLayer()).getUpdateWhileAnimating()
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getUpdateWhileInteracting () {
      return (await this.resolveLayer()).getUpdateWhileInteracting()
    },
  },
}

async function subscribeToLayerEvents () {
  const prefixKey = addPrefix('current')
  const propChanges = obsFromOlChangeEvent(this.$layer, [
    'renderOrder',
  ], true, evt => ({
    ...evt,
    compareWith: this[prefixKey(evt.prop)],
  })).pipe(
    skipWhile(({ compareWith, value }) => isEqual(value, compareWith)),
  )
  this.subscribeTo(propChanges, () => {
    ++this.rev
  })
}
