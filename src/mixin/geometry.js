import debounce from 'debounce-promise'
import { boundingExtent } from 'ol/extent'
import { merge as mergeObs } from 'rxjs'
import { map as mapObs, skipWhile } from 'rxjs/operators'
import {
  findPointOnSurface,
  flatCoords,
  getGeometryId,
  initializeGeometry,
  roundCoords,
  setGeometryId,
  transformPoint,
  transforms,
} from '../ol-ext'
import { obsFromOlChangeEvent, obsFromOlEvent, obsFromVueEvent } from '../rx-ext'
import { addPrefix, clonePlainObject, hasProp, isEqual, pick } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import waitFor from '../util/wait-for'
import olCmp, { FRAME_TIME } from './ol-cmp'
import projTransforms from './proj-transforms'
import stubVNode from './stub-vnode'

/**
 * Base geometry mixin.
 */
export default {
  mixins: [
    stubVNode,
    projTransforms,
    olCmp,
  ],
  stubVNode: {
    empty () {
      return this.vmId
    },
  },
  computed: {
    type () {
      if (!(this.rev && this.$geometry)) return

      return this.$geometry.getType()
    },
    coordinatesDataProj () {
      if (!(this.rev && this.$geometry)) return []

      return this.coordinatesToDataProj(this.$geometry.getCoordinates())
    },
    coordinatesViewProj () {
      if (!(this.rev && this.$geometry)) return []

      return roundCoords(this.$geometry.getCoordinates())
    },
    extentDataProj () {
      if (!this.type) return

      return boundingExtent(flatCoords(this.type, this.coordinatesDataProj))
    },
    extentViewProj () {
      if (!this.type) return

      return boundingExtent(flatCoords(this.type, this.coordinatesViewProj))
    },
    pointDataProj () {
      if (!this.type) return

      return findPointOnSurface({
        type: this.type,
        coordinates: this.coordinatesDataProj,
      })
    },
    pointViewProj () {
      if (!this.pointDataProj) return

      return transformPoint(this.pointDataProj, this.resolvedDataProjection, this.viewProjection)
    },
  },
  watch: {
    coordinatesDataProj: {
      deep: true,
      handler: debounce(async function (value, prev) {
        await this.onCoordinatesChanged(value, prev)
      }, FRAME_TIME),
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
     * @return {Promise<module:ol/geom/Geometry~Geometry>}
     * @protected
     */
    async createOlObject () {
      return initializeGeometry(await this.createGeometry(), this.id)
    },
    /**
     * @return {module:ol/geom/Geometry~Geometry|Promise<module:ol/geom/Geometry~Geometry>}
     * @protected
     * @abstract
     */
    createGeometry () {
      throw new Error('Not implemented method: createGeometry')
    },
    /**
     * @return {string[]}
     */
    triggerProps () {
      return [
        ...this::olCmp.methods.triggerProps(),
        'type',
        'coordinatesDataProj',
        'coordinatesViewProj',
      ]
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async mount () {
      if (this.$geometryContainer) {
        await this.$geometryContainer.setGeometry(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {Promise<void>}
     * @protected
     */
    async unmount () {
      if (this.$geometryContainer) {
        await this.$geometryContainer.setGeometry(null)
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
          get geometryVm () { return vm },
        },
      )
    },
    /**
     * @returns {void}
     */
    subscribeAll () {
      this::olCmp.methods.subscribeAll()
      this::subscribeToGeometryEvents()
    },
    /**
     * @return {Promise<module:ol/geom/Geometry~Geometry>}
     */
    resolveGeometry: olCmp.methods.resolveOlObject,
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
      return getGeometryId(await this.resolveGeometry())
    },
    /**
     * @param {string|number} id
     * @returns {Promise<void>}
     */
    async setId (id) {
      if (id === await this.getId()) return

      setGeometryId(await this.resolveGeometry(), id)
    },
    /**
     * @returns {Promise<string>}
     */
    async getType () {
      return (await this.resolveGeometry()).getType()
    },
    /**
     * @param {number[]} [extent]
     * @returns {Promise<number[]>}
     */
    async getExtent (extent) {
      extent = extent != null ? this.extentToViewProj(extent) : undefined

      return this.extentToDataProj((await this.resolveGeometry()).getExtent(extent))
    },
    /**
     * @param {number[]} point
     * @param {number[]} [closestPoint]
     * @returns {Promise<number[]>}
     */
    async getClosestPoint (point, closestPoint) {
      point = this.pointToViewProj(point)
      closestPoint = closestPoint != null ? this.pointToViewProj(closestPoint) : undefined

      return this.pointToDataProj((await this.resolveGeometry()).getClosestPoint(point, closestPoint))
    },
    /**
     * @param {number[]} coordinate
     * @returns {Promise<boolean>}
     */
    async isIntersectsCoordinate (coordinate) {
      return (await this.resolveGeometry()).intersectsCoordinate(this.pointToViewProj(coordinate))
    },
    /**
     * @param {number[]} extent
     * @returns {Promise<boolean>}
     */
    async isIntersectsExtent (extent) {
      return (await this.resolveGeometry()).intersectsExtent(this.extentToViewProj(extent))
    },
    /**
     * @param {number} angle Angle in radians
     * @param {number[]} anchor
     * @returns {Promise<void>}
     */
    async rotate (angle, anchor) {
      (await this.resolveGeometry()).rotate(angle, this.pointToViewProj(anchor))
    },
    /**
     * @param {number} sx
     * @param {number} [sy]
     * @param {number[]} [anchor]
     * @returns {Promise<void>}
     */
    async scale (sx, sy, anchor) {
      (await this.resolveGeometry()).scale(sx, sy, anchor && this.pointToViewProj(anchor))
    },
    /**
     * @param {number} tolerance
     * @returns {Promise<module:ol/geom/Geometry~Geometry>}
     */
    async simplify (tolerance) {
      return (await this.resolveGeometry()).simplify(tolerance)
    },
    /**
     * @param dx
     * @param dy
     * @returns {Promise<*>}
     */
    async translate (dx, dy) {
      return (await this.resolveGeometry()).translate(dx, dy)
    },
    /**
     * @returns {function}
     */
    getCoordinatesTransformFunction () {
      return transforms[this.type].transform
    },
    /**
     * @param {number[]} coordinates
     * @returns {Promise<number[]>}
     */
    coordinatesToDataProj (coordinates) {
      const transform = this.getCoordinatesTransformFunction()

      return transform(coordinates, this.viewProjection, this.resolvedDataProjection)
    },
    /**
     * @param {number[]} coordinates
     * @returns {Promise<number[]>}
     */
    coordinatesToViewProj (coordinates) {
      const transform = this.getCoordinatesTransformFunction()

      return transform(coordinates, this.resolvedDataProjection, this.viewProjection)
    },
    onCoordinatesChanged (coordinates, prevCoordinates) {
      if (isEqual(coordinates, prevCoordinates)) return

      this.$emit('update:coordinates', clonePlainObject(coordinates))
    },
  },
}

function defineServices () {
  Object.defineProperties(this, {
    /**
     * @type {module:ol/geom/Geometry~Geometry|undefined}
     */
    $geometry: {
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
    $geometryContainer: {
      enumerable: true,
      get: () => this.$services?.geometryContainer,
    },
  })
}

async function subscribeToGeometryEvents () {
  const prefixKey = addPrefix('current')
  const propChanges = obsFromOlChangeEvent(this.$geometry, [
    'id',
  ], true, evt => ({
    ...evt,
    compareWith: this[prefixKey(evt.prop)],
  })).pipe(
    skipWhile(({ compareWith, value }) => isEqual(value, compareWith)),
  )
  const changes = obsFromOlEvent(this.$geometry, 'change')
  const events = mergeObs(
    propChanges,
    changes,
  )
  this.subscribeTo(events, () => {
    ++this.rev
  })
}
