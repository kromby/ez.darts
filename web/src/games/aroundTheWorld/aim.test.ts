import { describe, expect, it } from 'vitest'
import { d, stateAfter } from '../../test/play'
import { aroundTheWorld, type AtwOptions } from './aroundTheWorld'

const solo = [{ playerId: 'computer-easy-1' }]

function aimAfter(options: Partial<AtwOptions>, darts: string[] = []) {
  const full: AtwOptions = {
    in: 'single',
    out: 'single',
    bull: false,
    missEndsTurn: false,
    playOn: false,
    ...options,
  }
  return aroundTheWorld.aim?.(
    stateAfter(aroundTheWorld, full, solo, darts),
    full,
  )
}

describe('Around the World aim', () => {
  it('aims at the next number', () => {
    expect(aimAfter({})).toEqual(d('S1'))
    expect(aimAfter({}, ['S1', 'D2'])).toEqual(d('S4'))
  })

  it('aims at a double when the number needs one', () => {
    expect(aimAfter({ in: 'double' })).toEqual(d('D1'))
    // A double moves on two numbers.
    expect(aimAfter({ in: 'double' }, ['D1'])).toEqual(d('S3'))
    const to20 = ['T1', 'T4', 'T7', 'T10', 'T13', 'T16', 'S19']
    expect(aimAfter({ out: 'double' }, to20)).toEqual(d('D20'))
  })

  it('aims at the bull to finish on it', () => {
    const to20 = ['T1', 'T4', 'T7', 'T10', 'T13', 'T16', 'S19', 'S20']
    expect(aimAfter({ bull: true }, to20)).toEqual(d('S25'))
    expect(aimAfter({ bull: true, out: 'double' }, to20)).toEqual(d('D25'))
  })
})
