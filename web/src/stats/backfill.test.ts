import { describe, expect, it, vi } from 'vitest'
import type { GameRecord } from '../engine/game'
import { withSummary } from '../games'
import { createMemoryStore } from '../storage/memoryStore'
import type { StoredGame } from '../storage/store'
import { backfillSummaries } from './backfill'
import games from './fixtures/games.json'

const fixtureGames = games as GameRecord<unknown>[]
/** As saved before #20: finished, but no summary. */
const older = ({ summary: _summary, ...game }: StoredGame): StoredGame => game

describe('withSummary', () => {
  it('works out the summary of a finished game saved without one', () => {
    const [game] = fixtureGames

    expect(withSummary(older(game))).toEqual(game)
  })

  it('leaves games in play, with a summary, unknown or broken alone', () => {
    const unknown = { ...older(fixtureGames[0]), game: 'cricket' }
    const broken: StoredGame = {
      ...older(fixtureGames[0]),
      darts: [{ playerId: 'anna', dart: { segment: 30, multiplier: 3 } }],
    }

    expect(withSummary(fixtureGames[5])).toBe(fixtureGames[5])
    expect(withSummary(fixtureGames[0])).toBe(fixtureGames[0])
    expect(withSummary(unknown)).toBe(unknown)
    expect(withSummary(broken)).toBe(broken)
  })
})

describe('backfillSummaries', () => {
  it('saves the summary with older finished games, once', async () => {
    const store = createMemoryStore()
    for (const game of fixtureGames) await store.games.put(older(game))
    const put = vi.spyOn(store.games, 'put')

    // Five finished; the sixth is in play.
    expect(await backfillSummaries(store)).toBe(5)
    expect(put).toHaveBeenCalledTimes(5)
    expect(await store.games.get('fixture-2')).toEqual(fixtureGames[1])

    expect(await backfillSummaries(store)).toBe(0)
    expect(put).toHaveBeenCalledTimes(5)
  })
})
