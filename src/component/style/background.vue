<script>
  import { fillStyleContainer, olCmp, strokeStyleContainer, stubVNode } from '../../mixin'
  import { isFunction, stubObject } from '../../util/minilo'
  import mergeDescriptors from '../../util/multi-merge-descriptors'

  export default {
    name: 'VlStyleBackground',
    mixins: [
      stubVNode,
      fillStyleContainer,
      strokeStyleContainer,
      olCmp,
    ],
    stubVNode: {
      empty: false,
      attrs () {
        return {
          id: this.vmId,
          class: this.vmClass,
        }
      },
    },
    created () {
      Object.defineProperties(this, {
        $bgStyleContainer: {
          enumerable: true,
          get: () => this.$services?.bgStyleContainer,
        },
      })
    },
    methods: {
      createOlObject () {
        return stubObject()
      },
      triggerProps () {
        return [
          ...this::fillStyleContainer.methods.triggerProps(),
          ...this::strokeStyleContainer.methods.triggerProps(),
          ...this::olCmp.methods.triggerProps(),
        ]
      },
      getServices () {
        return mergeDescriptors(
          this::olCmp.methods.getServices(),
          this::fillStyleContainer.methods.getServices(),
          this::strokeStyleContainer.methods.getServices(),
        )
      },
      getFill () {
        return this.$bgStyleContainer.getBackgroundFill()
      },
      async setFill (fill) {
        let fillVm
        if (fill && isFunction(fill.resolveOlObject)) {
          fillVm = fill
          fill = await fill.resolveOlObject()
        }

        await this.$bgStyleContainer.setBackgroundFill(fill)

        this._fill = fill
        this._fillVm = fillVm || (fill?.vm && fill.vm[0])
        ++this.rev
      },
      getStroke () {
        return this.$bgStyleContainer.getBackgroundStroke()
      },
      async setStroke (stroke) {
        let strokeVm
        if (stroke && isFunction(stroke.resolveOlObject)) {
          strokeVm = stroke
          stroke = await stroke.resolveOlObject()
        }

        await this.$bgStyleContainer.setBackgroundStroke(stroke)

        this._stroke = stroke
        this._strokeVm = strokeVm || (stroke?.vm && stroke.vm[0])
        ++this.rev
      },
    },
  }
</script>
