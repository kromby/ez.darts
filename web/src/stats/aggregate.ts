import type { GameRecord, PlayerId } from '../engine/game'
import { places } from '../engine/summary'
import {
  addCounts,
  countsOf,
  isoWeek,
  noCounts,
  type StatsCounts,
  type StatsRow,
} from './rows'

/** How far back the stats go: the last 4, 12 or 52 ISO weeks, or all. */
export type Period = '4w' | '12w' | 'year' | 'all'

export const periods: readonly Period[] = ['4w', '12w', 'year', 'all']

const weeksIn: Record<Period, number | null> = {
  '4w': 4,
  '12w': 12,
  year: 52,
  all: null,
}

export type StatsFilter = {
  period: Period
  /** A game id such as `x01`, or `null` for every game. */
  game: string | null
}

/**
 * The first ISO week in the period, counting this week as one; `null` for
 * all time. ISO weeks such as `2026-W46` sort as text.
 */
export function firstWeek(
  period: Period,
  now: Date = new Date(),
): string | null {
  const weeks = weeksIn[period]
  if (weeks === null) return null
  return isoWeek(new Date(now.getTime() - (weeks - 1) * 7 * 86_400_000))
}

function matches(
  game: string,
  week: string,
  filter: StatsFilter,
  first: string | null,
) {
  return (
    (filter.game === null || game === filter.game) &&
    (first === null || week >= first)
  )
}

/** The rows in the filter's period and game. */
export function filterRows(
  rows: readonly StatsRow[],
  filter: StatsFilter,
  now: Date = new Date(),
): StatsRow[] {
  const first = firstWeek(filter.period, now)
  return rows.filter((row) => matches(row.game, row.week, filter, first))
}

/** Each player's rows added up. */
export function totalsByPlayer(
  rows: readonly StatsRow[],
): Map<PlayerId, StatsCounts> {
  const totals = new Map<PlayerId, StatsCounts>()
  for (const row of rows) {
    totals.set(
      row.playerId,
      addCounts(totals.get(row.playerId) ?? noCounts, row),
    )
  }
  return totals
}

/** One player's totals per ISO week, oldest first, for trends. */
export function weekly(
  rows: readonly StatsRow[],
  playerId: PlayerId,
): { week: string; counts: StatsCounts }[] {
  const weeks = new Map<string, StatsCounts>()
  for (const row of rows) {
    if (row.playerId !== playerId) continue
    weeks.set(row.week, addCounts(weeks.get(row.week) ?? noCounts, row))
  }
  return [...weeks]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, counts]) => ({ week, counts }))
}

export type Shares = {
  singles: number
  doubles: number
  triples: number
  misses: number
}

/** Where the darts landed, as fractions of all darts; `null` with none. */
export function shares(counts: StatsCounts): Shares | null {
  const { darts } = counts
  if (darts === 0) return null
  return {
    singles: counts.singles / darts,
    doubles: counts.doubles / darts,
    triples: counts.triples / darts,
    misses: counts.misses / darts,
  }
}

/** Wins over matches; `null` before the first match. */
export function winRatio(counts: StatsCounts): number | null {
  return counts.matches > 0 ? counts.wins / counts.matches : null
}

/**
 * The x01 3-dart average over the rows' x01 games: points per dart × 3,
 * busted darts included, as in the game. `null` without x01 darts.
 */
export function threeDartAverage(rows: readonly StatsRow[]): number | null {
  const x01 = rows
    .filter((row) => row.game === 'x01')
    .reduce((sum, row) => addCounts(sum, countsOf(row)), noCounts)
  return x01.darts > 0 ? (x01.points / x01.darts) * 3 : null
}

export type HeadToHead = {
  /** Finished games, in the filter, where the two played on different sides. */
  games: number
  /** Of those, how many each finished ahead of the other. */
  ahead: Record<PlayerId, number>
}

/**
 * How two players did against each other, from the games' standings: the
 * games they both played on different sides, and who finished ahead.
 */
export function headToHead(
  games: readonly GameRecord<unknown>[],
  a: PlayerId,
  b: PlayerId,
  filter: StatsFilter,
  now: Date = new Date(),
): HeadToHead {
  const first = firstWeek(filter.period, now)
  const result: HeadToHead = { games: 0, ahead: { [a]: 0, [b]: 0 } }
  for (const game of games) {
    if (!game.result) continue
    if (!matches(game.game, isoWeek(game.result.finishedAt), filter, first)) {
      continue
    }
    const slotA = game.slots.find((slot) => slot.playerId === a)
    const slotB = game.slots.find((slot) => slot.playerId === b)
    if (!slotA || !slotB) continue
    if (slotA.teamId !== undefined && slotA.teamId === slotB.teamId) continue

    const place = places({ slots: game.slots, result: game.result })
    const placeA = place.get(a) ?? 0
    const placeB = place.get(b) ?? 0
    result.games++
    if (placeA < placeB) result.ahead[a]++
    else if (placeB < placeA) result.ahead[b]++
  }
  return result
}
