import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameRecord, PlayerId } from '../../engine/game'
import { findGameConfig } from '../../games'
import { formatDecimal, formatNumber, formatPercent } from '../../i18n/format'
import { localize } from '../../i18n/languages'
import type { Player } from '../../players/player'
import { shares, weekStart, winRatio, type Shares } from '../../stats/aggregate'
import type {
  GameLine,
  PlayerView,
  RecentGame,
  Rival,
} from '../../stats/playerView'
import type { StatsCounts } from '../../stats/rows'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import Delta from './Delta'
import TrendChart from './TrendChart'
import styles from './StatsScreen.module.css'

/** Numbers, dates and game names in the current language. */
function useFormat() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'is'
  return {
    number: (value: number) => formatNumber(value, language),
    decimal: (value: number) => formatDecimal(value, language),
    percent: (value: number, digits = 1) =>
      formatPercent(value, language, digits),
    points: (value: number) =>
      t('stats.points', { value: formatDecimal(value, language) }),
    week: (week: string) =>
      new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(weekStart(week)),
    date: (iso: string) =>
      new Intl.DateTimeFormat(language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(iso)),
    gameName: (game: string) => {
      const config = findGameConfig(game)
      return config ? localize(config.name, language) : game
    },
  }
}

/** A titled card; the title names its region for screen readers. */
function Card({
  title,
  aside,
  children,
}: {
  title: string
  aside?: string | null
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <h3 id={id}>{title}</h3>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** A game's key number: the x01 average, or darts for around the world. */
function keyStat(
  game: string,
  points: number | undefined,
  darts: number,
  games: number,
  format: ReturnType<typeof useFormat>,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (points !== undefined && darts > 0) {
    return t('stats.byGame.average', {
      value: format.decimal((points / darts) * 3),
    })
  }
  if (game === 'around-the-world' && games > 0) {
    return t('stats.byGame.darts', {
      value: format.number(Math.round(darts / games)),
    })
  }
  return '—'
}

function Tile({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div className={styles.tile}>
      <dt>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {children && <dd>{children}</dd>}
    </div>
  )
}

/** Win ratio over matches with the change in points, then the tiles. */
export function Headline({ view }: { view: PlayerView }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { current, previous, average, previousAverage } = view
  const ratio = winRatio(current)
  const before = previous && winRatio(previous)
  const change =
    ratio === null || before === null
      ? null
      : Math.round(ratio * 100) - Math.round(before * 100)
  const was = (value: string) => (
    <span className={styles.muted}>{t('stats.previous', { value })}</span>
  )

  return (
    <Card title={t('stats.winRatio')}>
      <p className={styles.big}>
        {ratio === null ? '—' : format.percent(ratio, 0)}
      </p>
      <div className={styles.sub}>
        <span>
          {current.matches > 0
            ? t('stats.wins', { wins: current.wins, count: current.matches })
            : t('stats.noMatches')}
        </span>
        {change !== null && (
          <Delta
            change={change}
            text={t('stats.points', {
              value: format.number(Math.abs(change)),
            })}
            better="up"
          />
        )}
      </div>
      <dl className={styles.tiles}>
        <Tile label={t('stats.games')} value={format.number(current.games)}>
          {previous && was(format.number(previous.games))}
        </Tile>
        <Tile label={t('stats.darts')} value={format.number(current.darts)}>
          {previous && was(format.number(previous.darts))}
        </Tile>
        <Tile
          label={t('stats.average')}
          value={average === null ? '—' : format.decimal(average)}
        >
          {average !== null && previousAverage !== null && (
            <>
              <Delta
                change={
                  Math.round(average * 10) - Math.round(previousAverage * 10)
                }
                text={format.decimal(Math.abs(average - previousAverage))}
                better="up"
              />{' '}
              {was(format.decimal(previousAverage))}
            </>
          )}
        </Tile>
      </dl>
    </Card>
  )
}

const kinds = ['single', 'double', 'triple', 'miss'] as const
type Kind = (typeof kinds)[number]
const countOf: Record<Kind, keyof Shares & keyof StatsCounts> = {
  single: 'singles',
  double: 'doubles',
  triple: 'triples',
  miss: 'misses',
}
/** Which way each share is better: more doubles and triples, fewer misses. */
const better: Record<Kind, 'up' | 'down' | null> = {
  single: null,
  double: 'up',
  triple: 'up',
  miss: 'down',
}

function MixRow({ kind, view }: { kind: Kind; view: PlayerView }) {
  const { t } = useTranslation()
  const format = useFormat()
  const field = countOf[kind]
  const share = shares(view.current)?.[field] ?? 0
  const before = view.previous && shares(view.previous)
  const change = before ? Math.round((share - before[field]) * 1000) / 10 : null
  const bar = (
    <div className={styles.track} aria-hidden="true">
      <span style={{ width: `${share * 100}%` }} />
    </div>
  )
  return (
    <li className={styles.mixRow} data-kind={kind}>
      <span className={styles.kind} aria-hidden="true">
        {t(`stats.mix.short.${kind}`)}
      </span>
      <div>
        {bar}
        <span className={styles.muted}>
          {t('stats.mix.line', {
            name: t(`stats.mix.${kind}`),
            count: view.current[field],
          })}
        </span>
      </div>
      <div className={styles.mixValue}>
        <b>{format.percent(share)}</b>
        {change !== null && (
          <Delta
            change={change}
            text={format.points(Math.abs(change))}
            better={better[kind]}
          />
        )}
      </div>
    </li>
  )
}

/** Singles, doubles, triples and misses, with the change on before. */
export function DartMix({ view }: { view: PlayerView }) {
  const { t } = useTranslation()
  return (
    <Card
      title={t('stats.mix.title')}
      aside={view.previous && t('stats.mix.vsPrevious')}
    >
      <ul className={styles.mix}>
        {kinds.map((kind) => (
          <MixRow key={kind} kind={kind} view={view} />
        ))}
      </ul>
    </Card>
  )
}

function TrendTable({ view }: { view: PlayerView }) {
  const { t } = useTranslation()
  const format = useFormat()
  const rows = view.trend
    .filter((point) => point.doubles !== null)
    .map((point) => (
      <tr key={point.week}>
        <th scope="row">{format.week(point.week)}</th>
        <td className={styles.n}>
          {point.average === null ? '—' : format.decimal(point.average)}
        </td>
        <td className={styles.n}>{format.percent(point.doubles ?? 0)}</td>
        <td className={styles.n}>{format.percent(point.triples ?? 0)}</td>
      </tr>
    ))
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{t('stats.trends.week')}</th>
          <th scope="col" className={styles.n}>
            {t('stats.average')}
          </th>
          <th scope="col" className={styles.n}>
            {t('stats.mix.double')}
          </th>
          <th scope="col" className={styles.n}>
            {t('stats.mix.triple')}
          </th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  )
}

/** Weekly charts, with the numbers behind them in a table. */
export function Trends({
  view,
  showAverage,
}: {
  view: PlayerView
  /** Off when another game than x01 is picked. */
  showAverage: boolean
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const series = (
    pick: (point: PlayerView['trend'][number]) => number | null,
  ) =>
    view.trend.map((point) => ({
      label: format.week(point.week),
      value: pick(point),
    }))
  const asPercent = {
    format: (value: number) => format.percent(value),
    formatTick: (value: number) => format.percent(value, 0),
    step: 0.04,
    fromZero: true,
  }
  return (
    <Card title={t('stats.trends.title')} aside={t('stats.trends.perWeek')}>
      {showAverage && (
        <TrendChart
          title={t('stats.trends.average')}
          points={series((point) => point.average)}
          format={format.decimal}
          formatTick={format.number}
          color="var(--accent)"
          step={10}
        />
      )}
      <TrendChart
        title={t('stats.trends.doubles')}
        points={series((point) => point.doubles)}
        color="var(--double)"
        {...asPercent}
      />
      <TrendChart
        title={t('stats.trends.triples')}
        points={series((point) => point.triples)}
        color="var(--triple)"
        {...asPercent}
      />
      <details className={styles.details}>
        <summary>{t('stats.trends.showData')}</summary>
        <TrendTable view={view} />
      </details>
    </Card>
  )
}

function RivalLine({ rival, player }: { rival: Rival; player: Player }) {
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <li className={styles.rival}>
      <PlayerAvatar player={player} size={32} />
      <div>
        <div className={styles.rivalName}>
          {t('stats.rivals.vs', { name: player.name })}{' '}
          <small>
            {t('stats.rivals.shared', {
              ahead: rival.ahead,
              count: rival.games,
            })}
          </small>
        </div>
        <div className={styles.split} aria-hidden="true">
          <span style={{ flex: rival.ahead }} />
          <span style={{ flex: rival.games - rival.ahead }} />
        </div>
      </div>
      <b className={styles.pct}>
        {format.percent(rival.ahead / rival.games, 0)}
      </b>
    </li>
  )
}

/** How often the player finished ahead of each player they shared games with. */
export function Rivals({
  view,
  playerOf,
}: {
  view: PlayerView
  playerOf(id: PlayerId): Player
}) {
  const { t } = useTranslation()
  return (
    <Card title={t('stats.rivals.title')} aside={t('stats.rivals.ahead')}>
      {view.rivals.length === 0 ? (
        <p className={styles.muted}>{t('stats.rivals.none')}</p>
      ) : (
        <ul className={styles.rivals}>
          {view.rivals.map((rival) => (
            <RivalLine
              key={rival.playerId}
              rival={rival}
              player={playerOf(rival.playerId)}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function GameRow({ line }: { line: GameLine }) {
  const { t } = useTranslation()
  const format = useFormat()
  const ratio = winRatio(line.counts)
  const { games, wins, darts, points } = line.counts
  return (
    <tr>
      <th scope="row">{format.gameName(line.game)}</th>
      <td className={styles.n}>{format.number(games)}</td>
      <td className={styles.n}>{format.number(wins)}</td>
      <td className={styles.n}>
        {ratio === null ? '—' : format.percent(ratio, 0)}
      </td>
      <td className={styles.n}>
        {keyStat(
          line.game,
          line.average === null ? undefined : points,
          darts,
          games,
          format,
          t,
        )}
      </td>
    </tr>
  )
}

/** Games played, won and the key number, per game type. */
export function ByGame({ view }: { view: PlayerView }) {
  const { t } = useTranslation()
  return (
    <Card title={t('stats.byGame.title')}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('stats.byGame.game')}</th>
            <th scope="col" className={styles.n}>
              {t('stats.byGame.played')}
            </th>
            <th scope="col" className={styles.n}>
              {t('stats.byGame.won')}
            </th>
            <th scope="col" className={styles.n}>
              {t('stats.byGame.winRatio')}
            </th>
            <th scope="col" className={styles.n}>
              {t('stats.byGame.keyStat')}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.byGame.map((line) => (
            <GameRow key={line.game} line={line} />
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/** The game's name, with the start score for x01, e.g. `x01 · 501`. */
function recentTitle(record: GameRecord<unknown>, name: string): string {
  const options = record.options as { startScore?: unknown } | null
  return record.game === 'x01' && typeof options?.startScore === 'number'
    ? `${name} · ${options.startScore}`
    : name
}

function RecentLine({
  game,
  nameOf,
}: {
  game: RecentGame
  nameOf(id: PlayerId): string
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const { record, summary, others } = game
  const who =
    others.length === 0
      ? t('stats.recent.solo')
      : others.length <= 2
        ? t('stats.recent.vs', { names: others.map(nameOf).join(', ') })
        : t('stats.recent.players', { count: others.length + 1 })
  return (
    <li className={styles.recentLine}>
      <span
        className={styles.place}
        data-first={summary.place === 1 || undefined}
      >
        {t('game.place', { place: summary.place })}
      </span>
      <div>
        <div className={styles.recentTitle}>
          {recentTitle(record, format.gameName(record.game))}
        </div>
        <small className={styles.muted}>
          {format.date(record.result?.finishedAt ?? record.startedAt)} · {who}
        </small>
      </div>
      <span className={styles.recentKey}>
        {keyStat(record.game, summary.points, summary.darts, 1, format, t)}
      </span>
    </li>
  )
}

/** The player's last few games. */
export function RecentGames({
  view,
  nameOf,
}: {
  view: PlayerView
  nameOf(id: PlayerId): string
}) {
  const { t } = useTranslation()
  return (
    <Card title={t('stats.recent.title')}>
      <ul className={styles.recent}>
        {view.recent.map((game) => (
          <RecentLine key={game.record.id} game={game} nameOf={nameOf} />
        ))}
      </ul>
    </Card>
  )
}
