import type { GameRecord, PlayerId } from '../engine/game'

/** The numbers a stats row adds up; the API's `StatsCounts`. */
export type StatsCounts = {
  games: number
  /** Games against another side: not solo practice, not one team alone. */
  matches: number
  /** Matches finished in first place (team mates share a win). */
  wins: number
  darts: number
  singles: number
  doubles: number
  triples: number
  misses: number
  /** x01 points scored; 0 for other games. */
  points: number
}

/**
 * One player's totals in one game type in one ISO week, e.g. `2026-W46`.
 * The API keeps these for a household (`GET /api/stats`); a guest's are
 * worked out from the games on the device, the same way.
 */
export type StatsRow = StatsCounts & {
  playerId: PlayerId
  game: string
  week: string
}

export const noCounts: StatsCounts = Object.freeze({
  games: 0,
  matches: 0,
  wins: 0,
  darts: 0,
  singles: 0,
  doubles: 0,
  triples: 0,
  misses: 0,
  points: 0,
})

const fields = Object.keys(noCounts) as (keyof StatsCounts)[]

export function addCounts(a: StatsCounts, b: StatsCounts): StatsCounts {
  const sum = { ...noCounts }
  for (const field of fields) sum[field] = a[field] + b[field]
  return sum
}

/** Just the counts of a row. */
export function countsOf(row: StatsCounts): StatsCounts {
  return addCounts(noCounts, row)
}

/**
 * The ISO 8601 week of a time in UTC, e.g. `2026-W46`; the API's
 * `StatsContribution.Week`. Weeks start on Monday, and week 1 is the one
 * with the year's first Thursday.
 */
export function isoWeek(at: string | Date): string {
  const date = new Date(at)
  const weekday = date.getUTCDay() || 7
  // The Thursday of the same week decides the year.
  const thursday = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 4 - weekday,
  )
  const year = new Date(thursday).getUTCFullYear()
  const week =
    Math.floor((thursday - Date.UTC(year, 0, 1)) / 86_400_000 / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * What a finished game adds to the stats: one game per player in its
 * summary, in the week it finished. It is a match when someone finished
 * behind first place, and a win for everyone in first. Nothing for a game
 * in play or one without a summary. The API's `StatsContribution.Of`.
 */
export function contribution(game: GameRecord<unknown>): StatsRow[] {
  const { result, summary } = game
  if (!result || !summary) return []
  const week = isoWeek(result.finishedAt)
  const match = summary.some((player) => player.place > 1) ? 1 : 0
  return summary.map((player) => ({
    playerId: player.playerId,
    game: game.game,
    week,
    games: 1,
    matches: match,
    wins: player.place === 1 ? match : 0,
    darts: player.darts,
    singles: player.singles,
    doubles: player.doubles,
    triples: player.triples,
    misses: player.misses,
    points: player.points ?? 0,
  }))
}

const keyOf = (row: StatsRow) => `${row.playerId}|${row.game}|${row.week}`

/** Rows in the API's order: by player, then game, then week. */
export function byKey(a: StatsRow, b: StatsRow): number {
  const ka = keyOf(a)
  const kb = keyOf(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

/** A guest's stats rows: every finished game's contribution added up. */
export function rowsFromGames(
  games: readonly GameRecord<unknown>[],
): StatsRow[] {
  const rows = new Map<string, StatsRow>()
  for (const row of games.flatMap(contribution)) {
    const key = keyOf(row)
    const existing = rows.get(key)
    rows.set(key, existing ? { ...existing, ...addCounts(existing, row) } : row)
  }
  return [...rows.values()].sort(byKey)
}
