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
import styles from './App.module.css'

type Step = 'players' | 'setup' | 'game'

function App() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking')
  const [step, setStep] = useState<Step>('players')
  // Kept in memory until player storage (#15, #16).
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

  const inGame = slots.flatMap(
    (slot) => players.find((player) => player.id === slot.playerId) ?? [],
  )
  const playerName = (id: string) =>
    players.find((player) => player.id === id)?.name ?? id

  if (step === 'game' && game) {
    return game.render({
      playerName,
      onPlayAgain: () => setGame(game.again()),
      onExit: () => setStep('setup'),
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
              return player
            }}
            onContinue={(chosen) => {
              setSlots(chosen)
              setStep('setup')
            }}
          />
        )}
        {step === 'setup' && (
          <GamePicker
            configs={gameConfigs}
            value={config.id}
            onChange={setGameId}
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
              setSetups((current) => ({ ...current, [config.id]: result }))
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
