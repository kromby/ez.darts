import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameRecord, PlayerId } from '../../engine/game'
import { findGameConfig, gameConfigs } from '../../games'
import { formatDecimal, formatNumber, formatPercent } from '../../i18n/format'
import { localize } from '../../i18n/languages'
import { isActive, type Player } from '../../players/player'
import {
  periods,
  shares,
  weekStart,
  winRatio,
  type Period,
  type Shares,
  type StatsFilter,
} from '../../stats/aggregate'
import { playerView, type RecentGame } from '../../stats/playerView'
import type { StatsCounts, StatsRow } from '../../stats/rows'
import type { DataStore } from '../../storage/store'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import Delta from './Delta'
import TrendChart from './TrendChart'
import styles from './StatsScreen.module.css'

type Props = {
  store: DataStore
  /** Every player, removed ones too: their past games still count. */
  players: Player[]
  onBack(): void
  /** Clock for the periods; defaults to now. */
  now?: () => Date
}

type Data =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; rows: StatsRow[]; games: GameRecord<unknown>[] }

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

/**
 * A player's stats: win ratio, where their darts land, weekly trends, head
 * to head, by game and recent games, for a period and game. Works the same
 * from the API's stats (a household) as from the device's games (a guest).
 */
function StatsScreen({
  store,
  players,
  onBack,
  now = () => new Date(),
}: Props) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'is'
  const id = useId()
  const [data, setData] = useState<Data>({ status: 'loading' })
  const [filter, setFilter] = useState<StatsFilter>({
    period: '12w',
    game: null,
  })
  const [chosen, setChosen] = useState<PlayerId | null>(null)
  const [today] = useState(now)

  // Bumped by "Try again".
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([store.stats.rows(), store.games.list()])
      .then(([rows, games]) => {
        if (!cancelled) setData({ status: 'ready', rows, games })
      })
      .catch((error: unknown) => {
        console.error('Could not load stats', error)
        if (!cancelled) setData({ status: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [store, attempt])

  // Active players, and removed ones who have stats.
  const chips = useMemo(() => {
    const withStats = new Set(
      data.status === 'ready' ? data.rows.map((row) => row.playerId) : [],
    )
    return players.filter((p) => isActive(p) || withStats.has(p.id))
  }, [players, data])
  const playerId = chosen ?? chips[0]?.id ?? null

  const view = useMemo(
    () =>
      data.status === 'ready' && playerId !== null
        ? playerView(data.rows, data.games, playerId, filter, today)
        : null,
    [data, playerId, filter, today],
  )

  const nameOf = (pid: PlayerId) =>
    players.find((p) => p.id === pid)?.name ?? pid
  const gameName = (game: string) => {
    const config = findGameConfig(game)
    return config ? localize(config.name, language) : game
  }
  const number = (value: number) => formatNumber(value, language)
  const decimal = (value: number) => formatDecimal(value, language)
  const percent = (value: number, digits = 1) =>
    formatPercent(value, language, digits)
  const points = (value: number) => t('stats.points', { value: decimal(value) })
  const weekLabel = (week: string) =>
    new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(weekStart(week))

  return (
    <div className={styles.stats}>
      <div className={styles.appbar}>
        <button type="button" className={styles.back} onClick={onBack}>
          {t('stats.back')}
        </button>
        <h2 className={styles.title}>{t('stats.title')}</h2>
      </div>

      {chips.length > 0 && (
        <div
          className={styles.chips}
          role="group"
          aria-label={t('stats.player')}
        >
          {chips.map((player) => (
            <button
              key={player.id}
              type="button"
              className={styles.chip}
              aria-pressed={player.id === playerId}
              onClick={() => setChosen(player.id)}
            >
              <PlayerAvatar player={player} size={28} />
              {player.name}
            </button>
          ))}
        </div>
      )}

      <div
        className={styles.periods}
        role="group"
        aria-label={t('stats.period')}
      >
        {periods.map((period: Period) => (
          <button
            key={period}
            type="button"
            className={styles.period}
            aria-pressed={filter.period === period}
            onClick={() => setFilter({ ...filter, period })}
          >
            {t(`stats.periods.${period}`)}
          </button>
        ))}
      </div>

      <label className={styles.select}>
        <small>{t('stats.game')}</small>
        <select
          value={filter.game ?? ''}
          onChange={(event) =>
            setFilter({ ...filter, game: event.target.value || null })
          }
        >
          <option value="">{t('stats.allGames')}</option>
          {gameConfigs.map((config) => (
            <option key={config.id} value={config.id}>
              {localize(config.name, language)}
            </option>
          ))}
        </select>
      </label>

      {data.status === 'loading' && (
        <p className={styles.muted} role="status">
          {t('stats.loading')}
        </p>
      )}
      {data.status === 'failed' && (
        <div className={styles.card} role="alert">
          <p className={styles.muted}>{t('stats.failed')}</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              setData({ status: 'loading' })
              setAttempt((n) => n + 1)
            }}
          >
            {t('stats.retry')}
          </button>
        </div>
      )}
      {data.status === 'ready' && chips.length === 0 && (
        <p className={styles.muted}>{t('stats.noPlayers')}</p>
      )}

      {view && view.current.games === 0 && (
        <p className={`${styles.card} ${styles.muted}`}>{t('stats.noGames')}</p>
      )}

      {view && view.current.games > 0 && (
        <>
          <section className={styles.card} aria-labelledby={`${id}-hero`}>
            <div className={styles.hero}>
              <div>
                <h3 id={`${id}-hero`} className={styles.label}>
                  {t('stats.winRatio')}
                </h3>
                <WinRatio
                  current={view.current}
                  previous={view.previous}
                  language={language}
                />
              </div>
            </div>
            <dl className={styles.tiles}>
              <div className={styles.tile}>
                <dt>{t('stats.games')}</dt>
                <dd className={styles.value}>{number(view.current.games)}</dd>
                {view.previous && (
                  <dd className={styles.muted}>
                    {t('stats.previous', {
                      value: number(view.previous.games),
                    })}
                  </dd>
                )}
              </div>
              <div className={styles.tile}>
                <dt>{t('stats.darts')}</dt>
                <dd className={styles.value}>{number(view.current.darts)}</dd>
                {view.previous && (
                  <dd className={styles.muted}>
                    {t('stats.previous', {
                      value: number(view.previous.darts),
                    })}
                  </dd>
                )}
              </div>
              <div className={styles.tile}>
                <dt>{t('stats.average')}</dt>
                <dd className={styles.value}>
                  {view.average === null ? '—' : decimal(view.average)}
                </dd>
                {view.average !== null && view.previousAverage !== null && (
                  <dd>
                    <Delta
                      change={
                        Math.round(view.average * 10) -
                        Math.round(view.previousAverage * 10)
                      }
                      text={decimal(
                        Math.abs(view.average - view.previousAverage),
                      )}
                      better="up"
                    />{' '}
                    <span className={styles.muted}>
                      {t('stats.previous', {
                        value: decimal(view.previousAverage),
                      })}
                    </span>
                  </dd>
                )}
              </div>
            </dl>
          </section>

          <section className={styles.card} aria-labelledby={`${id}-mix`}>
            <div className={styles.cardHead}>
              <h3 id={`${id}-mix`}>{t('stats.mix.title')}</h3>
              {view.previous && <span>{t('stats.mix.vsPrevious')}</span>}
            </div>
            <ul className={styles.mix}>
              {kinds.map((kind) => {
                const field = countOf[kind]
                const share = shares(view.current)?.[field] ?? 0
                const before = view.previous && shares(view.previous)
                const change = before
                  ? Math.round((share - before[field]) * 1000) / 10
                  : null
                return (
                  <li key={kind} className={styles.mixRow} data-kind={kind}>
                    <span className={styles.kind} aria-hidden="true">
                      {t(`stats.mix.short.${kind}`)}
                    </span>
                    <div>
                      <div className={styles.track} aria-hidden="true">
                        <span style={{ width: `${share * 100}%` }} />
                      </div>
                      <span className={styles.muted}>
                        {t('stats.mix.line', {
                          name: t(`stats.mix.${kind}`),
                          count: view.current[field],
                        })}
                      </span>
                    </div>
                    <div className={styles.mixValue}>
                      <b>{percent(share)}</b>
                      {change !== null && (
                        <Delta
                          change={change}
                          text={points(Math.abs(change))}
                          better={better[kind]}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby={`${id}-trends`}>
            <div className={styles.cardHead}>
              <h3 id={`${id}-trends`}>{t('stats.trends.title')}</h3>
              <span>{t('stats.trends.perWeek')}</span>
            </div>
            {filter.game === null || filter.game === 'x01' ? (
              <TrendChart
                title={t('stats.trends.average')}
                points={view.trend.map((p) => ({
                  label: weekLabel(p.week),
                  value: p.average,
                }))}
                format={decimal}
                formatTick={number}
                color="var(--accent)"
                step={10}
              />
            ) : null}
            <TrendChart
              title={t('stats.trends.doubles')}
              points={view.trend.map((p) => ({
                label: weekLabel(p.week),
                value: p.doubles,
              }))}
              format={(v) => percent(v)}
              formatTick={(v) => percent(v, 0)}
              color="var(--double)"
              step={0.04}
              fromZero
            />
            <TrendChart
              title={t('stats.trends.triples')}
              points={view.trend.map((p) => ({
                label: weekLabel(p.week),
                value: p.triples,
              }))}
              format={(v) => percent(v)}
              formatTick={(v) => percent(v, 0)}
              color="var(--triple)"
              step={0.04}
              fromZero
            />
            <details className={styles.details}>
              <summary>{t('stats.trends.showData')}</summary>
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
                <tbody>
                  {view.trend
                    .filter((p) => p.doubles !== null)
                    .map((p) => (
                      <tr key={p.week}>
                        <th scope="row">{weekLabel(p.week)}</th>
                        <td className={styles.n}>
                          {p.average === null ? '—' : decimal(p.average)}
                        </td>
                        <td className={styles.n}>{percent(p.doubles ?? 0)}</td>
                        <td className={styles.n}>{percent(p.triples ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          </section>

          <section className={styles.card} aria-labelledby={`${id}-rivals`}>
            <div className={styles.cardHead}>
              <h3 id={`${id}-rivals`}>{t('stats.rivals.title')}</h3>
              <span>{t('stats.rivals.ahead')}</span>
            </div>
            {view.rivals.length === 0 ? (
              <p className={styles.muted}>{t('stats.rivals.none')}</p>
            ) : (
              <ul className={styles.rivals}>
                {view.rivals.map((rival) => {
                  const player = players.find((p) => p.id === rival.playerId)
                  return (
                    <li key={rival.playerId} className={styles.rival}>
                      <PlayerAvatar
                        player={player ?? { name: nameOf(rival.playerId) }}
                        size={32}
                      />
                      <div>
                        <div className={styles.rivalName}>
                          {t('stats.rivals.vs', {
                            name: nameOf(rival.playerId),
                          })}{' '}
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
                        {percent(rival.ahead / rival.games, 0)}
                      </b>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={styles.card} aria-labelledby={`${id}-games`}>
            <div className={styles.cardHead}>
              <h3 id={`${id}-games`}>{t('stats.byGame.title')}</h3>
            </div>
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
                {view.byGame.map((line) => {
                  const ratio = winRatio(line.counts)
                  return (
                    <tr key={line.game}>
                      <th scope="row">{gameName(line.game)}</th>
                      <td className={styles.n}>{number(line.counts.games)}</td>
                      <td className={styles.n}>{number(line.counts.wins)}</td>
                      <td className={styles.n}>
                        {ratio === null ? '—' : percent(ratio, 0)}
                      </td>
                      <td className={styles.n}>
                        {line.average !== null
                          ? t('stats.byGame.average', {
                              value: decimal(line.average),
                            })
                          : line.game === 'around-the-world'
                            ? t('stats.byGame.darts', {
                                value: number(
                                  Math.round(
                                    line.counts.darts / line.counts.games,
                                  ),
                                ),
                              })
                            : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.card} aria-labelledby={`${id}-recent`}>
            <div className={styles.cardHead}>
              <h3 id={`${id}-recent`}>{t('stats.recent.title')}</h3>
            </div>
            <ul className={styles.recent}>
              {view.recent.map((game) => (
                <RecentLine
                  key={game.record.id}
                  game={game}
                  title={recentTitle(game.record, gameName(game.record.game))}
                  language={language}
                  nameOf={nameOf}
                />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/** The headline: win ratio over matches, with the change in points. */
function WinRatio({
  current,
  previous,
  language,
}: {
  current: StatsCounts
  previous: StatsCounts | null
  language: string
}) {
  const { t } = useTranslation()
  const ratio = winRatio(current)
  const before = previous && winRatio(previous)
  const change =
    ratio === null || before === null
      ? null
      : Math.round(ratio * 100) - Math.round(before * 100)
  return (
    <>
      <p className={styles.big}>
        {ratio === null ? '—' : formatPercent(ratio, language, 0)}
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
              value: formatNumber(Math.abs(change), language),
            })}
            better="up"
          />
        )}
      </div>
    </>
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
  title,
  language,
  nameOf,
}: {
  game: RecentGame
  title: string
  language: string
  nameOf(id: PlayerId): string
}) {
  const { t } = useTranslation()
  const { record, summary, others } = game
  const date = new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(record.result?.finishedAt ?? record.startedAt))
  const who =
    others.length === 0
      ? t('stats.recent.solo')
      : others.length <= 2
        ? t('stats.recent.vs', { names: others.map(nameOf).join(', ') })
        : t('stats.recent.players', { count: others.length + 1 })
  const key =
    summary.points !== undefined && summary.darts > 0
      ? t('stats.byGame.average', {
          value: formatDecimal((summary.points / summary.darts) * 3, language),
        })
      : record.game === 'around-the-world' && summary.darts > 0
        ? t('stats.byGame.darts', {
            value: formatNumber(summary.darts, language),
          })
        : '—'
  return (
    <li className={styles.recentLine}>
      <span
        className={styles.place}
        data-first={summary.place === 1 || undefined}
      >
        {t('game.place', { place: summary.place })}
      </span>
      <div>
        <div className={styles.recentTitle}>{title}</div>
        <small className={styles.muted}>
          {date} · {who}
        </small>
      </div>
      <span className={styles.recentKey}>{key}</span>
    </li>
  )
}

export default StatsScreen
