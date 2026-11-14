import {
  BULL,
  dart,
  fits,
  notation,
  points,
  type Dart,
  type FitRule,
} from '../../engine/dart'
import { currentSide } from '../../engine/turns'
import type { X01State } from './x01'

/** The darts to throw, in order; the last one finishes. */
export type Route = Dart[]

const segments = Array.from({ length: 20 }, (_, index) => 20 - index)

/** Every dart that scores, high numbers first. */
const scoringDarts: Dart[] = [
  ...segments.map((segment) => dart(segment, 3)),
  ...segments.map((segment) => dart(segment, 1)),
  dart(BULL, 1),
  ...segments.map((segment) => dart(segment, 2)),
  dart(BULL, 2),
]

/** Favourite finishing doubles, as on most checkout charts. */
const doubleOrder = [
  20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1,
]
/** The bullseye is a small target: behind the even doubles. */
const bullFinish = 150

/**
 * How hard a dart is to aim for on the way to a finish: big singles are
 * easiest, then high trebles, then the outer bull, and a double last.
 */
function setupCost({ segment, multiplier }: Dart): number {
  if (segment === BULL) return multiplier === 1 ? 300 : 450
  if (multiplier === 1) return 100 + (20 - segment)
  if (multiplier === 3) return 200 + 5 * (20 - segment)
  return 400 + (20 - segment)
}

/** How good a dart is to finish on under the out rule. */
function finishCost(finish: Dart, out: FitRule): number {
  const { segment, multiplier } = finish
  if (multiplier === 2) {
    const rank =
      segment === BULL ? bullFinish : 10 * doubleOrder.indexOf(segment)
    return out === 'single' ? 300 + rank : rank
  }
  if (multiplier === 3) {
    return (out === 'single' ? 400 : 250) + (20 - segment)
  }
  // A single, only allowed with single out.
  return segment === BULL ? 200 : 20 - segment
}

function cost(route: Route, out: FitRule): number {
  const setup = route.slice(0, -1)
  return (
    setup.reduce((total, d) => total + setupCost(d), 0) +
    finishCost(route[route.length - 1], out)
  )
}

/** Fewest darts, then easiest, then highest scoring first dart. */
function compare(a: Route, b: Route, out: FitRule): number {
  return (
    a.length - b.length ||
    cost(a, out) - cost(b, out) ||
    points(b[0]) - points(a[0])
  )
}

/** Setup darts that add up to `total`, as ordered combinations. */
function setups(total: number, count: number, from = 0): Route[] {
  if (count === 0) return total === 0 ? [[]] : []
  const result: Route[] = []
  for (let index = from; index < scoringDarts.length; index++) {
    const first = scoringDarts[index]
    const rest = total - points(first)
    if (rest < 0) continue
    // Later darts come from `index` on, so each combination appears once.
    for (const tail of setups(rest, count - 1, index)) {
      result.push([first, ...tail])
    }
  }
  return result
}

const cache = new Map<string, Route[]>()

/**
 * Every way to finish `remaining` with at most `darts` darts under the out
 * rule, best first. Setup darts go highest first, e.g. `T20 T20 D25`.
 */
export function checkouts(
  remaining: number,
  darts: number,
  out: FitRule,
): Route[] {
  const key = `${out}:${darts}:${remaining}`
  const cached = cache.get(key)
  if (cached) return cached

  const routes: Route[] = []
  if (Number.isInteger(remaining) && remaining > 0) {
    for (const finish of scoringDarts) {
      if (!fits(finish, out) || points(finish) > remaining) continue
      for (let setup = 0; setup < darts; setup++) {
        for (const before of setups(remaining - points(finish), setup)) {
          routes.push([...before, finish])
        }
      }
    }
  }
  routes.sort((a, b) => compare(a, b, out))
  cache.set(key, routes)
  return routes
}

export type CheckoutHint = {
  best: Route
  /** Another finish with as few darts, when there is one. */
  alternative: Route | null
}

export function checkoutHint(
  remaining: number,
  darts: number,
  out: FitRule,
): CheckoutHint | null {
  const [best, next] = checkouts(remaining, darts, out)
  if (!best) return null
  return {
    best,
    alternative: next && next.length === best.length ? next : null,
  }
}

/** `T20 T20 D25`. */
export function formatRoute(route: Route): string {
  return route.map((d) => notation(d)).join(' ')
}

/** The checkout for whoever is throwing, with the darts left this turn. */
export function x01Checkout(state: X01State): CheckoutHint | null {
  const { turns, options } = state
  const score = turns.board[currentSide(turns).id]
  if (!score.opened) return null
  const dartsLeft = turns.dartsPerTurn - turns.dartsThrown
  return checkoutHint(score.remaining, dartsLeft, options.out)
}
