import debounce from 'debounce-promise'
import { concat as concatObs, from as fromObs, race as raceObs, throwError as throwErrorObs } from 'rxjs'
import { first as firstObs, mergeMap } from 'rxjs/operators'
import { v4 as uuid } from 'uuid'
import vq from 'vuequery'
import { obsFromVueEvent } from '../rx-ext'
import { newLogger } from '../util/log'
import { clonePlainObject, constant, identity, isEmpty, isFunction, kebabCase, negate } from '../util/minilo'
import eventBus from './event-bus'
import identMap from './ident-map'
import rxSubs from './rx-subs'
import services from './services'

export const VM_PROP = 'vm'
export const FRAME_TIME = 1000 / 60

const olObjectState = {
  UNDEF: 'undef',
  CREATING: 'creating',
  CREATED: 'created',
  MOUNTING: 'mounting',
  MOUNTED: 'mounted',
}

const olObjectEvent = {
  CREATED: 'created',
  CREATE_ERROR: 'createerror',
  MOUNTED: 'mounted',
  MOUNT_ERROR: 'mounterror',
  UNMOUNTED: 'unmounted',
  UNMOUNT_ERROR: 'unmounterror',
  DESTROYED: 'destroyed',
  DESTROY_ERROR: 'destroyerror',
}

/**
 * Basic ol component mixin.
 * todo try to subscribe to generic change event here and update rev according to internal ol counter
 */
export default {
  mixins: [
    identMap,
    rxSubs,
    services,
    eventBus,
  ],
  props: {
    /**
     * @type {string|number}
     */
    id: {
      type: [String, Number],
      default: uuid,
      validator: negate(isEmpty),
    },
    /**
     * Unique key for saving to identity map
     * @type {string|number|undefined}
     */
    ident: [String, Number],
  },
  data () {
    return {
      rev: 0,
    }
  },
  computed: {
    currentId () {
      return this.id
    },
    /**
     * @type {string}
     */
    vmClass () {
      return kebabCase(this.$options.name)
    },
    /**
     * @type {string}
     */
    vmId () {
      return [this.vmClass, this.currentId].filter(identity).join('.')
    },
    /**
     * @type {string}
     */
    vmName () {
      return [this.$options.name, this.currentId].filter(identity).join('.')
    },
    /**
     * @type {string|undefined}
     */
    olObjIdent () {
      if (!this.ident) return

      return this.makeIdent(this.ident)
    },
  },
  watch: {
    async id (value) {
      await this.setId(value)
    },
    currentId: debounce(function (value) {
      if (value === this.id) return

      this.$emit('update:id', value)
    }, FRAME_TIME),
    olObjIdent (value, prevValue) {
      if (value && prevValue) {
        this.moveInstance(value, prevValue)
      } else if (value && !prevValue && this.$olObject) {
        this.setInstance(value, this.$olObject)
      } else if (!value && prevValue) {
        this.unsetInstance(prevValue)
      }
    },
  },
  async created () {
    /**
     * @type {{warn: (function(...[*]): void), log: (function(...[*]): void), error: (function(...[*]): void)}}
     * @private
     */
    this._logger = newLogger(this.vmName)
    /**
     * @type {number}
     * @private
     */
    this._olObjectState = olObjectState.UNDEF
    /**
     * @type {module:ol/Object~BaseObject}
     * @private
     */
    this._olObject = undefined

    this::defineDebounceMethods()
    this::defineServices()

    await this::execInit()
  },
  async mounted () {
    await this.$createPromise
    await this::execMount()
  },
  async beforeDestroy () {
    await this.$mountPromise
    await this::execUnmount()
  },
  async destroyed () {
    await this.$unmountPromise
    await this::execDeinit()
  },
  methods: {
    /**
     * @return {Promise<void>} Resolves when initialization completes
     * @protected
     */
    beforeInit () {},
    /**
     * @return {Promise<void>} Resolves when initialization completes
     * @protected
     */
    async init () {
      this._olObject = await this.instanceFactoryCall(this.olObjIdent, ::this.createOlObject)
      this._olObject[VM_PROP] || (this._olObject[VM_PROP] = [])

      // for loaded from IdentityMap
      if (!this._olObject[VM_PROP].includes(this)) {
        this._olObject[VM_PROP].push(this)
      }

      ++this.rev
      // trigger computed properties based on ol instances
      // first time trigger need to setup and cache initial values
      this.triggerProps().forEach(prop => this[prop])
      this.subscribeAll()
    },
    /**
     * @return {string[]}
     */
    triggerProps: constant([
      'currentId',
    ]),
    /**
     * @return {module:ol/Object~BaseObject|Promise<module:ol/Object~BaseObject>}
     * @protected
     * @abstract
     */
    createOlObject () {
      throw new Error('Not implemented method: createOlObject')
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async deinit () {
      this.unsubscribeAll()
      this.unsetInstances()

      if (this._olObject) {
        this._olObject[VM_PROP] = this._olObject[VM_PROP].filter(vm => vm !== this)
        this._olObject = undefined
      }
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    beforeMount () {},
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
    },
    /**
     * @return {void|Promise<void>}
     * @protected
     */
    async unmount () {
    },
    /**
     * Refresh internal ol objects
     * @return {Promise<void>}
     */
    async refresh () {
      const olObj = await this.resolveOlObject()

      return new Promise(resolve => {
        if (isFunction(olObj.changed)) {
          olObj.once('change', () => {
            ++this.rev
            resolve()
          })
          olObj.changed()
        } else {
          ++this.rev
          resolve()
        }
      })
    },
    /**
     * @return {Promise<void>}
     */
    async scheduleRefresh () {
      await this.debounceRefresh()
    },
    /**
     * Internal usage only in components that doesn't support refreshing.
     * @return {Promise<void>}
     * @protected
     */
    async remount () {
      if (this.$olObjectState === olObjectState.MOUNTED) {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('remounting...')
        }

        await this::execUnmount()
        await this::execMount()
      } else {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('remount discarded')
        }
      }
    },
    /**
     * @return {Promise<void>}
     */
    async scheduleRemount () {
      if ([
        olObjectState.MOUNTING,
        olObjectState.MOUNTED,
      ].includes(this.$olObjectState)) {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('remount scheduled')
        }

        await this.debounceRemount()
      }
    },
    /**
     * Only for internal purpose to support watching for properties
     * for which OpenLayers doesn't provide setters.
     * @return {Promise}
     * @protected
     */
    async recreate () {
      if ([
        olObjectState.CREATED,
        olObjectState.MOUNTING,
        olObjectState.MOUNTED,
      ].includes(this.$olObjectState)) {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('recreating...')
        }

        const mounted = [
          olObjectState.MOUNTING,
          olObjectState.MOUNTED,
        ].includes(this.$olObjectState)
        if (mounted) {
          await this::execUnmount()
        }

        await this::execDeinit()
        await this::execInit()

        if (mounted) {
          await this::execMount()
        }
      } else {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('recreate discarded')
        }
      }
    },
    /**
     * @return {Promise<void>}
     */
    async scheduleRecreate () {
      if ([
        olObjectState.CREATING,
        olObjectState.CREATED,
        olObjectState.MOUNTING,
        olObjectState.MOUNTED,
      ].includes(this.$olObjectState)) {
        if (process.env.VUELAYERS_DEBUG) {
          this.$logger.log('recreate scheduled')
        }

        await this.debounceRecreate()
      }
    },
    /**
     * Redefine for easy call in child components
     * @returns {Object}
     * @protected
     */
    getServices () {
      return this::services.methods.getServices()
    },
    /**
     * @return {void}
     */
    subscribeAll () {},
    /**
     * @returns {Promise<Object>}
     * @throws {Error} If underlying OpenLayers object not initialized (incorrect initialization, already destroy).
     */
    async resolveOlObject () {
      await this.$createPromise

      return this.$olObject || throw new Error('OpenLayers object is undefined')
    },
    /**
     * @return {Promise<string|number>}
     */
    getId () {},
    /**
     * @param {string|number} id
     * @return {Promise<void>}
     */
    setId (id) {},
  },
}

