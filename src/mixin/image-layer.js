import { pick } from '../util/minilo'
import layer from './layer'

export default {
  mixins: [
    layer,
  ],
  methods: {
    ...pick(layer.methods, [
      'triggerProps',
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
      'subscribeAll',
      'getServices',
      'resolveOlObject',
      'resolveLayer',
    ]),
  },
}
