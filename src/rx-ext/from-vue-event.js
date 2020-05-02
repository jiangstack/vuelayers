import { fromEventPattern, merge as mergeObs } from 'rxjs'
import { map as mapObs } from 'rxjs/operators'
import { identity } from '../util/minilo'

export default function fromVueEvent (target, eventName, selector) {
  if (Array.isArray(eventName)) {
    return mergeObs(
      ...eventName.map(
        elem => {
          let eventName, selector

          if (typeof elem === 'object') {
            eventName = elem.event
            selector = elem.selector
          } else {
            eventName = elem
          }

          return fromVueEvent(target, eventName, selector)
        },
      ),
    )
  }

  selector || (selector = identity)

  return fromEventPattern(
    handler => target.$on(eventName, handler),
    handler => target.$off(eventName, handler),
  ).pipe(mapObs(selector))
}
