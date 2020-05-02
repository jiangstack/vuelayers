import debounce from 'debounce-promise'
import { boundingExtent } from 'ol/extent'
import { findPointOnSurface, flatCoords, isEqualCoord, roundCoords, transformPoint } from '../ol-ext'
import { clonePlainObject, isEmpty, negate, pick } from '../util/minilo'
// import { makeWatchers } from '../util/vue-helpers'
import geometry from './geometry'
import { FRAME_TIME } from './ol-cmp'

/**
 * Base simple geometry with coordinates mixin.
 */
export default {
  mixins: [
    geometry,
  ],
  props: {
    // ol/geom/SimpleGeometry
    /**
     * @type {number[]} Coordinates in map data projection
     */
    coordinates: {
      type: Array,
      required: true,
      validator: negate(isEmpty),
    },
    // todo add support of coord layout
    // /**
    //  * @type {string}
    //  */
    // layout: {
    //   type: String,
    //   default: GeometryLayout.XY,
    //   validator: value => Object.values(GeometryLayout).includes(value.toUpperCase()),
    // },
  },
  computed: {
    coordinatesDataProj () {
      if (!this.type) return []

      return roundCoords(this.type, this.coordinates)
    },
    coordinatesViewProj () {
      return this.coordinatesToViewProj(this.coordinates)
    },
    currentCoordinatesDataProj () {
      return this.coordinatesToDataProj(this.currentCoordinatesViewProj)
    },
    currentCoordinatesViewProj () {
      if (!this.type) return []
      if (this.rev && this.$geometry) {
        return roundCoords(this.type, this.$geometry.getCoordinates())
      }

      return this.coordinatesViewProj
    },
    currentExtentDataProj () {
      if (!this.type) return

      return boundingExtent(flatCoords(this.type, this.currentCoordinatesDataProj))
    },
    currentExtentViewProj () {
      if (!this.type) return

      return boundingExtent(flatCoords(this.type, this.currentCoordinatesViewProj))
    },
    currentPointDataProj () {
      if (!this.type) return

      return findPointOnSurface({
        type: this.type,
        coordinates: this.currentCoordinatesDataProj,
      })
    },
    currentPointViewProj () {
      if (!this.pointDataProj) return

      return transformPoint(this.currentPointDataProj, this.resolvedDataProjection, this.viewProjection)
    },
    // layoutUpCase () {
    //   return this.layout.toUpperCase()
    // },
  },
  watch: {
    currentCoordinatesDataProj: {
      deep: true,
      handler: debounce(function (value) {
        if (isEqualCoord({
          coordinates: value,
          extent: boundingExtent(flatCoords(this.type, value)),
        }, {
          coordinates: this.coordinatesDataProj,
          extent: this.extentDataProj,
        })) return

        this.$emit('update:coordinates', clonePlainObject(value))
      }, FRAME_TIME),
    },
    async resolvedDataProjection () {
      await this.setCoordinates(this.coordinatesDataProj)
    },
    // ...makeWatchers([
    //   'layoutUpCase',
    // ], () => geometry.methods.scheduleRecreate),
  },
  methods: {
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::geometry.methods.triggerProps(),
        'currentCoordinatesDataProj',
        'currentCoordinatesViewProj',
        'currentExtentDataProj',
        'currentExtentViewProj',
        'currentPointDataProj',
        'currentPointViewProj',
      ]
    },
    ...pick(geometry.methods, [
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
      'getServices',
      'subscribeAll',
      'resolveOlObject',
      'resolveGeometry',
    ]),
    async onCoordinatesChanged (coordinates) {
      await this.setCoordinates(coordinates)
    },
    /**
     * @return {Promise<number[]>}
     */
    async getCoordinates () {
      return this.coordinatesToDataProj((await this.resolveGeometry()).getCoordinates())
    },
    /**
     * @param {number[]} coordinates
     */
    async setCoordinates (coordinates) {
      coordinates = roundCoords(this.type, coordinates)
      const currentCoordinates = await this.getCoordinates()

      if (isEqualCoord({
        coordinates,
        extent: boundingExtent(flatCoords(this.type, coordinates)),
      }, {
        coordinates: currentCoordinates,
        extent: boundingExtent(flatCoords(this.type, currentCoordinates)),
      })) return

      (await this.resolveGeometry()).setCoordinates(this.coordinatesToViewProj(coordinates))
    },
    /**
     * @returns {number[]>}
     */
    async getFirstCoordinate () {
      const coordinate = (await this.resolveGeometry()).getFirstCoordinate()
      if (!coordinate) return

      return this.pointToDataProj(coordinate)
    },
    /**
     * @returns {Promise<number[]>}
     */
    async getLastCoordinate () {
      const coordinate = (await this.resolveGeometry()).getLastCoordinate()
      if (!coordinate) return

      return this.pointToDataProj(coordinate)
    },
    /**
     * @returns {Promise<string>}
     */
    async getCoordinatesLayout () {
      return (await this.resolveGeometry()).getLayout()
    },
  },
}