function defineDebounceMethods () {
  const t = 1000 / 60

  this.debounceRefresh = debounce(function () {
    return this.refresh()
  }, t)

  this.debounceRemount = debounce(function () {
    return this.remount()
  }, t)

  this.debounceRecreate = debounce(function () {
    return this.recreate()
  }, t)
}

function defineServices () {
  Object.defineProperties(this, {
    $VM_PROP: {
      enumerable: true,
      get: () => VM_PROP,
    },
    $FRAME_TIME: {
      enumerable: true,
      get: () => FRAME_TIME,
    },
    $vq: {
      enumerable: true,
      get: () => vq(this),
    },
    /**
     * @type {{warn: (function(...[*]): void), log: (function(...[*]): void), error: (function(...[*]): void)}}
     */
    $logger: {
      enumerable: true,
      get: () => this._logger,
    },
    $olObjectStateEnum: {
      enumerable: true,
      get: () => clonePlainObject(olObjectState),
    },
    $olObjectEventEnum: {
      enumerable: true,
      get: () => clonePlainObject(olObjectEvent),
    },
    /**
     * @type {string}
     */
    $olObjectState: {
      enumerable: true,
      get: () => this._olObjectState,
    },
    /**
     * @type {module:ol/Object~BaseObject|undefined}
     */
    $olObject: {
      enumerable: true,
      get: () => this._olObject,
    },
    /**
     * @type {Promise<void>}
     */
    $createPromise: {
      enumerable: true,
      get: () => {
        if ([
          olObjectState.CREATED,
          olObjectState.MOUNTING,
          olObjectState.MOUNTED,
        ].includes(this._olObjectState)) {
          return Promise.resolve()
        }

        return raceObs(
          obsFromVueEvent(this, [olObjectEvent.CREATED]),
          obsFromVueEvent(this, [olObjectEvent.CREATE_ERROR]).pipe(
            mergeMap(([_, err]) => throwErrorObs(err)),
          ),
        ).pipe(firstObs())
          .toPromise(Promise)
      },
    },
    /**
     * @type {Promise<void>}
     */
    $mountPromise: {
      enumerable: true,
      get: () => {
        if ([olObjectState.MOUNTED].includes(this._olObjectState)) {
          return Promise.resolve()
        }

        return raceObs(
          obsFromVueEvent(this, [olObjectEvent.MOUNTED]),
          obsFromVueEvent(this, [
            olObjectEvent.CREATE_ERROR,
            olObjectEvent.MOUNT_ERROR,
          ]).pipe(
            mergeMap(([_, err]) => throwErrorObs(err)),
          ),
        ).pipe(firstObs())
          .toPromise(Promise)
      },
    },
    /**
     * @type {Promise<void>}
     */
    $unmountPromise: {
      enumerable: true,
      get: () => {
        return concatObs(
          fromObs(this.$mountPromise),
          raceObs(
            obsFromVueEvent(this, [olObjectEvent.UNMOUNTED]),
            obsFromVueEvent(this, [
              olObjectEvent.CREATE_ERROR,
              olObjectEvent.MOUNT_ERROR,
              olObjectEvent.UNMOUNT_ERROR,
            ]).pipe(
              mergeMap(([_, err]) => throwErrorObs(err)),
            ),
          ).pipe(firstObs()),
        ).toPromise(Promise)
      },
    },
    /**
     * @type {Promise<void>}
     */
    $destroyPromise: {
      enumerable: true,
      get: () => {
        return concatObs(
          fromObs(this.$unmountPromise),
          raceObs(
            obsFromVueEvent(this, [olObjectEvent.DESTROYED]),
            obsFromVueEvent(this, [
              olObjectEvent.CREATE_ERROR,
              olObjectEvent.MOUNT_ERROR,
              olObjectEvent.UNMOUNT_ERROR,
              olObjectEvent.DESTROY_ERROR,
            ]).pipe(
              mergeMap(([_, err]) => throwErrorObs(err)),
            ),
          ).pipe(firstObs()),
        ).toPromise(Promise)
      },
    },
  })
}

