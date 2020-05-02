import debounce from 'debounce-promise'
import { dumpTextStyle } from '../ol-ext'
import { clonePlainObject, isEqual, isFunction } from '../util/minilo'
import { FRAME_TIME } from './ol-cmp'

/**
 * @typedef {module:ol/style/Text~Text|Object|undefined} TextStyleLike
 */

/**
 * @typedef {Object} TextStyleTarget
 * @property {function(): module:ol/style/Text~Text|undefined} getText
 * @property {function(module:ol/style/Text~Text|undefined): void} setText
 */

/**
 * Text style container.
 */
export default {
  computed: {
    text () {
      if (!(this.rev && this.$text)) return

      return dumpTextStyle(this.$text)
    },
  },
  watch: {
    text: {
      deep: true,
      handler: debounce(function (value, prev) {
        if (isEqual(value, prev)) return

        this.$emit('update:text', value && clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this._text = null
    this._textVm = null

    this::defineServices()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'text',
      ]
    },
    /**
     * @returns {{readonly textStyleContainer: Object}}
     */
    getServices () {
      const vm = this

      return {
        get textStyleContainer () { return vm },
      }
    },
    /**
     * @return {Promise<module:ol/style/Text~Text|undefined>}
     */
    getTextStyleTarget () {
      throw new Error('Not implemented method: getTextStyleTarget')
    },
    /**
     * @returns {module:ol/style/Text~Text|null}
     */
    getText () {
      return this._text
    },
    /**
     * @param {module:ol/style/Text~Text|undefined} text
     * @returns {Promise<void>}
     */
    async setText (text) {
      if (isFunction(text?.resolveOlObject)) {
        text = await text.resolveOlObject()
      }
      text || (text = null)

      if (text === this._text) return

      const textTarget = await this.getTextStyleTarget()
      if (!textTarget) return

      this._text = text
      this._textVm = text?.vm && text.vm[0]
      textTarget.setText(text)
      ++this.rev
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $text: {
      enumerable: true,
      get: this.getText,
    },
    $textVm: {
      enumerable: true,
      get: () => this._textVm,
    },
  })
}
