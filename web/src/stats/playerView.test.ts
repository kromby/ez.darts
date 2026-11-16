import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../engine/game'
import {
  periodWeeks,
  previousRows,
  totalsByPlayer,
  weekStart,
} from './aggregate'
import games from './fixtures/games.json'
import rows from './fixtures/rows.json'
import { playerView } from './playerView'
import type { StatsRow } from './rows'

const fixtureGames = games as GameRecord<unknown>[]
const fixtureRows = rows as StatsRow[]
// Saturday of 2026-W46.
const now = new Date('2026-11-14T12:00:00Z')

describe('weeks', () => {
  it('starts an ISO week on Monday', () => {
    expect(weekStart('2026-W46').toISOString()).toBe('2026-11-09T00:00:00.000Z')
    expect(weekStart('2026-W01').toISOString()).toBe('2025-12-29T00:00:00.000Z')
    expect(weekStart('2026-W53').toISOString()).toBe('2026-12-28T00:00:00.000Z')
  })

  it('lists every week of a period, this one last', () => {
    expect(periodWeeks('4w', now)).toEqual([
      '2026-W43',
      '2026-W44',
      '2026-W45',
      '2026-W46',
    ])
    expect(periodWeeks('year', now)).toHaveLength(52)
    expect(periodWeeks('all', now, '2026-W45')).toEqual([
      '2026-W45',
      '2026-W46',
    ])
  })

  it('compares with the same length of time just before', () => {
    const before = previousRows(fixtureRows, { period: '4w', game: null }, now)

    // 2026-W39 to W42: the around the world game in W40.
    expect(before?.map((row) => row.week)).toEqual(['2026-W40', '2026-W40'])
    expect(
      previousRows(fixtureRows, { period: 'all', game: null }, now),
    ).toBeNull()
  })
})

describe('playerView', () => {
  it('adds up all of a player’s games', () => {
    const view = playerView(
      fixtureRows,
      fixtureGames,
      'anna',
      { period: 'all', game: null },
      now,
    )

    expect(view.current).toEqual(totalsByPlayer(fixtureRows).get('anna'))
    expect(view.previous).toBeNull()
    expect(view.average).toBeCloseTo(60.3)
    expect(view.rivals).toEqual([
      { playerId: 'oli', games: 4, ahead: 3 },
      // Team mates in fixture-4, so only fixture-2 is head to head.
      { playerId: 'bjorn', games: 1, ahead: 0 },
    ])
    expect(view.byGame.map((line) => [line.game, line.counts.games])).toEqual([
      ['x01', 4],
      ['around-the-world', 1],
    ])
    expect(view.byGame[0].average).toBeCloseTo(60.3)
    expect(view.byGame[1].average).toBeNull()
    // Newest first; the game in play is left out.
    expect(view.recent.map((game) => game.record.id)).toEqual([
      'fixture-3',
      'fixture-2',
      'fixture-1',
      'fixture-5',
      'fixture-4',
    ])
    expect(view.recent[1].summary.place).toBe(3)
    expect(view.recent[1].others).toEqual(['oli', 'bjorn'])
  })

  it('compares the period with the one before, week by week', () => {
    const view = playerView(
      fixtureRows,
      fixtureGames,
      'anna',
      { period: '4w', game: null },
      now,
    )

    expect(view.current.games).toBe(3)
    expect(view.previous?.games).toBe(1)
    // 161 points in 7 x01 darts.
    expect(view.average).toBeCloseTo(69)
    expect(view.previousAverage).toBeNull()
    expect(view.trend).toEqual([
      { week: '2026-W43', average: null, doubles: null, triples: null },
      { week: '2026-W44', average: null, doubles: null, triples: null },
      { week: '2026-W45', average: 75.75, doubles: 0.25, triples: 0.25 },
      { week: '2026-W46', average: 60, doubles: 0, triples: 1 / 3 },
    ])
  })

  it('follows the game filter', () => {
    const view = playerView(
      fixtureRows,
      fixtureGames,
      'oli',
      { period: 'all', game: 'around-the-world' },
      now,
    )

    expect(view.current.games).toBe(1)
    expect(view.average).toBeNull()
    expect(view.rivals).toEqual([{ playerId: 'anna', games: 1, ahead: 0 }])
    expect(view.recent.map((game) => game.record.id)).toEqual(['fixture-5'])
  })

  it('lists a finished game without a summary, with its place', () => {
    const { summary: _summary, ...older } = fixtureGames[0]

    const view = playerView(
      [],
      [older],
      'oli',
      { period: 'all', game: null },
      now,
    )

    expect(view.recent[0].summary).toMatchObject({ place: 2, darts: 0 })
  })
})
