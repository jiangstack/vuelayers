import Vue from 'vue'
import { hasProp } from '../util/minilo'

export const EVENT_BUS_PROP = '$vlEventBus'

export default {
  created () {
    initEventBus()
    // define local getter
    Object.defineProperties(this, {
      $EVENT_BUS_PROP: {
        enumerable: true,
        get: () => EVENT_BUS_PROP,
      },
      /**
       * @type {Vue}
       */
      $eventBus: {
        enumerable: true,
        get: () => this[EVENT_BUS_PROP],
      },
    })
  },
}

function initEventBus () {
  if (
    hasProp(Vue, EVENT_BUS_PROP) ||
    hasProp(Vue.prototype, EVENT_BUS_PROP)
  ) return

  const bus = new Vue()

  if (!hasProp(Vue, EVENT_BUS_PROP)) {
    Object.defineProperties(Vue, {
      [EVENT_BUS_PROP]: {
        enumerable: true,
        get: () => bus,
      },
    })
  }

  if (!hasProp(Vue.prototype, EVENT_BUS_PROP)) {
    Object.defineProperties(Vue.prototype, {
      [EVENT_BUS_PROP]: {
        enumerable: true,
        get: () => bus,
      },
    })
  }
}
