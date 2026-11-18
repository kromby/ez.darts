import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameRecord, PlayerId } from '../../engine/game'
import { gameConfigs } from '../../games'
import { localize } from '../../i18n/languages'
import { computerPlayer } from '../../players/computer'
import { isActive, type Player } from '../../players/player'
import { periods, type Period, type StatsFilter } from '../../stats/aggregate'
import { householdView } from '../../stats/householdView'
import { playerView } from '../../stats/playerView'
import type { StatsRow } from '../../stats/rows'
import type { DataStore } from '../../storage/store'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import { Averages, HeadToHeadCard, MixByPlayer, WinRatios } from './household'
import {
  ByGame,
  DartMix,
  Headline,
  RecentGames,
  Rivals,
  Trends,
} from './sections'
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

/** The house at the end of the player chips. */
function HouseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  )
}

/**
 * A player's stats: win ratio, where their darts land, weekly trends, head
 * to head, by game and recent games, for a period and game. The house chip
 * switches to the household view, comparing everyone. Works the same from
 * the API's stats (a household) as from the device's games (a guest).
 */
function StatsScreen({
  store,
  players,
  onBack,
  now = () => new Date(),
}: Props) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'is'
  const [data, setData] = useState<Data>({ status: 'loading' })
  const [filter, setFilter] = useState<StatsFilter>({
    period: '12w',
    game: null,
  })
  const [chosen, setChosen] = useState<PlayerId | null>(null)
  const [everyone, setEveryone] = useState(false)
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
      data.status === 'ready' && playerId !== null && !everyone
        ? playerView(data.rows, data.games, playerId, filter, today)
        : null,
    [data, playerId, filter, today, everyone],
  )
  const house = useMemo(
    () =>
      data.status === 'ready' && everyone
        ? householdView(data.rows, data.games, filter, today)
        : null,
    [data, filter, today, everyone],
  )
  const showAverage = filter.game === null || filter.game === 'x01'

  const playerOf = (pid: PlayerId): Player =>
    players.find((p) => p.id === pid) ??
    computerPlayer(pid, t) ?? { id: pid, name: pid }

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
              aria-pressed={!everyone && player.id === playerId}
              onClick={() => {
                setChosen(player.id)
                setEveryone(false)
              }}
            >
              <PlayerAvatar player={player} size={28} />
              {player.name}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${styles.house}`}
            aria-label={t('stats.household.open')}
            title={t('stats.household.open')}
            aria-pressed={everyone}
            onClick={() => setEveryone(true)}
          >
            <HouseIcon />
          </button>
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

      {((view && view.current.games === 0) || house?.players.length === 0) && (
        <p className={`${styles.card} ${styles.muted}`}>{t('stats.noGames')}</p>
      )}

      {view && view.current.games > 0 && (
        <>
          <Headline view={view} />
          <DartMix view={view} />
          <Trends view={view} showAverage={showAverage} />
          <Rivals view={view} playerOf={playerOf} />
          <ByGame view={view} />
          <RecentGames view={view} nameOf={(pid) => playerOf(pid).name} />
        </>
      )}

      {house && house.players.length > 0 && (
        <>
          <WinRatios view={house} period={filter.period} playerOf={playerOf} />
          <HeadToHeadCard view={house} playerOf={playerOf} />
          {showAverage && <Averages view={house} playerOf={playerOf} />}
          <MixByPlayer view={house} playerOf={playerOf} />
        </>
      )}
    </div>
  )
}

export default StatsScreen
