import debounce from 'debounce-promise'
import { dumpImageStyle } from '../ol-ext'
import { clonePlainObject, isEqual, isFunction } from '../util/minilo'
import { FRAME_TIME } from './ol-cmp'

/**
 * @typedef {module:ol/style/Image~ImageStyle|Object|undefined} ImageStyleLike
 */

/**
 * @typedef {Object} ImageStyleTarget
 * @property {function(): module:ol/style/Image~ImageStyle|undefined} getImage
 * @property {function(module:ol/style/Image~ImageStyle|undefined): void} setImage
 */

/**
 * Image style container.
 */
export default {
  computed: {
    image () {
      if (!(this.rev && this.$image)) return

      return dumpImageStyle(this.$image)
    },
  },
  watch: {
    image: {
      deep: true,
      handler: debounce(function (value, prev) {
        if (isEqual(value, prev)) return

        this.$emit('update:image', value && clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this._image = undefined
    this._imageVm = undefined

    this::defineServices()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'image',
      ]
    },
    /**
     * @returns {{readonly imageStyleContainer: Object}}
     */
    getServices () {
      const vm = this

      return {
        get imageStyleContainer () { return vm },
      }
    },
    /**
     * @return {ImageStyleTarget}
     */
    getImageStyleTarget () {
      throw new Error('Not implemented method: getImageStyleTarget')
    },
    /**
     * @returns {module:ol/style/Image~ImageStyle|undefined}
     */
    getImage () {
      return this._image
    },
    /**
     * @param {module:ol/style/Image~ImageStyle|undefined} image
     * @returns {Promise<void>}
     */
    async setImage (image) {
      if (isFunction(image?.resolveOlObject)) {
        image = await image.resolveOlObject()
      }
      image || (image = null)

      if (image === this._image) return

      const imageTarget = await this.getImageStyleTarget()
      if (!imageTarget) return

      this._image = image
      this._imageVm = image?.vm && image.vm[0]
      imageTarget.setImage(image)
      ++this.rev
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    $image: {
      enumerable: true,
      get: this.getImage,
    },
    $imageVm: {
      enumerable: true,
      get: () => this._imageVm,
    },
  })
}
