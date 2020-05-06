import debounce from 'debounce-promise'
import { findPointOnSurface } from '../ol-ext'
import { clonePlainObject, isEqual, isFunction } from '../util/minilo'
import { FRAME_TIME } from './ol-cmp'
import projTransforms from './proj-transforms'

/**
 * @typedef {Geometry|Object} GeometryLike
 */
/**
 * @typedef {Object} GeometryTarget
 * @property {function(): Geometry|undefined} getGeometry
 * @property {function(Geometry|undefined): void} setGeometry
 */

/**
 * Geometry container
 */
export default {
  mixins: [
    projTransforms,
  ],
  computed: {
    geometryDataProj () {
      if (!(this.rev && this.$geometry)) return

      return this.writeGeometryInDataProj(this.$geometry)
    },
    geometryViewProj () {
      if (!(this.rev && this.$geometry)) return

      return this.writeGeometryInViewProj(this.$geometry)
    },
    pointDataProj () {
      if (!this.pointViewProj) return

      return this.pointToDataProj(this.pointViewProj)
    },
    pointViewProj () {
      if (!(this.rev && this.$geometry)) return

      return findPointOnSurface(this.$geometry)
    },
  },
  watch: {
    geometryDataProj: {
      deep: true,
      handler: debounce(function (value, prev) {
        if (isEqual(value, prev)) return

        this.$emit('update:geometry', value && clonePlainObject(value))
      }, FRAME_TIME),
    },
  },
  created () {
    this._geometry = null
    this._geometryVm = null

    this::defineService()
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        'geometryDataProj',
        'geometryViewProj',
        'pointViewProj',
      ]
    },
    /**
     * @returns {{readonly geometryContainer: Object}}
     * @protected
     */
    getServices () {
      const vm = this

      return {
        get geometryContainer () { return vm },
      }
    },
    /**
     * @return {Promise<GeometryTarget|undefined>}
     * @protected
     */
    getGeometryTarget () {
      throw new Error('Not implemented method: getGeometryTarget')
    },
    /**
     * @return {module:ol/geom/Geometry~Geometry|undefined}
     */
    getGeometry () {
      return this._geometry
    },
    /**
     * @param {GeometryLike|undefined} geom
     * @return {Promise<void>}
     */
    async setGeometry (geom) {
      if (isFunction(geom?.resolveOlObject)) {
        geom = await geom.resolveOlObject()
      }
      geom || (geom = null)

      if (geom === this._geometry) return

      const geomTarget = await this.getGeometryTarget()
      if (!geomTarget) return

      this._geometry = geom
      this._geometryVm = geom?.vm && geom.vm[0]
      geomTarget.setGeometry(geom)
      ++this.rev
    },
  },
}

function defineService () {
  Object.defineProperties(this, {
    $geometry: {
      enumerable: true,
      get: this.getGeometry,
    },
    $geometryVm: {
      enumerable: true,
      get: () => this._geometryVm,
    },
  })
}
