import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../engine/game'
import type { StatsFilter } from './aggregate'
import games from './fixtures/games.json'
import rows from './fixtures/rows.json'
import { householdView } from './householdView'
import { noCounts, rowsFromGames, type StatsRow } from './rows'

const fixtureGames = games as GameRecord<unknown>[]
const fixtureRows = rows as StatsRow[]
// Saturday of 2026-W46; the last 12 weeks start in W35.
const now = new Date('2026-11-14T12:00:00Z')
const all: StatsFilter = { period: 'all', game: null }

const ratios = (filter: StatsFilter) =>
  householdView(fixtureRows, fixtureGames, filter, now).players.map(
    ({ playerId, counts }) => [playerId, counts.wins, counts.matches],
  )

describe('householdView', () => {
  it('lists everyone who played, best win ratio first', () => {
    expect(ratios(all)).toEqual([
      ['anna', 3, 4],
      ['bjorn', 1, 2],
      ['oli', 1, 4],
    ])
  })

  it('follows the period and game filters', () => {
    // fixture-4 (W01) is outside the last 12 weeks.
    expect(ratios({ period: '12w', game: null })).toEqual([
      ['anna', 2, 3],
      ['oli', 1, 3],
      ['bjorn', 0, 1],
    ])
    expect(ratios({ period: 'all', game: 'around-the-world' })).toEqual([
      ['anna', 1, 1],
      ['oli', 0, 1],
    ])
  })

  it('breaks ties by matches, then id', () => {
    // anna and oli both 1 in 2; bjorn 0 in 1.
    expect(ratios({ period: '4w', game: null })).toEqual([
      ['anna', 1, 2],
      ['oli', 1, 2],
      ['bjorn', 0, 1],
    ])
  })

  it('puts players without a match against others last', () => {
    const practice: StatsRow = {
      playerId: 'kari',
      game: 'x01',
      week: '2026-W46',
      ...noCounts,
      games: 1,
      darts: 3,
      singles: 3,
      points: 45,
    }
    const view = householdView(
      [practice, ...fixtureRows],
      fixtureGames,
      all,
      now,
    )
    expect(view.players.map((line) => line.playerId)).toEqual([
      'anna',
      'bjorn',
      'oli',
      'kari',
    ])
  })

  it("has each player's x01 average and dart counts", () => {
    const view = householdView(fixtureRows, fixtureGames, all, now)
    const by = Object.fromEntries(
      view.players.map((line) => [line.playerId, line]),
    )
    // 201 points in 10 darts, 41 in 2, 103 in 5.
    expect(by.anna.average).toBeCloseTo(60.3)
    expect(by.bjorn.average).toBeCloseTo(61.5)
    expect(by.oli.average).toBeCloseTo(61.8)
    expect(by.oli.counts).toMatchObject({ darts: 11, doubles: 1, misses: 7 })
  })

  it('has head to head from the games', () => {
    const view = householdView(fixtureRows, fixtureGames, all, now)
    expect(view.headToHead.get('anna')?.get('oli')).toEqual({
      games: 4,
      ahead: 3,
    })
  })

  it('is the same from the API rows as from the games on the device', () => {
    for (const filter of [all, { period: '12w', game: 'x01' } as const]) {
      expect(householdView(fixtureRows, fixtureGames, filter, now)).toEqual(
        householdView(rowsFromGames(fixtureGames), fixtureGames, filter, now),
      )
    }
  })

  it('is empty without games', () => {
    expect(householdView([], [], all, now)).toEqual({
      players: [],
      headToHead: new Map(),
    })
  })
})
