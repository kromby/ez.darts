import type {
  GameRecord,
  GameResult,
  PlayerId,
  PlayerSummary,
  ThrownDart,
} from './game'
import { groupStandings } from './standings'

/**
 * Each player's place from the standings: 1 for first, and team mates who
 * finish together share theirs.
 */
export function places(
  record: Pick<GameRecord<unknown>, 'slots'> & { result: GameResult },
): Map<PlayerId, number> {
  const result = new Map<PlayerId, number>()
  groupStandings(record.result.standings, record.slots).forEach(
    (players, index) => {
      for (const id of players) result.set(id, index + 1)
    },
  )
  return result
}

function counts(darts: readonly ThrownDart[], playerId: PlayerId) {
  const total = { darts: 0, singles: 0, doubles: 0, triples: 0, misses: 0 }
  for (const thrown of darts) {
    if (thrown.playerId !== playerId) continue
    total.darts++
    const { segment, multiplier } = thrown.dart
    if (segment === 0 || multiplier === 0) total.misses++
    else if (multiplier === 1) total.singles++
    else if (multiplier === 2) total.doubles++
    else total.triples++
  }
  return total
}

/**
 * The finished game's summary, one entry per player in throwing order.
 * `points` comes from the game module, for games that score them (x01).
 */
export function summarize(
  record: Pick<GameRecord<unknown>, 'slots' | 'darts'> & {
    result: GameResult
  },
  points?: (playerId: PlayerId) => number,
): PlayerSummary[] {
  const place = places(record)
  return record.slots.map(({ playerId }) => ({
    playerId,
    ...counts(record.darts, playerId),
    place: place.get(playerId) ?? record.slots.length,
    ...(points ? { points: points(playerId) } : {}),
  }))
}
