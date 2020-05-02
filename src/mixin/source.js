import { get as getProj } from 'ol/proj'
import { merge as mergeObs } from 'rxjs'
import { map as mapObs, skipWhile } from 'rxjs/operators'
import { initializeSource, setSourceId } from '../ol-ext'
import { obsFromOlChangeEvent, obsFromVueEvent, obsFromOlEvent } from '../rx-ext'
import { addPrefix, hasProp, isArray, isEqual, isString, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import waitFor from '../util/wait-for'
import olCmp from './ol-cmp'
import stubVNode from './stub-vnode'

/**
 * Base source mixin.
 */
export default {
  mixins: [
    stubVNode,
    olCmp,
  ],
  stubVNode: {
    empty () {
      return this.vmId
    },
  },
  props: {
    // ol/source/Source
    /**
     * @type {string|string[]|undefined}
     */
    attributions: {
      type: [String, Array],
      validator: value => isString(value) ||
        (isArray(value) && value.every(isString)),
    },
    /**
     * @type {boolean}
     */
    attributionsCollapsible: {
      type: Boolean,
      default: true,
    },
    /**
     * @type {string|undefined}
     */
    projection: {
      type: String,
      validator: value => getProj(value) != null,
    },
    /**
     * @type {boolean}
     */
    wrapX: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    /**
     * @returns {string|undefined}
     */
    state () {
      if (!(this.rev && this.$source)) return

      return this.$source.getState()
    },
  },
  watch: {
    async attributions (value) {
      await this.setAttributions(value)
    },
    async attributionsCollapsible (value) {
      if (value === await this.getAttributionsCollapsible()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('attributionsCollapsible changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
    async projection (value) {
      const projection = await this.getProjection()
      if (value === projection?.getCode()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('projection changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
    async wrapX (value) {
      if (value === await this.getWrapX()) return

      if (process.env.VUELAYERS_DEBUG) {
        this.$logger.log('wrapX changed, scheduling recreate...')
      }

      await this.scheduleRecreate()
    },
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
     * @return {Promise<module:ol/source/Source~Source>}
     * @protected
     */
    async createOlObject () {
      return initializeSource(await this.createSource(), this.id)
    },
    /**
     * @return {module:ol/source/Source~Source|Promise<module:ol/source/Source~Source>}
     * @protected
     * @abstract
     */
    createSource () {
      throw new Error('Not implemented method: createSource')
    },
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::olCmp.methods.triggerProps(),
        'state',
      ]
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
      if (this.$sourceContainer) {
        await this.$sourceContainer.setSource(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async unmount () {
      if (this.$sourceContainer) {
        await this.$sourceContainer.setSource(null)
      }

      return this::olCmp.methods.unmount()
    },
    /**
     * @return {Object}
     * @protected
     */
    getServices () {
      const vm = this

      return mergeDescriptors(
        this::olCmp.methods.getServices(),
        {
          get sourceVm () { return vm },
        },
      )
    },
    /**
     * @returns {void}
     */
    subscribeAll () {
      this::olCmp.methods.subscribeAll()
      this::subscribeToSourceEvents()
    },
    /**
     * @return {Promise<module:ol/source/Source~Source>}
     */
    resolveSource: olCmp.methods.resolveOlObject,
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
      return (await this.resolveSource()).getId()
    },
    /**
     * @param {string|number} id
     * @returns {Promise<void>}
     */
    async setId (id) {
      if (id === await this.getId()) return

      setSourceId(await this.resolveSource(), id)
    },
    /**
     * @returns {Promise<string>}
     */
    async getAttributions () {
      return (await this.resolveSource()).getAttributions()
    },
    /**
     * @param {string} attributions
     * @returns {Promise<void>}
     */
    async setAttributions (attributions) {
      if (isEqual(attributions, await this.getAttributions())) return

      (await this.resolveSource()).setAttributions(attributions)
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getAttributionsCollapsible () {
      return (await this.resolveSource()).getAttributionsCollapsible()
    },
    /**
     * @returns {Promise<module:ol/proj/Projection~Projection>}
     */
    async getProjection () {
      return (await this.resolveSource()).getProjection()
    },
    /**
     * @returns {Promise<string>}
     */
    async getState () {
      return (await this.resolveSource()).getState()
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getWrapX () {
      return (await this.resolveSource()).getWrapX()
    },
    /**
     * @returns {Promise<number[]>}
     */
    async getResolutions () {
      return (await this.resolveSource()).getResolutions()
    },
    /**
     * @returns {Promise<void>}
     */
    async reload () {
      (await this.resolveSource()).refresh()
    },
    /**
     * @return {Promise<void>}
     */
    async clear () {
      (await this.resolveSource()).clear()
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    /**
     * @type {module:ol/source/Source~Source|undefined}
     */
    $source: {
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
    $sourceContainer: {
      enumerable: true,
      get: () => this.$services?.sourceContainer,
    },
  })
}

async function subscribeToSourceEvents () {
  const prefixKey = addPrefix('current')
  const propChanges = obsFromOlChangeEvent(this.$source, [
    'id',
  ], true, evt => ({
    ...evt,
    compareWith: this[prefixKey(evt.prop)],
  })).pipe(
    skipWhile(({ value, compareWith }) => isEqual(value, compareWith)),
  )
  const changes = obsFromOlEvent(this.$source, 'change')
  const events = mergeObs(
    propChanges,
    changes,
  )
  this.subscribeTo(events, () => {
    ++this.rev
  })
}
