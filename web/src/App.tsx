import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import GameSetup, {
  type GameSetupResult,
} from './components/GameSetup/GameSetup'
import GameShell from './components/GameShell/GameShell'
import LanguageSwitcher from './components/LanguageSwitcher'
import PlayerSelection from './components/PlayerSelection/PlayerSelection'
import type { GameRecord, PlayerSlot } from './engine/game'
import { createGameRecord } from './engine/runner'
import { findGameModule, gameConfigs } from './games'
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
  const [game, setGame] = useState<GameRecord<unknown>>()
  const config = gameConfigs[0]
  const module = findGameModule(config.id)

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

  function startGame(options: unknown, gameSlots: PlayerSlot[]) {
    if (!module) return
    setGame(
      createGameRecord(module, {
        options,
        slots: gameSlots,
        configVersion: config.version,
      }),
    )
    setStep('game')
  }

  if (step === 'game' && module && game) {
    return (
      <GameShell
        key={game.id}
        module={module}
        record={game}
        playerName={playerName}
        onPlayAgain={() => startGame(game.options, game.slots)}
        onExit={() => setStep('setup')}
      />
    )
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
        {step === 'setup' && module && (
          <GameSetup
            config={config}
            players={inGame}
            initial={setup}
            onBack={() => setStep('players')}
            onStart={(result) => {
              setSetup(result)
              startGame(
                module.toOptions(result.options),
                slots.map((slot) => ({
                  ...slot,
                  options: result.playerOptions[slot.playerId],
                })),
              )
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
