<template>
  <i
    :id="vmId"
    :class="vmClass"
    style="display: none !important;">
    <slot
      :id="id"
      :properties="properties">
      <PointGeom :coordinates="[0, 0]" />
    </slot>
  </i>
</template>

<script>
  import debounce from 'debounce-promise'
  import { Feature } from 'ol'
  import { merge as mergeObs } from 'rxjs'
  import { map as mapObs, skipWhile } from 'rxjs/operators'
  import { FRAME_TIME, geometryContainer, olCmp, projTransforms, styleContainer } from '../../mixin'
  import {
    cleanFeatureProperties,
    getFeatureId,
    getFeatureProperties,
    initializeFeature,
    setFeatureId,
    setFeatureProperties,
  } from '../../ol-ext'
  import { obsFromOlEvent, obsFromVueEvent } from '../../rx-ext'
  import { assert } from '../../util/assert'
  import { clonePlainObject, hasProp, isEqual, isFunction, omit, stubObject } from '../../util/minilo'
  import mergeDescriptors from '../../util/multi-merge-descriptors'
  import waitFor from '../../util/wait-for'
  import PointGeom from './point-geom.vue'

  /**
   * A vector object for geographic features with a geometry and other attribute properties,
   * similar to the features in vector file formats like **GeoJSON**.
   */
  export default {
    name: 'VlFeature',
    components: {
      PointGeom,
    },
    mixins: [
      projTransforms,
      geometryContainer,
      styleContainer,
      olCmp,
    ],
    props: {
      properties: {
        type: Object,
        default: stubObject,
      },
    },
    computed: {
      currentProperties () {
        if (this.rev && this.$feature) {
          return omit(this.$feature.getProperties(), [
            this.$feature.getGeometryName(),
          ])
        }

        return this.properties
      },
    },
    watch: {
      properties: {
        deep: true,
        async handler (value) {
          await this.setProperties(value)
        },
      },
      currentProperties: {
        deep: true,
        handler: debounce(function (value) {
          if (isEqual(value, this.properties)) return

          this.$emit('update:properties', clonePlainObject(value))
        }, FRAME_TIME),
      },
    },
    created () {
      this::defineServices()
    },
    methods: {
      /**
       * @return {Promise<void>}
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
       * Create feature without inner style applying, feature level style
       * will be applied in the layer level style function.
       * @return {module:ol/Feature~Feature}
       * @protected
       */
      createOlObject () {
        const feature = initializeFeature(this.createFeature(), this.id)
        feature.setGeometry(this.$geometry)

        return feature
      },
      /**
       * @returns {Feature}
       */
      createFeature () {
        return new Feature(this.properties)
      },
      /**
       * @return {string[]}
       */
      triggerProps () {
        return [
          ...this::geometryContainer.methods.triggerProps(),
          ...this::styleContainer.methods.triggerProps(),
          ...this::olCmp.methods.triggerProps(),
          'currentProperties',
        ]
      },
      /**
       * @return {Promise<void>}
       * @protected
       */
      async beforeMount () {
        try {
          await waitFor(
            () => this.$geometryVm != null,
            obsFromVueEvent(this.$eventBus, [
              this.$olObjectEventEnum.CREATE_ERROR,
              this.$olObjectEventEnum.MOUNT_ERROR,
            ]).pipe(
              mapObs(([vm]) => hasProp(vm, '$geometry') && this.$vq.find(vm).length),
            ),
            1000,
          )

          return this::olCmp.methods.beforeMount()
        } catch (err) {
          err.message = 'Wait for $geometry failed: ' + err.message
          throw err
        }
      },
      /**
       * @return {Promise<void>}
       * @protected
       */
      async mount () {
        if (this.$featuresContainer) {
          await this.$featuresContainer.addFeature(this)
        }

        return this::olCmp.methods.mount()
      },
      /**
       * @return {Promise<void>}
       * @protected
       */
      async unmount () {
        if (this.$featuresContainer) {
          await this.$featuresContainer.removeFeature(this)
        }

        return this::olCmp.methods.unmount()
      },
      /**
       * @return {void}
       * @protected
       */
      subscribeAll () {
        this::olCmp.methods.subscribeAll()
        this::subscribeToEvents()
      },
      /**
       * @return {Object}
       * @protected
       */
      getServices () {
        const vm = this

        return mergeDescriptors(
          this::olCmp.methods.getServices(),
          this::geometryContainer.methods.getServices(),
          this::styleContainer.methods.getServices(),
          {
            get featureVm () { return vm },
          },
        )
      },
      resolveFeature: olCmp.methods.resolveOlObject,
      getGeometryTarget: olCmp.methods.resolveOlObject,
      getStyleTarget: olCmp.methods.resolveOlObject,
      /**
       * @return {Promise<string|number>}
       */
      async getId () {
        return getFeatureId(await this.resolveFeature())
      },
      /**
       * @param {string|number} id
       * @return {Promise<void>}
       */
      async setId (id) {
        assert(!!id, 'Invalid feature id')

        if (id === await this.getId()) return

        setFeatureId(await this.resolveFeature(), id)
      },
      /**
       * @return {Promise<string>}
       */
      async getGeometryName () {
        return (await this.resolveFeature()).getGeometryName()
      },
      /**
       * @param {string} geometryName
       * @return {Promise<void>}
       */
      async setGeometryName (geometryName) {
        if (geometryName === await this.getGeometryName()) return

        (await this.resolveFeature()).setGeometryName(geometryName)
      },
      /**
       * @return {Promise<Object>}
       */
      async getProperties () {
        return getFeatureProperties(await this.resolveFeature())
      },
      /**
       * @param {Object} properties
       * @return {Promise<void>}
       */
      async setProperties (properties) {
        if (isEqual(cleanFeatureProperties(properties), await this.getProperties())) return

        setFeatureProperties(await this.resolveFeature(), properties)
      },
      /**
       * Checks if feature lies at `pixel`.
       * @param {number[]} pixel
       * @return {Promise<boolean>}
       */
      async isAtPixel (pixel) {
        const selfFeature = await this.resolveFeature()
        let layerFilter
        if (this.$layerVm) {
          const selfLayer = await this.$layerVm.resolveLayer()
          layerFilter = layer => layer === selfLayer
        }

        return this.$mapVm.forEachFeatureAtPixel(pixel, feature => feature === selfFeature, { layerFilter })
      },
      /**
       * @param {FeatureLike} feature
       * @return {Promise<void>}
       * @protected
       */
      async mergeWith (feature) {
        if (!feature) return
        if (isFunction(feature.resolveOlObject)) {
          feature = await feature.resolveOlObject()
        }
        if (feature === await this.resolveFeature()) return

        await this.setProperties({ ...feature.getProperties() })
        await this.mergeGeometryWith(feature.getGeometry())
        await this.mergeStyleWith(feature.getStyle())
      },
    },
  }

  function defineServices () {
    Object.defineProperties(this, {
      $feature: {
        enumerable: true,
        get: () => this.$olObject,
      },
      $layerVm: {
        enumerable: true,
        get: () => this.$services?.layerVm,
      },
      $mapVm: {
        enumerable: true,
        get: () => this.$services?.mapVm,
      },
      $featuresContainer: {
        enumerable: true,
        get: () => this.$services?.featuresContainer,
      },
    })
  }

  async function subscribeToEvents () {
    const propChanges = obsFromOlEvent(
      this.$feature,
      'propertychange',
      ({ key }) => {
        switch (key) {
          case this.$feature.getGeometryName():
            return {
              prop: 'geometry',
              value: this.getGeometry() && this.writeGeometryInDataProj(this.getGeometry()),
              compareWith: this.geometryDataProj,
            }
          default:
            return {
              prop: 'properties',
              value: {
                ...this.properties,
                [key]: this.$feature.get(key),
              },
              compareWith: this.currentProperties,
            }
        }
      },
    ).pipe(
      skipWhile(({ value, compareWith }) => isEqual(value, compareWith)),
    )
    const changes = obsFromOlEvent(this.$feature, 'change')
    const events = mergeObs(
      propChanges,
      changes,
    )
    this.subscribeTo(events, () => {
      ++this.rev
    })
  }
</script>
