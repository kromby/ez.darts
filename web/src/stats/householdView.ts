import type { GameRecord, PlayerId } from '../engine/game'
import {
  filterRows,
  headToHeadGrid,
  threeDartAverage,
  totalsByPlayer,
  winRatio,
  type HeadToHeadGrid,
  type StatsFilter,
} from './aggregate'
import type { StatsCounts, StatsRow } from './rows'

/** Above this many players, head to head is a list rather than a grid. */
export const GRID_MAX = 6

/** One player's line on the household view. */
export type HouseholdLine = {
  playerId: PlayerId
  counts: StatsCounts
  /** x01 3-dart average; `null` without x01 darts. */
  average: number | null
}

/** Everything on the household view, for one filter. */
export type HouseholdView = {
  /**
   * Everyone who played in the filter, best win ratio first; players
   * without a match against others come last.
   */
  players: HouseholdLine[]
  /** Row player against column player. */
  headToHead: HeadToHeadGrid
}

function byWinRatio(a: HouseholdLine, b: HouseholdLine): number {
  const ratioA = winRatio(a.counts) ?? -1
  const ratioB = winRatio(b.counts) ?? -1
  return (
    ratioB - ratioA ||
    b.counts.matches - a.counts.matches ||
    a.playerId.localeCompare(b.playerId)
  )
}

/**
 * The household's players side by side for the period and game in
 * `filter`: win ratio, x01 average and dart mix from the stats rows (the
 * API's or the device's), and head to head from the games. The same for a
 * guest and a household; a household's rows and games are its own.
 */
export function householdView(
  rows: readonly StatsRow[],
  games: readonly GameRecord<unknown>[],
  filter: StatsFilter,
  now: Date = new Date(),
): HouseholdView {
  const current = filterRows(rows, filter, now)
  const players = [...totalsByPlayer(current)]
    .filter(([, counts]) => counts.games > 0)
    .map(([playerId, counts]) => ({
      playerId,
      counts,
      average: threeDartAverage(
        current.filter((row) => row.playerId === playerId),
      ),
    }))
    .sort(byWinRatio)

  return { players, headToHead: headToHeadGrid(games, filter, now) }
}
