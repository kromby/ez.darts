import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { computerLevels, computerRivalId } from '../../engine/computer'
import type { PlayerId } from '../../engine/game'
import type { Player } from '../../players/player'
import {
  shares,
  winRatio,
  type Meeting,
  type Period,
} from '../../stats/aggregate'
import {
  GRID_MAX,
  type HouseholdLine,
  type HouseholdView,
} from '../../stats/householdView'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import { Card, TableHead } from './parts'
import { useFormat } from './useFormat'
import styles from './StatsScreen.module.css'

type PlayerOf = (id: PlayerId) => Player

function WinLine({ line, player }: { line: HouseholdLine; player: Player }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { wins, matches } = line.counts
  const ratio = winRatio(line.counts)
  return (
    <li className={styles.rival}>
      <PlayerAvatar player={player} size={32} />
      <div>
        <div className={styles.rivalName}>
          {player.name}{' '}
          <small>
            {matches > 0
              ? t('stats.wins', { wins, count: matches })
              : t('stats.noMatches')}
          </small>
        </div>
        <div className={styles.split} aria-hidden="true">
          <span style={{ flex: wins }} />
          <span style={{ flex: matches - wins }} />
        </div>
      </div>
      <b className={styles.pct}>
        {ratio === null ? '—' : format.percent(ratio, 0)}
      </b>
    </li>
  )
}

/** Each player's win ratio, best first. */
export function WinRatios({
  view,
  period,
  playerOf,
}: {
  view: HouseholdView
  period: Period
  playerOf: PlayerOf
}) {
  const { t } = useTranslation()
  return (
    <Card title={t('stats.winRatio')} aside={t(`stats.periodsLong.${period}`)}>
      <ul className={styles.rivals}>
        {view.players.map((line) => (
          <WinLine
            key={line.playerId}
            line={line}
            player={playerOf(line.playerId)}
          />
        ))}
      </ul>
    </Card>
  )
}

/**
 * A cell's colour: grey at even, shading to blue as the row player finishes
 * ahead more often and to red as they finish behind; full at ±15 points.
 */
function shade(share: number): CSSProperties {
  const strength = Math.round(Math.min(1, Math.abs(share - 0.5) / 0.15) * 100)
  const towards = share >= 0.5 ? 'var(--h2h-ahead)' : 'var(--h2h-behind)'
  return {
    background: `color-mix(in srgb, ${towards} ${strength}%, var(--h2h-even))`,
  }
}

function GridCell({
  row,
  column,
  meeting,
}: {
  row: Player
  column: Player
  meeting: Meeting | undefined
}) {
  const { t } = useTranslation()
  const format = useFormat()
  if (row.id === column.id) {
    return <td className={styles.self}>—</td>
  }
  if (!meeting) {
    return (
      <td
        className={styles.self}
        title={t('stats.household.grid.never', {
          row: row.name,
          column: column.name,
        })}
      >
        –
      </td>
    )
  }
  const share = meeting.ahead / meeting.games
  return (
    <td
      style={shade(share)}
      title={t('stats.household.grid.cell', {
        row: row.name,
        column: column.name,
        ahead: meeting.ahead,
        count: meeting.games,
      })}
    >
      {format.percent(share, 0)}
      <small>
        {meeting.ahead}/{meeting.games}
      </small>
    </td>
  )
}

function GridRow({
  row,
  players,
  view,
}: {
  row: Player
  players: Player[]
  view: HouseholdView
}) {
  const line = view.headToHead.get(row.id)
  return (
    <tr>
      <th scope="row">
        <PlayerAvatar player={row} size={22} />
        <span className={styles.rowName}>{row.name}</span>
      </th>
      {players.map((column) => (
        <GridCell
          key={column.id}
          row={row}
          column={column}
          meeting={line?.get(column.id)}
        />
      ))}
    </tr>
  )
}

/** Column headings: each player's avatar, named for screen readers. */
function GridHead({ players }: { players: Player[] }) {
  const columns = players.map((player) => (
    <th key={player.id} scope="col">
      <PlayerAvatar player={player} size={22} />
      <span className="sr-only">{player.name}</span>
    </th>
  ))
  return (
    <thead>
      <tr>
        <td />
        {columns}
      </tr>
    </thead>
  )
}

/** Row player against column player, as a share of their shared games. */
function Grid({ players, view }: { players: Player[]; view: HouseholdView }) {
  return (
    <table
      className={styles.matrix}
      // Past four players the rows show the avatar only, as the columns do.
      data-many={players.length > 4 || undefined}
    >
      <GridHead players={players} />
      <tbody>
        {players.map((row) => (
          <GridRow key={row.id} row={row} players={players} view={view} />
        ))}
      </tbody>
    </table>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className={styles.legend} aria-hidden="true">
      <span>{t('stats.household.grid.behind')}</span>
      <span className={styles.ramp} />
      <span>{t('stats.household.grid.ahead')}</span>
    </div>
  )
}

