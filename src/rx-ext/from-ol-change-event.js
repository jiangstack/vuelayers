import { merge as mergeObs } from 'rxjs'
import { distinctUntilChanged, map as mapObs } from 'rxjs/operators'
import { isEqual, isFunction } from '../util/minilo'
import fromOlEvent from './from-ol-event'

/**
 * Creates Observable from OpenLayers change:* event
 * @param {module:ol/Observable~Observable} target
 * @param {string|string[]} [prop]
 * @param {boolean|function(a, b):boolean|undefined} [distinct] Distinct values by isEqual fn or by custom comparator
 * @param {function|undefined} [selector] Custom selector
 * @return {Observable<{prop: string, value: *}>}
 */
export default function fromOlChangeEvent (
  target,
  prop,
  distinct,
  selector,
) {
  if (Array.isArray(prop)) {
    return mergeObs(...prop.map(p => fromOlChangeEvent(target, p, distinct, selector)))
  }

  selector = selector || ((target, prop) => target.get(prop))
  const event = `change:${prop}`
  const observable = fromOlEvent(target, event, () => selector(target, prop))
  const operations = []

  if (distinct) {
    isFunction(distinct) || (distinct = isEqual)
    operations.push(distinctUntilChanged(distinct))
  }

  operations.push(mapObs(value => ({ prop, value })))

  return observable.pipe(...operations)
}
