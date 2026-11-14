import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import GameSetup, {
  type GameSetupResult,
} from './components/GameSetup/GameSetup'
import type { StartedGame } from './components/GameShell/startGame'
import LanguageSwitcher from './components/LanguageSwitcher'
import PlayerSelection from './components/PlayerSelection/PlayerSelection'
import type { PlayerSlot } from './engine/game'
import { findGame, gameConfigs } from './games'
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
  const [setup, setSetup] = useState<GameSetupResult>()
  const [game, setGame] = useState<StartedGame>()
  const config = gameConfigs[0]
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
        {step === 'setup' && starter && (
          <GameSetup
            config={config}
            players={inGame}
            initial={setup}
            onBack={() => setStep('players')}
            onStart={(result) => {
              setSetup(result)
              setGame(
                starter.start({
                  options: result.options,
                  slots: slots.map((slot) => ({
                    ...slot,
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
