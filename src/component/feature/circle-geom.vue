<script>
  import debounce from 'debounce-promise'
  import { boundingExtent } from 'ol/extent'
  import { Circle } from 'ol/geom'
  import GeometryType from 'ol/geom/GeometryType'
  import { simpleGeometry, FRAME_TIME } from '../../mixin'
  import { COORD_PRECISION, EPSG_3857, roundCoords, transformExtent, transformPoint } from '../../ol-ext'
  import { constant, isEqual, round } from '../../util/minilo'

  export default {
    name: 'VlGeomCircle',
    mixins: [
      simpleGeometry,
    ],
    props: {
      coordinates: {
        type: Array,
        required: true,
        validator: value => value.length === 2,
      },
      /**
       * Circle radius always in meters.
       * @type {number}
       */
      radius: {
        type: Number,
        default: 0,
      },
    },
    computed: {
      type: constant(GeometryType.CIRCLE),
      roundRadius () {
        return round(this.radius, COORD_PRECISION)
      },
      center_3857 () {
        return transformPoint(this.coordinatesDataProj, this.resolvedDataProjection, EPSG_3857)
      },
      extentDataProj () {
        return transformExtent(boundingExtent([
          [this.center_3857[0] - this.roundRadius, this.center_3857[1] - this.roundRadius],
          [this.center_3857[0] + this.roundRadius, this.center_3857[1] + this.roundRadius],
        ]), EPSG_3857, this.resolvedDataProjection)
      },
      extentViewProj () {
        return this.extentToViewProj(this.extentDataProj)
      },
      currentCoordinatesViewProj () {
        if (!this.type) return []
        if (this.rev && this.$geometry) {
          return roundCoords(this.type, this.$geometry.getCenter())
        }

        return this.coordinatesViewProj
      },
      currentRadius () {
        if (this.rev && this.$geometry) {
          return round(this.$geometry.getRadius(), COORD_PRECISION)
        }

        return this.roundRadius
      },
      currentCenter_3857 () {
        return transformPoint(this.currentCoordinatesDataProj, this.resolvedDataProjection, EPSG_3857)
      },
      currentExtentDataProj () {
        return transformExtent(boundingExtent([
          [this.currentCenter_3857[0] - this.currentRadius, this.currentCenter_3857[1] - this.currentRadius],
          [this.currentCenter_3857[0] + this.currentRadius, this.currentCenter_3857[1] + this.currentRadius],
        ]), EPSG_3857, this.resolvedDataProjection)
      },
      currentExtentViewProj () {
        return this.extentToViewProj(this.currentExtentDataProj)
      },
    },
    watch: {
      async roundRadius (value) {
        await this.setRadius(value)
      },
      currentRadius: debounce(function (value) {
        if (value === this.roundRadius) return

        this.$emit('update:radius', value)
      }, FRAME_TIME),
    },
    methods: {
      /**
       * @return {Circle}
       * @protected
       */
      createGeometry () {
        return new Circle(this.currentCoordinatesViewProj, this.currentRadius)
      },
      /**
       * @return {Promise<number[]>}
       */
      getCoordinates () {
        return this.getCenter()
      },
      /**
       * @param {number[]} coordinate
       */
      async setCoordinates (coordinate) {
        await this.setCenter(coordinate)
      },
      async getCenter () {
        return this.pointToDataProj((await this.resolveGeometry()).getCenter())
      },
      async setCenter (center) {
        if (isEqual(center, await this.getCenter())) return

        (await this.resolveGeometry()).setCenter(this.pointToViewProj(center))
      },
      async setCenterAndRadius (center, radius) {
        if (
          radius === await this.getRadius() &&
          isEqual(center, await this.getCenter())
        ) return

        (await this.resolveGeometry()).setCenterAndRadius(
          this.pointToViewProj(center),
          round(radius, COORD_PRECISION),
        )
      },
      async getRadius () {
        return round((await this.resolveGeometry()).getRadius(), COORD_PRECISION)
      },
      async setRadius (radius) {
        if (radius === await this.getRadius()) return

        (await this.resolveGeometry()).setRadius(round(radius, COORD_PRECISION))
      },
      async mergeWithInternal (geom) {
        await this.setCenterAndRadius(this.coordinatesToDataProj(geom.getCenter()), geom.getRadius())
      },
    },
  }
</script>
