import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import GamePicker from './components/GameSetup/GamePicker'
import GameSetup, {
  type GameSetupResult,
} from './components/GameSetup/GameSetup'
import type { StartedGame } from './components/GameShell/startGame'
import LanguageSwitcher from './components/LanguageSwitcher'
import PlayerSelection from './components/PlayerSelection/PlayerSelection'
import type { PlayerSlot } from './engine/game'
import { findGame, findGameConfig, gameConfigs } from './games'
import { createPlayer, type Player } from './players/player'
import type { DataStore } from './storage/store'
import styles from './App.module.css'

type Step = 'loading' | 'players' | 'setup' | 'game'

/** Saving happens in the background; a failed save never stops play. */
function save(write: Promise<void>) {
  write.catch((error: unknown) => console.error('Could not save', error))
}

type Props = {
  /** Where players, games and settings are kept: on the device for guests. */
  store: DataStore
}

function App({ store }: Props) {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking')
  const [step, setStep] = useState<Step>('loading')
  const [players, setPlayers] = useState<Player[]>([])
  const [slots, setSlots] = useState<PlayerSlot[]>([])
  const [gameId, setGameId] = useState(gameConfigs[0].id)
  // The last values used for each game, so going back keeps them.
  const [setups, setSetups] = useState<Record<string, GameSetupResult>>({})
  const [game, setGame] = useState<StartedGame>()
  const config = findGameConfig(gameId) ?? gameConfigs[0]
  const starter = findGame(config.id)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal).then((status) => {
      if (!controller.signal.aborted) setHealth(status)
    })
    return () => controller.abort()
  }, [])

  // Picks up where the guest left off: players, last choices, and a game
  // still in play when the page was closed or reloaded.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [known, savedSlots, savedGameId, savedSetups, unfinished] =
        await Promise.all([
          store.players.list(),
          store.settings.get('slots'),
          store.settings.get('gameId'),
          store.settings.get('setups'),
          store.games.unfinished(),
        ])
      if (cancelled) return
      const ids = new Set(known.map((player) => player.id))
      setPlayers(known)
      setSlots((savedSlots ?? []).filter((slot) => ids.has(slot.playerId)))
      if (savedGameId && findGameConfig(savedGameId)) setGameId(savedGameId)
      setSetups(savedSetups ?? {})

      let resumed: StartedGame | undefined
      if (unfinished) {
        try {
          resumed = findGame(unfinished.game)?.resume(unfinished)
        } catch (error) {
          console.error('Could not resume the unfinished game', error)
        }
      }
      setGame(resumed)
      setStep(resumed ? 'game' : 'players')
    }
    load().catch((error: unknown) => {
      console.error('Could not load saved data', error)
      if (!cancelled) setStep('players')
    })
    return () => {
      cancelled = true
    }
  }, [store])

  const inGame = slots.flatMap(
    (slot) => players.find((player) => player.id === slot.playerId) ?? [],
  )
  const playerName = (id: string) =>
    players.find((player) => player.id === id)?.name ?? id

  if (step === 'game' && game) {
    return game.render({
      playerName,
      onPlayAgain: () => setGame(game.again()),
      onExit: (record) => {
        // A game quit before the end is not kept; a finished one is.
        if (!record.result) save(store.games.remove(record.id))
        setStep('setup')
      },
      onRecord: (record) => save(store.games.put(record)),
    })
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.name}>{t('app.name')}</h1>
        <LanguageSwitcher />
      </header>
      <main className={styles.main}>
        {step === 'players' && (
          <PlayerSelection
            players={players}
            teamsSupported={config.teams}
            initial={slots}
            onAddPlayer={(name) => {
              const player = createPlayer(name)
              setPlayers((current) => [...current, player])
              save(store.players.put(player))
              return player
            }}
            onContinue={(chosen) => {
              setSlots(chosen)
              save(store.settings.put('slots', chosen))
              setStep('setup')
            }}
          />
        )}
        {step === 'setup' && (
          <GamePicker
            configs={gameConfigs}
            value={config.id}
            onChange={(id) => {
              setGameId(id)
              save(store.settings.put('gameId', id))
            }}
          />
        )}
        {step === 'setup' && starter && (
          <GameSetup
            key={config.id}
            config={config}
            players={inGame}
            initial={setups[config.id]}
            onBack={() => setStep('players')}
            onStart={(result) => {
              const next = { ...setups, [config.id]: result }
              setSetups(next)
              save(store.settings.put('setups', next))
              setGame(
                starter.start({
                  options: result.options,
                  slots: slots.map((slot) => ({
                    // Teams only for games that have them.
                    ...(config.teams ? slot : { playerId: slot.playerId }),
                    options: result.playerOptions[slot.playerId],
                  })),
                  configVersion: config.version,
                }),
              )
              setStep('game')
            }}
          />
        )}
      </main>
      <footer className={styles.footer}>
        <p data-testid="api-status">
          {t('api.status', { status: t(`api.statuses.${health}`) })}
        </p>
      </footer>
    </div>
  )
}

export default App
