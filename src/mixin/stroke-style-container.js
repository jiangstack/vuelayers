import debounce from 'debounce-promise'
import { dumpStrokeStyle } from '../ol-ext'
import { clonePlainObject, isEqual, isFunction } from '../util/minilo'
import { FRAME_TIME } from './ol-cmp'

/**
 * @typedef {module:ol/style/Stroke~Stroke|Object|undefined} StrokeStyleLike
 */

/**
 * @typedef {Object} StrokeStyleTarget
 * @property {function(): module:ol/style/Stroke~Stroke|undefined} getStroke
 * @property {function(module:ol/style/Stroke~Stroke|undefined): void} setStroke
 */

/**
 * Stroke style container.
 */
export default {
  computed: {
    stroke () {
      if (!(this.rev && this.$stroke)) return

      return dumpStrokeStyle(this.$stroke)
    },
  },
  watch: {
    stroke: {
      deep: true,
      handler: debounce(function (value, prev) {
        if (isEqual(value, prev)) return

        this.$emit('update:stroke', value && clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this._stroke = null
    this._strokeVm = null

    this::defineServices()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'stroke',
      ]
    },
    /**
     * @returns {{readonly strokeStyleContainer: Object}}
     */
    getServices () {
      const vm = this

      return {
        get strokeStyleContainer () { return vm },
      }
    },
    getStrokeStyleTarget () {
      throw new Error('Not implemented method: getStrokeStyleTarget')
    },
    /**
     * @returns {module:ol/style/Stroke~Stroke|null}
     */
    getStroke () {
      return this._stroke
    },
    /**
     * @param {module:ol/style/Stroke~Stroke|undefined} stroke
     * @returns {Promise<void>}
     */
    async setStroke (stroke) {
      if (isFunction(stroke?.resolveOlObject)) {
        stroke = await stroke.resolveOlObject()
      }
      stroke || (stroke = null)

      if (stroke === this._stroke) return

      const strokeTarget = await this.getStrokeStyleTarget()
      if (!strokeTarget) return

      this._stroke = stroke
      this._strokeVm = stroke?.vm && stroke.vm[0]
      strokeTarget.setStroke(stroke)
      ++this.rev
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $stroke: {
      enumerable: true,
      get: this.getStroke,
    },
    $strokeVm: {
      enumerable: true,
      get: () => this._strokeVm,
    },
  })
}