/**
 * @returns {Promise<void>}
 * @private
 */
async function execInit () {
  try {
    await this.beforeInit()

    this._olObjectState = olObjectState.CREATING

    await this.init()

    this._olObjectState = olObjectState.CREATED

    this.$emit(olObjectEvent.CREATED, this)
    this.$eventBus.$emit(olObjectEvent.CREATED, this)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.log(`ol object ${olObjectEvent.CREATED}`)
    }
  } catch (err) {
    this._olObjectState = olObjectState.UNDEF

    this.$emit(olObjectEvent.CREATE_ERROR, this, err)
    this.$eventBus.$emit(olObjectEvent.CREATE_ERROR, this, err)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.error(`ol object ${olObjectEvent.CREATE_ERROR}`, err)
    }

    throw err
  }
}

/**
 * @returns {Promise<void>}
 * @private
 */
async function execDeinit () {
  try {
    this._olObjectState = olObjectState.UNDEF

    await this.deinit()

    this.$emit(olObjectEvent.DESTROYED, this)
    this.$eventBus.$emit(olObjectEvent.DESTROYED, this)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.log(`ol object ${olObjectEvent.DESTROYED}`)
    }
  } catch (err) {
    this.$emit(olObjectEvent.DESTROY_ERROR, this, err)
    this.$eventBus.$emit(olObjectEvent.DESTROY_ERROR, this, err)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.error(`ol object ${olObjectEvent.DESTROY_ERROR}`, err)
    }

    throw err
  }
}

/**
 * @return {Promise<void>}
 * @private
 */
async function execMount () {
  try {
    await this.beforeMount()

    this._olObjectState = olObjectState.MOUNTING

    await this.mount()

    this._olObjectState = olObjectState.MOUNTED

    this.$emit(olObjectEvent.MOUNTED, this)
    this.$eventBus.$emit(olObjectEvent.MOUNTED, this)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.log(`ol object ${olObjectEvent.MOUNTED}`)
    }
  } catch (err) {
    this._olObjectState = olObjectState.CREATED

    this.$emit(olObjectEvent.MOUNT_ERROR, this, err)
    this.$eventBus.$emit(olObjectEvent.MOUNT_ERROR, this, err)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.error(`ol object ${olObjectEvent.MOUNT_ERROR}`, err)
    }

    throw err
  }
}

/**
 * @return {void|Promise<void>}
 * @private
 */
async function execUnmount () {
  try {
    this._olObjectState = olObjectState.CREATED

    await this.unmount()

    this.$emit(olObjectEvent.UNMOUNTED, this)
    this.$eventBus.$emit(olObjectEvent.UNMOUNTED, this)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.log(`ol object ${olObjectEvent.UNMOUNTED}`)
    }
  } catch (err) {
    this.$emit(olObjectEvent.UNMOUNT_ERROR, this, err)
    this.$eventBus.$emit(olObjectEvent.UNMOUNT_ERROR, this, err)

    if (process.env.VUELAYERS_DEBUG) {
      this.$logger.error(`ol object ${olObjectEvent.UNMOUNT_ERROR}`, err)
    }

    throw err
  }
}
