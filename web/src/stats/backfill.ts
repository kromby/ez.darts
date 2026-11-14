import { withSummary } from '../games'
import type { DataStore, StoredGame } from '../storage/store'

/**
 * Saves a summary with every finished game that has none, i.e. games
 * finished before stats were kept (#20), so they count too. Through the
 * API that also adds them to the household's stats. Returns how many.
 */
export async function backfillSummaries(
  store: DataStore,
  summarize: (game: StoredGame) => StoredGame = withSummary,
): Promise<number> {
  let filled = 0
  for (const game of await store.games.list()) {
    if (!game.result || game.summary) continue
    const next = summarize(game)
    if (!next.summary) continue
    await store.games.put(next)
    filled++
  }
  return filled
}