function ListPlayer({
  row,
  players,
  view,
}: {
  row: Player
  players: Player[]
  view: HouseholdView
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const line = view.headToHead.get(row.id)
  const met = players.flatMap((column) => {
    const meeting = line?.get(column.id)
    return meeting ? [{ column, meeting }] : []
  })
  const items = met.map(({ column, meeting }) => (
    <li key={column.id}>
      <span>{t('stats.household.grid.vs', { name: column.name })}</span>
      <span className={styles.muted}>
        {meeting.ahead}/{meeting.games}
      </span>
      <b>{format.percent(meeting.ahead / meeting.games, 0)}</b>
    </li>
  ))
  return (
    <li>
      <div className={styles.rivalName}>
        <PlayerAvatar player={row} size={28} />
        {row.name}
      </div>
      <ul className={styles.meetings}>{items}</ul>
    </li>
  )
}

/** The grid's numbers as a list per player, for big households. */
function List({ players, view }: { players: Player[]; view: HouseholdView }) {
  return (
    <ul className={styles.h2hList}>
      {players.map((row) => (
        <ListPlayer key={row.id} row={row} players={players} view={view} />
      ))}
    </ul>
  )
}

/**
 * How often each player finished ahead of each other player in the games
 * they shared: a grid for up to six players, a list above that.
 */
export function HeadToHeadCard({
  view,
  playerOf,
}: {
  view: HouseholdView
  playerOf: PlayerOf
}) {
  const { t } = useTranslation()
  // The people by win ratio, then the computers they played, easy first.
  const people = view.players
    .map((line) => line.playerId)
    .filter((id) => view.headToHead.has(id))
  const computers = computerLevels
    .map(computerRivalId)
    .filter((id) => view.headToHead.has(id))
  const players = [...people, ...computers].map(playerOf)
  if (players.length < 2) {
    return (
      <Card title={t('stats.rivals.title')}>
        <p className={styles.muted}>{t('stats.rivals.none')}</p>
      </Card>
    )
  }
  return (
    <Card
      title={t('stats.rivals.title')}
      aside={t('stats.household.grid.aside')}
    >
      {players.length > GRID_MAX ? (
        <List players={players} view={view} />
      ) : (
        <>
          <Grid players={players} view={view} />
          <Legend />
        </>
      )}
      <p className={styles.note}>{t('stats.household.grid.note')}</p>
    </Card>
  )
}

/** The x01 3-dart average per player, highest first, as bars. */
export function Averages({
  view,
  playerOf,
}: {
  view: HouseholdView
  playerOf: PlayerOf
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const lines = view.players
    .flatMap((line) =>
      line.average === null ? [] : [{ ...line, average: line.average }],
    )
    .sort((a, b) => b.average - a.average)
  // The scale ends at the next ten up from the best average.
  const top = Math.max(10, Math.ceil((lines[0]?.average ?? 0) / 10) * 10)
  const bars = lines.map((line) => {
    const player = playerOf(line.playerId)
    return (
      <li key={line.playerId} className={styles.barLine}>
        <PlayerAvatar player={player} size={28} />
        <span className={styles.rivalName}>{player.name}</span>
        <span className={styles.bar}>
          <span style={{ width: `${(line.average / top) * 100}%` }} />
          <b>{format.decimal(line.average)}</b>
        </span>
      </li>
    )
  })
  return (
    <Card title={t('stats.trends.average')}>
      {lines.length === 0 ? (
        <p className={styles.muted}>{t('stats.household.averages.none')}</p>
      ) : (
        <ul className={styles.bars}>{bars}</ul>
      )}
    </Card>
  )
}

/** Doubles, triples and misses as a share of each player's darts. */
export function MixByPlayer({
  view,
  playerOf,
}: {
  view: HouseholdView
  playerOf: PlayerOf
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const lines = view.players
    .flatMap((line) => {
      const share = shares(line.counts)
      return share ? [{ playerId: line.playerId, share }] : []
    })
    .sort((a, b) => b.share.doubles - a.share.doubles)
  const rows = lines.map(({ playerId, share }) => (
    <tr key={playerId}>
      <th scope="row">{playerOf(playerId).name}</th>
      <td className={styles.n}>{format.percent(share.doubles)}</td>
      <td className={styles.n}>{format.percent(share.triples)}</td>
      <td className={styles.n}>{format.percent(share.misses)}</td>
    </tr>
  ))
  return (
    <Card
      title={t('stats.household.mix.title')}
      aside={t('stats.household.mix.aside')}
    >
      <table className={styles.table}>
        <TableHead
          first={t('stats.player')}
          numbers={[
            t('stats.mix.double'),
            t('stats.mix.triple'),
            t('stats.mix.miss'),
          ]}
        />
        <tbody>{rows}</tbody>
      </table>
    </Card>
  )
}
