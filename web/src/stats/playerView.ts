import type { GameRecord, PlayerId, PlayerSummary } from '../engine/game'
import { places } from '../engine/summary'
import {
  filterRows,
  firstWeek,
  headToHeadGrid,
  periodWeeks,
  previousRows,
  threeDartAverage,
  totalsBy,
  type StatsFilter,
} from './aggregate'
import {
  addCounts,
  isoWeek,
  noCounts,
  type StatsCounts,
  type StatsRow,
} from './rows'

/** One week of a player's trend; `null` where nothing was thrown. */
export type TrendPoint = {
  week: string
  /** x01 3-dart average. */
  average: number | null
  /** Doubles and triples as fractions of all darts. */
  doubles: number | null
  triples: number | null
}

export type Rival = { playerId: PlayerId; games: number; ahead: number }

export type GameLine = {
  game: string
  counts: StatsCounts
  /** x01 only. */
  average: number | null
}

export type RecentGame = {
  record: GameRecord<unknown>
  summary: PlayerSummary
  /** The other players, in throwing order. */
  others: PlayerId[]
}

/** Everything on the player view, for one player and filter. */
export type PlayerView = {
  current: StatsCounts
  /** The same length of time before; `null` for all time. */
  previous: StatsCounts | null
  average: number | null
  previousAverage: number | null
  trend: TrendPoint[]
  rivals: Rival[]
  byGame: GameLine[]
  recent: RecentGame[]
}

export const RECENT_GAMES = 5

function sum(rows: readonly StatsRow[]): StatsCounts {
  return rows.reduce<StatsCounts>(
    (total, row) => addCounts(total, row),
    noCounts,
  )
}

function trend(rows: readonly StatsRow[], weeks: string[]): TrendPoint[] {
  return weeks.map((week) => {
    const inWeek = rows.filter((row) => row.week === week)
    const counts = sum(inWeek)
    const share = (n: number) => (counts.darts > 0 ? n / counts.darts : null)
    return {
      week,
      average: threeDartAverage(inWeek),
      doubles: share(counts.doubles),
      triples: share(counts.triples),
    }
  })
}

function inFilter(
  game: GameRecord<unknown>,
  filter: StatsFilter,
  first: string | null,
): game is GameRecord<unknown> & {
  result: NonNullable<GameRecord<unknown>['result']>
} {
  if (!game.result) return false
  if (filter.game !== null && game.game !== filter.game) return false
  return first === null || isoWeek(game.result.finishedAt) >= first
}

function summaryOf(
  game: GameRecord<unknown> & {
    result: NonNullable<GameRecord<unknown>['result']>
  },
  playerId: PlayerId,
): PlayerSummary | undefined {
  const own = game.summary?.find((entry) => entry.playerId === playerId)
  if (own) return own
  // Not summarized yet: enough for the list, without counts.
  const place = places(game).get(playerId)
  return place === undefined
    ? undefined
    : {
        playerId,
        darts: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        misses: 0,
        place,
      }
}

/**
 * A player's stats for the period and game in `filter`, from the stats rows
 * (the API's or the device's) and the games, for head to head and the
 * recent games. The same for a guest and a household.
 */
export function playerView(
  rows: readonly StatsRow[],
  games: readonly GameRecord<unknown>[],
  playerId: PlayerId,
  filter: StatsFilter,
  now: Date = new Date(),
): PlayerView {
  const own = rows.filter((row) => row.playerId === playerId)
  const current = filterRows(own, filter, now)
  const previous = previousRows(own, filter, now)
  const earliest = own.reduce<string | null>(
    (min, row) => (min === null || row.week < min ? row.week : min),
    null,
  )

  const byGame = [...totalsBy(current, (row) => row.game)]
    .map(([game, counts]) => ({
      game,
      counts,
      average:
        game === 'x01'
          ? threeDartAverage(current.filter((row) => row.game === game))
          : null,
    }))
    .sort(
      (a, b) => b.counts.games - a.counts.games || a.game.localeCompare(b.game),
    )

  const first = firstWeek(filter.period, now)
  const played = games
    .filter((game) => inFilter(game, filter, first))
    .filter((game) => game.slots.some((slot) => slot.playerId === playerId))

  const rivals = [...(headToHeadGrid(played, filter, now).get(playerId) ?? [])]
    .map(([other, meeting]) => ({ playerId: other, ...meeting }))
    .sort((a, b) => b.games - a.games)

  const recent = played
    .sort((a, b) => b.result.finishedAt.localeCompare(a.result.finishedAt))
    .slice(0, RECENT_GAMES)
    .flatMap((record) => {
      const summary = summaryOf(record, playerId)
      if (!summary) return []
      return [
        {
          record,
          summary,
          others: record.slots
            .map((slot) => slot.playerId)
            .filter((id) => id !== playerId),
        },
      ]
    })

  return {
    current: sum(current),
    previous: previous && sum(previous),
    average: threeDartAverage(current),
    previousAverage: previous && threeDartAverage(previous),
    trend: trend(current, periodWeeks(filter.period, now, earliest)),
    rivals,
    byGame,
    recent,
  }
}
