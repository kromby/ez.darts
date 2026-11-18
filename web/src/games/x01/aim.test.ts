import { describe, expect, it } from 'vitest'
import { d, stateAfter } from '../../test/play'
import { x01, type X01Options } from './x01'

const solo = [{ playerId: 'computer-hard-1' }]

function aimAfter(options: Partial<X01Options>, darts: string[] = []) {
  const full: X01Options = {
    startScore: 501,
    in: 'single',
    out: 'double',
    playOn: false,
    ...options,
  }
  return x01.aim?.(stateAfter(x01, full, solo, darts), full)
}

describe('x01 aim', () => {
  it('goes for T20 far from a finish', () => {
    expect(aimAfter({})).toEqual(d('T20'))
    expect(aimAfter({ startScore: 169 })).toEqual(d('T20'))
  })

  it('starts the checkout it can finish this turn, as the hint shows', () => {
    expect(aimAfter({ startScore: 170 })).toEqual(d('T20'))
    expect(aimAfter({ startScore: 40 })).toEqual(d('D20'))
    expect(aimAfter({ startScore: 50 })).toEqual(d('D25'))
    expect(aimAfter({ startScore: 60 })).toEqual(d('S20'))
    expect(aimAfter({ startScore: 16, out: 'single' })).toEqual(d('S16'))
  })

  it('carries on the checkout with the darts left', () => {
    // 100 with one dart left: set up D20 for the next turn.
    expect(aimAfter({ startScore: 140 }, ['S20', 'S20'])).toEqual(d('T20'))
    // 81 with two darts left: T19 then D12.
    expect(aimAfter({ startScore: 101 }, ['S20'])).toEqual(d('T19'))
  })

  it('opens with a double or a treble first', () => {
    expect(aimAfter({ in: 'double' })).toEqual(d('D20'))
    expect(aimAfter({ in: 'master' })).toEqual(d('T20'))
    expect(aimAfter({ in: 'double' }, ['D20'])).toEqual(d('T20'))
  })
})
