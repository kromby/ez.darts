import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../engine/game'
import { findGame } from '../games'
import games from './fixtures/games.json'
import rows from './fixtures/rows.json'
import { contribution, isoWeek, rowsFromGames } from './rows'

// The API's SharedStatsFixtureTests check its numbers against the same files.
const fixtureGames = games as GameRecord<unknown>[]

describe('isoWeek', () => {
  it.each([
    ['2026-11-14T21:00:00.000Z', '2026-W46'],
    // 1 January 2026 is a Thursday, so 29 December 2025 starts 2026-W01.
    ['2025-12-29T08:00:00Z', '2026-W01'],
    ['2027-01-01T12:00:00Z', '2026-W53'],
    // Weeks follow UTC.
    ['2026-11-16T00:30:00+01:00', '2026-W46'],
  ])('puts %s in %s, as the API does', (at, week) => {
    expect(isoWeek(at)).toBe(week)
  })
})

describe('contribution', () => {
  it('counts nothing for a game in play', () => {
    expect(contribution(fixtureGames[5])).toEqual([])
  })

  it('makes solo practice a game but not a match', () => {
    expect(contribution(fixtureGames[2])).toEqual([
      expect.objectContaining({ games: 1, matches: 0, wins: 0, points: 60 }),
    ])
  })

  it('gives team mates in first place a win each', () => {
    expect(
      contribution(fixtureGames[3]).map(({ playerId, wins }) => [
        playerId,
        wins,
      ]),
    ).toEqual([
      ['anna', 1],
      ['oli', 0],
      ['bjorn', 1],
    ])
  })
})

describe('the shared fixture', () => {
  it('holds the summaries the game modules work out', () => {
    for (const game of fixtureGames) {
      const { summary, ...saved } = game
      expect(findGame(game.game)?.summarize(saved) ?? undefined).toEqual(
        summary,
      )
    }
  })

  it('adds up to the same rows as the API', () => {
    expect(rowsFromGames(fixtureGames)).toEqual(rows)
  })
})
