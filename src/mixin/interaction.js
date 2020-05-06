import debounce from 'debounce-promise'
import { merge as mergeObs } from 'rxjs'
import { map as mapObs, skipWhile } from 'rxjs/operators'
import {
  getInteractionId,
  getInteractionPriority,
  initializeInteraction,
  setInteractionId,
  setInteractionPriority,
} from '../ol-ext'
import { obsFromOlChangeEvent, obsFromVueEvent, obsFromOlEvent } from '../rx-ext'
import { addPrefix, hasProp, isEqual, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import waitFor from '../util/wait-for'
import olCmp, { FRAME_TIME } from './ol-cmp'
import stubVNode from './stub-vnode'

/**
 * Base interaction mixin.
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
    /**
     * @type {boolean}
     */
    active: {
      type: Boolean,
      default: true,
    },
    /**
     * Priority of interactions in the event handling stream.
     * The higher the value, the sooner it will handle map event.
     * @type {number}
     */
    priority: {
      type: Number,
      default: 0,
    },
  },
  computed: {
    currentActive () {
      if (this.rev && this.$interaction) {
        return this.$interaction.getActive()
      }

      return this.active
    },
    currentPriority () {
      if (this.rev && this.$interaction) {
        return getInteractionPriority(this.$interaction)
      }

      return this.priority
    },
  },
  watch: {
    async active (value) {
      await this.setActive(value)
    },
    currentActive: debounce(function (value) {
      if (value === this.active) return

      this.$emit('update:active', value)
    }, FRAME_TIME),
    async priority (value) {
      await this.setPriority(value)
    },
    currentPriority: debounce(function (value) {
      if (value === this.priority) return

      this.$emit('update:priority', value)
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
     * @return {Promise<module:ol/interaction/Interaction~Interaction>}
     * @protected
     */
    async createOlObject () {
      const interaction = initializeInteraction(await this.createInteraction(), this.id, this.priority)
      interaction.setActive(this.active)

      return interaction
    },
    /**
     * @return {module:ol/interaction/Interaction~Interaction|Promise<module:ol/interaction/Interaction~Interaction>}
     * @protected
     * @abstract
     */
    createInteraction () {
      throw new Error('Not implemented method: createInteraction')
    },
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::olCmp.methods.triggerProps(),
        'currentActive',
        'currentPriority',
      ]
    },
    /**
     * @return {void}
     * @protected
     */
    async mount () {
      if (this.$interactionsContainer) {
        await this.$interactionsContainer.addInteraction(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {void}
     * @protected
     */
    async unmount () {
      if (this.$interactionsContainer) {
        await this.$interactionsContainer.removeInteraction(this)
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
          get interactionVm () { return vm },
        },
      )
    },
    /**
     * @returns {void}
     */
    subscribeAll () {
      this::olCmp.methods.subscribeAll()
      this::subscribeToInteractionEvents()
    },
    /**
     * @return {Promise<module:ol/interaction/Interaction~Interaction>}
     */
    resolveInteraction: olCmp.methods.resolveOlObject,
    ...pick(olCmp.methods, [
      'init',
      'deinit',
      'beforeMount',
      'refresh',
      'scheduleRefresh',
      'recreate',
      'scheduleRecreate',
      'remount',
      'scheduleRemount',
      'resolveOlObject',
    ]),
    /**
     * @returns {Promise<string|number>}
     */
    async getId () {
      return getInteractionId(await this.resolveInteraction())
    },
    /**
     * @param {string|number} id
     * @returns {Promise<void>}
     */
    async setId (id) {
      if (id === await this.getId()) return

      setInteractionId(await this.resolveInteraction(), id)
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getActive () {
      return (await this.resolveInteraction()).getActive()
    },
    /**
     * @param {boolean} active
     * @returns {Promise<void>}
     */
    async setActive (active) {
      if (active === await this.getActive()) return

      (await this.resolveInteraction()).setActive(active)
    },
    /**
     * @returns {Promise<number>}
     */
    async getPriority () {
      return getInteractionPriority(await this.resolveInteraction())
    },
    /**
     * @param {number} priority
     * @returns {Promise<void>}
     */
    async setPriority (priority) {
      if (priority === await this.getPriority()) return

      setInteractionPriority(await this.resolveInteraction(), priority)
      // eslint-disable-next-line no-unused-expressions
      this.$interactionsContainer?.sortInteractions()
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    /**
     * @type {module:ol/interaction/Interaction~Interaction|undefined}
     */
    $interaction: {
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
    $interactionsContainer: {
      enumerable: true,
      get: () => this.$services?.interactionsContainer,
    },
  })
}

async function subscribeToInteractionEvents () {
  const prefixKey = addPrefix('current')
  const propChanges = obsFromOlChangeEvent(this.$interaction, [
    'id',
    'active',
    'priority',
  ], true, evt => ({
    ...evt,
    compareWith: this[prefixKey(evt.prop)],
  })).pipe(
    skipWhile(({ compareWith, value }) => isEqual(value, compareWith)),
  )
  const changes = obsFromOlEvent(this.$interaction, 'change')
  const events = mergeObs(
    propChanges,
    changes,
  )
  this.subscribeTo(events, () => {
    ++this.rev
  })
}
