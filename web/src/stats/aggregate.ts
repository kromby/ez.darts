import { isComputer } from '../engine/computer'
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

const WEEK = 7 * 86_400_000

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
  return isoWeek(new Date(now.getTime() - (weeks - 1) * WEEK))
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

/** Monday 00:00 UTC of an ISO week such as `2026-W46`. */
export function weekStart(week: string): Date {
  const [year, number] = week.split('-W').map(Number)
  // 4 January is always in week 1.
  const jan4 = Date.UTC(year, 0, 4)
  const monday = jan4 - ((new Date(jan4).getUTCDay() || 7) - 1) * 86_400_000
  return new Date(monday + (number - 1) * WEEK)
}

/**
 * Every ISO week in the period, oldest first and this week last, whether
 * or not anything was played. All time starts at `earliest`, the first
 * week with data.
 */
export function periodWeeks(
  period: Period,
  now: Date = new Date(),
  earliest: string | null = null,
): string[] {
  const first = firstWeek(period, now) ?? earliest ?? isoWeek(now)
  const weeks: string[] = []
  const last = isoWeek(now)
  for (let at = weekStart(first).getTime(); ; at += WEEK) {
    const week = isoWeek(new Date(at))
    weeks.push(week)
    if (week >= last) return weeks
  }
}

/**
 * The rows of the same length of time just before the period, for "vs the
 * previous 12 weeks"; `null` for all time, which has none.
 */
export function previousRows(
  rows: readonly StatsRow[],
  filter: StatsFilter,
  now: Date = new Date(),
): StatsRow[] | null {
  const weeks = weeksIn[filter.period]
  if (weeks === null) return null
  const end = firstWeek(filter.period, now)
  const first = firstWeek(filter.period, new Date(now.getTime() - weeks * WEEK))
  return rows.filter(
    (row) =>
      matches(row.game, row.week, filter, first) &&
      end !== null &&
      row.week < end,
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

/** Rows added up by a key, such as the player or the game. */
export function totalsBy<K>(
  rows: readonly StatsRow[],
  key: (row: StatsRow) => K,
): Map<K, StatsCounts> {
  const totals = new Map<K, StatsCounts>()
  for (const row of rows) {
    const k = key(row)
    totals.set(k, addCounts(totals.get(k) ?? noCounts, row))
  }
  return totals
}

/** Each player's rows added up. */
export function totalsByPlayer(
  rows: readonly StatsRow[],
): Map<PlayerId, StatsCounts> {
  return totalsBy(rows, (row) => row.playerId)
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

/** One player against another: shared games, and how many they won ahead. */
export type Meeting = { games: number; ahead: number }

/** Row player against column player, for everyone who met in the filter. */
export type HeadToHeadGrid = Map<PlayerId, Map<PlayerId, Meeting>>

/**
 * Every pair of players' head to head, from the games' standings, in one
 * pass: the games each pair played on different sides, and how often the
 * row player finished ahead of the column player.
 */
export function headToHeadGrid(
  games: readonly GameRecord<unknown>[],
  filter: StatsFilter,
  now: Date = new Date(),
): HeadToHeadGrid {
  const first = firstWeek(filter.period, now)
  const grid: HeadToHeadGrid = new Map()
  const meeting = (row: PlayerId, column: PlayerId): Meeting => {
    const line = grid.get(row) ?? new Map<PlayerId, Meeting>()
    grid.set(row, line)
    const cell = line.get(column) ?? { games: 0, ahead: 0 }
    line.set(column, cell)
    return cell
  }
  for (const game of games) {
    if (!game.result) continue
    if (!matches(game.game, isoWeek(game.result.finishedAt), filter, first)) {
      continue
    }
    const place = places({ slots: game.slots, result: game.result })
    // Head to head is between people; computers are left out.
    const people = game.slots.filter((slot) => !isComputer(slot.playerId))
    for (const row of people) {
      for (const column of people) {
        if (row.playerId === column.playerId) continue
        if (row.teamId !== undefined && row.teamId === column.teamId) continue
        const cell = meeting(row.playerId, column.playerId)
        cell.games++
        const rowPlace = place.get(row.playerId) ?? 0
        if (rowPlace < (place.get(column.playerId) ?? 0)) cell.ahead++
      }
    }
  }
  return grid
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
  const grid = headToHeadGrid(games, filter, now)
  const ab = grid.get(a)?.get(b)
  const ba = grid.get(b)?.get(a)
  return {
    games: ab?.games ?? 0,
    ahead: { [a]: ab?.ahead ?? 0, [b]: ba?.ahead ?? 0 },
  }
}
