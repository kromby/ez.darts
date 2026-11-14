import { describe, expect, it, vi } from 'vitest'
import type { GameRecord } from '../engine/game'
import { createApiStore } from '../storage/apiStore'
import { createMemoryStore } from '../storage/memoryStore'
import {
  filterRows,
  firstWeek,
  headToHead,
  shares,
  threeDartAverage,
  totalsByPlayer,
  weekly,
  winRatio,
  type StatsFilter,
} from './aggregate'
import games from './fixtures/games.json'
import rows from './fixtures/rows.json'
import { noCounts, type StatsRow } from './rows'

const fixtureGames = games as GameRecord<unknown>[]
const fixtureRows = rows as StatsRow[]
// Saturday of 2026-W46.
const now = new Date('2026-11-14T12:00:00Z')
const all: StatsFilter = { period: 'all', game: null }

describe('periods', () => {
  it('counts back whole ISO weeks, this one included', () => {
    expect(firstWeek('4w', now)).toBe('2026-W43')
    expect(firstWeek('12w', now)).toBe('2026-W35')
    expect(firstWeek('year', now)).toBe('2025-W47')
    expect(firstWeek('all', now)).toBeNull()
  })

  it('filters rows by period and game', () => {
    const weeks = (filter: StatsFilter) =>
      [
        ...new Set(filterRows(fixtureRows, filter, now).map((r) => r.week)),
      ].sort()

    expect(weeks({ period: '4w', game: null })).toEqual([
      '2026-W45',
      '2026-W46',
    ])
    expect(weeks({ period: '12w', game: null })).toEqual([
      '2026-W40',
      '2026-W45',
      '2026-W46',
    ])
    expect(weeks({ period: 'year', game: null })).toHaveLength(4)
    expect(
      filterRows(fixtureRows, { period: 'all', game: 'around-the-world' }, now),
    ).toHaveLength(2)
  })
})

describe('totals', () => {
  it("adds up each player's rows", () => {
    const anna = totalsByPlayer(fixtureRows).get('anna')

    expect(anna).toEqual({
      games: 5,
      matches: 4,
      wins: 3,
      darts: 18,
      singles: 8,
      doubles: 1,
      triples: 9,
      misses: 0,
      points: 201,
    })
    expect(winRatio(anna!)).toBe(0.75)
    expect(shares(anna!)).toEqual({
      singles: 8 / 18,
      doubles: 1 / 18,
      triples: 9 / 18,
      misses: 0,
    })
  })

  it('has no ratios before the first dart or match', () => {
    expect(shares(noCounts)).toBeNull()
    expect(winRatio(noCounts)).toBeNull()
  })

  it('works out the x01 3-dart average from x01 games only', () => {
    const anna = fixtureRows.filter((row) => row.playerId === 'anna')

    // 201 points in 10 x01 darts; around the world's darts don't count.
    expect(threeDartAverage(anna)).toBeCloseTo(60.3)
    expect(
      threeDartAverage(
        filterRows(anna, { period: 'all', game: 'around-the-world' }, now),
      ),
    ).toBeNull()
  })

  it('buckets a player by week, oldest first', () => {
    expect(
      weekly(fixtureRows, 'anna').map(({ week, counts }) => [
        week,
        counts.games,
      ]),
    ).toEqual([
      ['2026-W01', 1],
      ['2026-W40', 1],
      ['2026-W45', 1],
      ['2026-W46', 2],
    ])
  })
})

describe('headToHead', () => {
  it('counts shared games on different sides and who finished ahead', () => {
    // Team mates in fixture-4, so only fixture-2 counts.
    expect(headToHead(fixtureGames, 'anna', 'bjorn', all, now)).toEqual({
      games: 1,
      ahead: { anna: 0, bjorn: 1 },
    })
    expect(headToHead(fixtureGames, 'anna', 'oli', all, now)).toEqual({
      games: 4,
      ahead: { anna: 3, oli: 1 },
    })
  })

  it('follows the period and game filters', () => {
    expect(
      headToHead(
        fixtureGames,
        'anna',
        'oli',
        { period: '4w', game: null },
        now,
      ),
    ).toEqual({ games: 2, ahead: { anna: 1, oli: 1 } })
    expect(
      headToHead(
        fixtureGames,
        'anna',
        'oli',
        { period: 'all', game: 'x01' },
        now,
      ).games,
    ).toBe(3)
  })
})

describe('a guest and a household', () => {
  it('see the same numbers for the same games', async () => {
    const guest = createMemoryStore()
    for (const game of fixtureGames) await guest.games.put(game)
    // The API's rows for these games, as SharedStatsFixtureTests checks.
    const fetch = vi.fn<typeof globalThis.fetch>((input) =>
      Promise.resolve(
        Response.json(String(input).endsWith('/stats') ? rows : games),
      ),
    )
    const household = createApiStore({ settings: guest.settings, fetch })

    const [local, api] = await Promise.all([
      guest.stats.rows(),
      household.stats.rows(),
    ])
    expect(api).toEqual(local)
    expect(fetch).toHaveBeenCalledWith('/api/stats', expect.anything())

    for (const filter of [all, { period: '4w', game: 'x01' } as const]) {
      expect(totalsByPlayer(filterRows(api, filter, now))).toEqual(
        totalsByPlayer(filterRows(local, filter, now)),
      )
      expect(
        headToHead(await household.games.list(), 'anna', 'oli', filter, now),
      ).toEqual(
        headToHead(await guest.games.list(), 'anna', 'oli', filter, now),
      )
    }
  })
})
