import { describe, expect, it } from 'vitest'
import { groupStandings } from './standings'

describe('groupStandings', () => {
  it('gives each player a place of their own', () => {
    expect(
      groupStandings(
        ['oli', 'anna'],
        [{ playerId: 'anna' }, { playerId: 'oli' }],
      ),
    ).toEqual([['oli'], ['anna']])
  })

  it('puts team members in one place', () => {
    const slots = [
      { playerId: 'anna', teamId: 'A' },
      { playerId: 'oli', teamId: 'B' },
      { playerId: 'dagny', teamId: 'A' },
      { playerId: 'jon', teamId: 'B' },
    ]

    expect(groupStandings(['oli', 'jon', 'anna', 'dagny'], slots)).toEqual([
      ['oli', 'jon'],
      ['anna', 'dagny'],
    ])
  })
})
