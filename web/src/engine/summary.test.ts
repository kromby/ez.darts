import { describe, expect, it } from 'vitest'
import { BULL, MISS, dart } from './dart'
import type { PlayerSlot, ThrownDart } from './game'
import { places, summarize } from './summary'

const result = (standings: string[]) => ({
  standings,
  finishedAt: '2026-11-14T21:00:00.000Z',
})

describe('places', () => {
  it('numbers places from 1, with team mates sharing theirs', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'anna', teamId: 'a' },
      { playerId: 'oli', teamId: 'b' },
      { playerId: 'dagny', teamId: 'a' },
    ]

    expect(places({ slots, result: result(['oli', 'anna', 'dagny']) })).toEqual(
      new Map([
        ['oli', 1],
        ['anna', 2],
        ['dagny', 2],
      ]),
    )
  })
})

describe('summarize', () => {
  it("counts each player's darts by where they landed", () => {
    const slots: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }]
    const darts: ThrownDart[] = [
      { playerId: 'anna', dart: dart(20, 3) },
      { playerId: 'anna', dart: dart(BULL, 1) },
      { playerId: 'anna', dart: dart(BULL, 2) },
      { playerId: 'oli', dart: MISS },
      { playerId: 'oli', dart: dart(5, 1) },
    ]

    expect(
      summarize({ slots, darts, result: result(['oli', 'anna']) }, (id) =>
        id === 'anna' ? 135 : 5,
      ),
    ).toEqual([
      {
        playerId: 'anna',
        darts: 3,
        singles: 1,
        doubles: 1,
        triples: 1,
        misses: 0,
        place: 2,
        points: 135,
      },
      {
        playerId: 'oli',
        darts: 2,
        singles: 1,
        doubles: 0,
        triples: 0,
        misses: 1,
        place: 1,
        points: 5,
      },
    ])
  })

  it('leaves points out for games without them', () => {
    const [summary] = summarize({
      slots: [{ playerId: 'anna' }],
      darts: [],
      result: result(['anna']),
    })

    expect(summary).not.toHaveProperty('points')
    expect(summary).toMatchObject({ darts: 0, place: 1 })
  })
})
