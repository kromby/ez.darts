import { describe, expect, it } from 'vitest'
import { fits, isValidDart, points, type FitRule } from '../../engine/dart'
import { checkoutHint, checkouts, formatRoute, type Route } from './checkout'

const best = (remaining: number, darts: number, out: FitRule = 'double') => {
  const hint = checkoutHint(remaining, darts, out)
  return hint && formatRoute(hint.best)
}

/** A route is a real finish: it adds up, never busts, ends on the out rule. */
function expectFinish(route: Route, remaining: number, out: FitRule) {
  expect(route.every(isValidDart)).toBe(true)
  expect(route.reduce((sum, d) => sum + points(d), 0)).toBe(remaining)
  expect(fits(route[route.length - 1], out)).toBe(true)
  let left = remaining
  for (const d of route.slice(0, -1)) {
    left -= points(d)
    expect(left).toBeGreaterThan(out === 'single' ? 0 : 1)
  }
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

/** Scores no 3 darts finish on a double. */
const bogeys = [159, 162, 163, 165, 166, 168, 169]

describe('checkouts with 3 darts, double out', () => {
  it.each(range(2, 170).filter((r) => !bogeys.includes(r)))(
    'finishes %i',
    (remaining) => {
      const hint = checkoutHint(remaining, 3, 'double')
      const route = hint?.best ?? []
      expect(route.length).toBeGreaterThan(0)
      expect(route.length).toBeLessThanOrEqual(3)
      expectFinish(route, remaining, 'double')
      // The alternative, or the best route again when there is none.
      const alternative = hint?.alternative ?? route
      expectFinish(alternative, remaining, 'double')
      expect(alternative).toHaveLength(route.length)
    },
  )

  it.each(bogeys)('has no finish for %i', (remaining) => {
    expect(checkoutHint(remaining, 3, 'double')).toBeNull()
  })

  it('has none above 170 or below 2', () => {
    expect(best(171, 3)).toBeNull()
    expect(best(180, 3)).toBeNull()
    expect(best(1, 3)).toBeNull()
    expect(best(0, 3)).toBeNull()
  })

  it('suggests the well-known finishes', () => {
    expect(best(170, 3)).toBe('T20 T20 D25')
    expect(best(167, 3)).toBe('T20 T19 D25')
    expect(best(164, 3)).toBe('T20 T18 D25')
    expect(best(160, 3)).toBe('T20 T20 D20')
    expect(best(121, 3)).toBe('T20 T15 D8')
    expect(best(101, 3)).toBe('T17 D25')
    expect(best(81, 3)).toBe('T19 D12')
    expect(best(61, 3)).toBe('T15 D8')
    expect(best(100, 3)).toBe('T20 D20')
    expect(best(60, 3)).toBe('S20 D20')
    expect(best(50, 3)).toBe('D25')
    expect(best(40, 3)).toBe('D20')
    expect(best(32, 3)).toBe('D16')
    expect(best(2, 3)).toBe('D1')
  })

  it('takes the fewest darts', () => {
    for (let remaining = 2; remaining <= 170; remaining++) {
      const routes = checkouts(remaining, 3, 'double')
      if (routes.length === 0) continue
      const fewest = Math.min(...routes.map((route) => route.length))
      expect(routes[0]).toHaveLength(fewest)
    }
  })
})

describe('checkouts with fewer darts', () => {
  it('finishes with 1 dart only on a double', () => {
    for (let remaining = 1; remaining <= 60; remaining++) {
      const expected =
        remaining === 50
          ? 'D25'
          : remaining % 2 === 0 && remaining <= 40
            ? `D${remaining / 2}`
            : null
      expect(best(remaining, 1)).toBe(expected)
    }
  })

  it('finishes with 2 darts up to 110', () => {
    expect(best(110, 2)).toBe('T20 D25')
    expect(best(104, 2)).toBe('T18 D25')
    expect(best(100, 2)).toBe('T20 D20')
    expect(best(111, 2)).toBeNull()
    expect(best(99, 2)).toBeNull()
    for (let remaining = 2; remaining <= 110; remaining++) {
      const hint = checkoutHint(remaining, 2, 'double')
      if (hint) expectFinish(hint.best, remaining, 'double')
      expect(hint?.best.length ?? 0).toBeLessThanOrEqual(2)
    }
  })

  it('has nothing without darts', () => {
    expect(best(40, 0)).toBeNull()
  })
})

describe('checkouts for other out rules', () => {
  it('finishes up to 180 with single out, bar a few that no 3 darts make', () => {
    const finishes = range(1, 180).map((remaining) =>
      checkoutHint(remaining, 3, 'single'),
    )
    expect(
      range(1, 180).filter((_, index) => finishes[index] === null),
    ).toEqual([163, 166, 169, 172, 173, 175, 176, 178, 179])
    finishes.forEach((hint, index) => {
      if (hint) expectFinish(hint.best, index + 1, 'single')
    })
    expect(best(181, 3, 'single')).toBeNull()
    expect(best(180, 3, 'single')).toBe('T20 T20 T20')
    expect(best(20, 1, 'single')).toBe('S20')
    expect(best(1, 1, 'single')).toBe('S1')
  })

  it('finishes on a double or treble with master out', () => {
    for (let remaining = 2; remaining <= 180; remaining++) {
      const hint = checkoutHint(remaining, 3, 'master')
      if (hint) expectFinish(hint.best, remaining, 'master')
    }
    expect(best(180, 3, 'master')).toBe('T20 T20 T20')
    expect(best(60, 1, 'master')).toBe('T20')
    expect(best(40, 1, 'master')).toBe('D20')
    expect(best(3, 1, 'master')).toBe('T1')
    expect(best(1, 3, 'master')).toBeNull()
  })
})

describe('checkout alternatives', () => {
  it('offers a second finish with as many darts', () => {
    const hint = checkoutHint(100, 2, 'double')
    expect(hint?.alternative).not.toBeNull()
    expect(formatRoute(hint?.alternative ?? [])).not.toBe('T20 D20')
  })

  it('offers none when the only other finishes take more darts', () => {
    expect(checkoutHint(2, 3, 'double')?.alternative).toBeNull()
  })
})
