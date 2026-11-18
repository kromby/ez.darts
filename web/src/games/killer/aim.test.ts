import { describe, expect, it } from 'vitest'
import { d, stateAfter } from '../../test/play'
import { killer, type KillerOptions } from './killer'

const cpu = 'computer-hard-1'
const slots = [{ playerId: cpu }, { playerId: 'anna' }, { playerId: 'oli' }]
const miss3 = ['M', 'M', 'M']

function aimAfter(options: Partial<KillerOptions>, darts: string[] = []) {
  const full: KillerOptions = {
    assign: 'random',
    mode: 'lives',
    hitsToKiller: 3,
    lives: 3,
    selfHit: false,
    numbers: { [cpu]: 7, anna: 20, oli: 19 },
    ...options,
  }
  return killer.aim?.(stateAfter(killer, full, slots, darts), full)
}

describe('Killer aim', () => {
  it('aims at the double of its own number to become a killer', () => {
    expect(aimAfter({})).toEqual(d('D7'))
  })

  it('as a killer, aims at the double of the weakest player still in', () => {
    // Everyone has three lives, so Anna (first in order) is the weakest
    // until someone loses one.
    const becomeKiller = ['T7', 'M', 'M', ...miss3, ...miss3]
    expect(aimAfter({}, becomeKiller)).toEqual(d('D20'))
    const hitAnna = [...becomeKiller, 'S20', 'M', 'M', ...miss3, ...miss3]
    expect(aimAfter({}, hitAnna)).toEqual(d('D20'))
    const hitOli = [...becomeKiller, 'D19', 'M', 'M', ...miss3, ...miss3]
    expect(aimAfter({}, hitOli)).toEqual(d('D19'))
  })

  it('claims the highest free number before the game', () => {
    const options = { assign: 'throw' as const, numbers: null }
    expect(aimAfter(options)).toEqual(d('S20'))
    // With 20 taken, Anna's best claim is 19.
    expect(aimAfter(options, ['S20'])).toEqual(d('S19'))
  })
})
