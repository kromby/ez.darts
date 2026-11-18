import { describe, expect, it } from 'vitest'
import { d, stateAfter } from '../../test/play'
import { cricket, type CricketVariant } from './cricket'

const cpu = 'computer-medium-1'
const slots = [{ playerId: cpu }, { playerId: 'anna' }]
const miss3 = ['M', 'M', 'M']

function aimAfter(variant: CricketVariant, darts: string[] = []) {
  const options = { variant }
  return cricket.aim?.(stateAfter(cricket, options, slots, darts), options)
}

describe('Cricket aim', () => {
  it('starts on T20', () => {
    expect(aimAfter('standard')).toEqual(d('T20'))
  })

  it('moves on to the highest number it has not closed', () => {
    expect(aimAfter('standard', ['T20', 'T19', 'M', ...miss3])).toEqual(
      d('T18'),
    )
  })

  it('goes for the bullseye once the numbers are closed', () => {
    const closed = ['T20', 'T19', 'T18', 'M', 'M', 'M']
    const more = ['T17', 'T16', 'T15', 'M', 'M', 'M']
    expect(aimAfter('noScore', [...closed, ...more])).toEqual(d('D25'))
  })

  it('scores on a closed number when behind on points', () => {
    // Anna closes 20 and scores 40; the computer has 19 closed.
    const darts = ['T19', 'M', 'M', 'T20', 'D20', 'D20']
    expect(aimAfter('standard', darts)).toEqual(d('T19'))
  })

  it('closes instead when ahead', () => {
    // 40 up with 20 closed: on to 19, which Anna has closed.
    const darts = ['T20', 'D20', 'M', 'T19', 'M', 'M']
    expect(aimAfter('standard', darts)).toEqual(d('T19'))
  })

  it('in cut-throat, scores when it has more points', () => {
    // Anna closes 20 and gives the computer 40; it has 19 closed.
    const darts = ['T19', 'M', 'M', 'T20', 'D20', 'D20']
    expect(aimAfter('cutThroat', darts)).toEqual(d('T19'))
    // It gave Anna 40, so it is ahead and closes 19.
    const ahead = ['T20', 'D20', 'M', 'T19', 'M', 'M']
    expect(aimAfter('cutThroat', ahead)).toEqual(d('T19'))
  })

  it('never scores with no score kept', () => {
    const darts = ['T19', 'M', 'M', 'T20', 'D20', 'D20']
    expect(aimAfter('noScore', darts)).toEqual(d('T20'))
  })
})
