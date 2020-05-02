import { isFunction } from '../util/minilo'

/**
 * @typedef {module:ol/source/Source~Source|Object} SourceLike
 */
/**
 * @typedef {Object} SourceTarget
 * @property {function(module:ol/source/Source~Source): void} setSource
 * @property {function(): module:ol/source/Source~Source} getSource
 */

/**
 * Source container mixin.
 */
export default {
  created () {
    /**
     * @type {module:ol/source/Source~Source|null}
     * @private
     */
    this._source = null
    /**
     * @type {Object|null}
     * @private
     */
    this._sourceVm = null

    this::defineServices()
  },
  methods: {
    /**
     * @returns {{readonly sourceContainer: Object}}
     * @protected
     */
    getServices () {
      const vm = this

      return {
        get sourceContainer () { return vm },
      }
    },
    /**
     * @return {Promise<SourceTarget|undefined>}
     * @protected
     */
    getSourceTarget () {
      throw new Error('Not implemented method: getSourceTarget')
    },
    /**
     * @return {module:ol/source/Source~Source|null}
     */
    getSource () {
      return this._source
    },
    /**
     * @param {SourceLike|undefined} source
     * @return {void}
     */
    async setSource (source) {
      if (isFunction(source?.resolveOlObject)) {
        source = await source.resolveOlObject()
      }
      source || (source = null)

      if (source === this._source) return

      const sourceTarget = await this.getSourceTarget()
      if (!sourceTarget) return

      this._source = source
      this._sourceVm = source?.vm && source.vm[0]
      sourceTarget.setSource(source)
      ++this.rev
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
      get: this.getSource,
    },
    $sourceVm: {
      enumerable: true,
      get: () => this._sourceVm,
    },
  })
}
