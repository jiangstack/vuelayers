import debounce from 'debounce-promise'
import { dumpFillStyle } from '../ol-ext'
import { clonePlainObject, isEqual, isFunction } from '../util/minilo'
import { FRAME_TIME } from './ol-cmp'

/**
 * @typedef {module:ol/style/Fill~Fill|Object|undefined} FillStyleLike
 */

/**
 * @typedef {Object} FillStyleTarget
 * @property {function(): module:ol/style/Fill~Fill|undefined} getFill
 * @property {function(module:ol/style/Fill~Fill|undefined): void} setFill
 */

/**
 * Fill style container.
 */
export default {
  computed: {
    fill () {
      if (!(this.rev && this.$fill)) return

      return dumpFillStyle(this.$fill)
    },
  },
  watch: {
    fill: {
      deep: true,
      handler: debounce(function (value, prev) {
        if (isEqual(value, prev)) return

        this.$emit('update:fill', value && clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this._fill = null
    this._fillVm = null

    this::defineServices()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'fill',
      ]
    },
    /**
     * @returns {{readonly fillStyleContainer: Object}}
     */
    getServices () {
      const vm = this

      return {
        get fillStyleContainer () { return vm },
      }
    },
    getFillStyleTarget () {
      throw new Error('Not implemented method: getFillStyleTarget')
    },
    /**
     * @returns {module:ol/style/Fill~Fill|undefined}
     */
    getFill () {
      return this._fill
    },
    /**
     * @param {module:ol/style/Fill~Fill|undefined} fill
     * @returns {Promise<void>}
     */
    async setFill (fill) {
      if (isFunction(fill?.resolveOlObject)) {
        fill = await fill.resolveOlObject()
      }
      fill || (fill = null)

      if (fill === this._fill) return

      const fillTarget = await this.getFillStyleTarget()
      if (!fillTarget) return

      this._fill = fill
      this._fillVm = fill?.vm && fill.vm[0]
      fillTarget.setFill(fill)
      ++this.rev
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $fill: {
      enumerable: true,
      get: this.getFill,
    },
    $fillVm: {
      enumerable: true,
      get: () => this._fillVm,
    },
  })
}
