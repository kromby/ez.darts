import { describe, expect, it } from 'vitest'
import { seededRandom } from '../test/seededRandom'
import {
  aimPoint,
  boardOrder,
  computerId,
  computerLevels,
  dartAt,
  isComputer,
  nextComputerId,
  parseComputer,
  rivalId,
  spread,
  throwAt,
  undoCount,
  type ComputerLevel,
} from './computer'
import { BULL, MISS, dart, type Dart } from './dart'

const T20 = dart(20, 3)

/** Throws `count` darts at a target with a fixed seed. */
function throws(target: Dart, level: ComputerLevel, count = 2000) {
  const random = seededRandom(51)
  return Array.from({ length: count }, () => throwAt(target, level, random))
}

const share = (darts: Dart[], hit: (d: Dart) => boolean) =>
  darts.filter(hit).length / darts.length

const same = (a: Dart) => (b: Dart) =>
  a.segment === b.segment && a.multiplier === b.multiplier

describe('computer ids', () => {
  it('keeps the level and number in the id', () => {
    expect(computerId('hard', 2)).toBe('computer-hard-2')
    expect(parseComputer('computer-easy-1')).toEqual({
      level: 'easy',
      number: 1,
    })
    expect(parseComputer('computer-expert-1')).toBeNull()
    expect(parseComputer('computer-hard-0')).toBeNull()
    expect(isComputer('anna')).toBe(false)
  })

  it('is one rival per level in head to head', () => {
    expect(rivalId('computer-hard-1')).toBe('computer-hard')
    expect(rivalId('computer-hard-2')).toBe('computer-hard')
    expect(rivalId('anna')).toBe('anna')
    expect(parseComputer('computer-hard')).toEqual({ level: 'hard', number: 1 })
  })

  it('numbers computers of a level from the first free number', () => {
    expect(nextComputerId('hard', ['anna'])).toBe('computer-hard-1')
    expect(
      nextComputerId('hard', [
        'computer-hard-1',
        'computer-easy-2',
        'computer-hard-3',
      ]),
    ).toBe('computer-hard-2')
    expect(nextComputerId('easy', ['computer-hard-1'])).toBe('computer-easy-1')
  })
})

describe('the board model', () => {
  it('lands every aim point in the bed aimed for', () => {
    for (const segment of boardOrder) {
      for (const multiplier of [1, 2, 3] as const) {
        const target = dart(segment, multiplier)
        expect(dartAt(aimPoint(target))).toEqual(target)
      }
    }
    expect(dartAt(aimPoint(dart(BULL, 2)))).toEqual(dart(BULL, 2))
  })

  it('knows the bull, the rings, the edges and off the board', () => {
    expect(dartAt({ x: 0, y: 10 })).toEqual(dart(BULL, 1))
    expect(dartAt({ x: 0, y: 103 })).toEqual(dart(20, 3))
    expect(dartAt({ x: 0, y: 166 })).toEqual(dart(20, 2))
    expect(dartAt({ x: 0, y: -60 })).toEqual(dart(3, 1))
    expect(dartAt({ x: 60, y: 0 })).toEqual(dart(6, 1))
    expect(dartAt({ x: -60, y: 0 })).toEqual(dart(11, 1))
    expect(dartAt({ x: 0, y: 171 })).toEqual(MISS)
  })

  it("puts the 20's neighbours either side of it", () => {
    expect(dartAt({ x: 20, y: 103 })).toEqual(dart(1, 3))
    expect(dartAt({ x: -20, y: 103 })).toEqual(dart(5, 3))
  })
})

describe('throwAt', () => {
  it('hits the target more often the harder the computer', () => {
    const hits = Object.fromEntries(
      computerLevels.map((level) => [
        level,
        share(throws(T20, level), same(T20)),
      ]),
    )
    expect(hits.hard).toBeGreaterThan(hits.medium)
    expect(hits.medium).toBeGreaterThan(hits.easy)
    // About a third, one in ten and one in thirty.
    expect(hits.hard).toBeGreaterThan(0.25)
    expect(hits.hard).toBeLessThan(0.45)
    expect(hits.medium).toBeGreaterThan(0.06)
    expect(hits.medium).toBeLessThan(0.15)
    expect(hits.easy).toBeLessThan(0.06)
  })

  it('scatters as far as each level’s spread', () => {
    for (const level of computerLevels) {
      const random = seededRandom(7)
      const aim = aimPoint(dart(BULL, 2))
      // Bulls and the bullseye: a wider spread lands fewer of them.
      const darts = Array.from({ length: 2000 }, () =>
        throwAt(dart(BULL, 2), level, random),
      )
      const bulls = share(darts, (d) => d.segment === BULL)
      // Inside the outer bull (15.9 mm): 1 - exp(-r² / 2σ²).
      const expected = 1 - Math.exp(-(15.9 ** 2) / (2 * spread[level] ** 2))
      expect(bulls).toBeCloseTo(expected, 1)
      expect(aim).toEqual({ x: 0, y: 0 })
    }
  })

  it('misses to the neighbours, singles and off the board', () => {
    const easy = throws(T20, 'easy')
    expect(
      share(easy, (d) => d.segment === 1 || d.segment === 5),
    ).toBeGreaterThan(0.1)
    expect(
      share(easy, (d) => d.segment === 20 && d.multiplier === 1),
    ).toBeGreaterThan(0.1)
    const doubles = throws(dart(20, 2), 'easy')
    expect(share(doubles, (d) => d.multiplier === 0)).toBeGreaterThan(0.3)
  })

  it('throws the same darts for the same random numbers', () => {
    expect(throws(T20, 'medium', 20)).toEqual(throws(T20, 'medium', 20))
  })
})

describe('undoCount', () => {
  const thrown = (playerId: string) => ({ playerId, dart: T20 })

  it('takes back the computers’ darts and the last person’s dart', () => {
    expect(
      undoCount([
        thrown('anna'),
        thrown('anna'),
        thrown('computer-hard-1'),
        thrown('computer-hard-1'),
      ]),
    ).toBe(3)
    expect(undoCount([thrown('computer-hard-1'), thrown('anna')])).toBe(1)
  })

  it('takes nothing back before a person has thrown', () => {
    expect(undoCount([])).toBe(0)
    expect(undoCount([thrown('computer-easy-1')])).toBe(0)
  })
})
