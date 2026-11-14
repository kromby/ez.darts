import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import DartPad from './components/DartPad/DartPad'
import { notation, type Dart } from './engine/dart'
import type { PlayerSlot } from './engine/game'
import GameSetup from './components/GameSetup/GameSetup'
import LanguageSwitcher from './components/LanguageSwitcher'
import PlayerSelection from './components/PlayerSelection/PlayerSelection'
import { gameConfigs } from './games'
import { createPlayer, type Player } from './players/player'
import styles from './App.module.css'

type Step = 'players' | 'setup' | 'started'

function App() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking')
  const [step, setStep] = useState<Step>('players')
  // Kept in memory until player storage (#15, #16).
  const [players, setPlayers] = useState<Player[]>([])
  const [slots, setSlots] = useState<PlayerSlot[]>([])
  // Darts from the pad preview until the game screen (#10).
  const [darts, setDarts] = useState<Dart[]>([])
  const config = gameConfigs[0]

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
          <GameSetup
            config={config}
            players={inGame}
            onBack={() => setStep('players')}
            onStart={() => setStep('started')}
          />
        )}
        {step === 'started' && (
          <div className={styles.placeholder}>
            <p role="status">{t('setup.comingSoon')}</p>
            <p>{t('setup.padPreview')}</p>
            <ol className={styles.darts} aria-label={t('setup.padDarts')}>
              {darts.slice(-3).map((thrown, index) => (
                <li key={darts.length - 3 + index}>
                  {notation(thrown) ?? t('pad.miss')}
                </li>
              ))}
            </ol>
            <div className={styles.pad}>
              <DartPad
                canUndo={darts.length > 0}
                onDart={(thrown) => setDarts((current) => [...current, thrown])}
                onUndo={() => setDarts((current) => current.slice(0, -1))}
              />
            </div>
            <button type="button" onClick={() => setStep('setup')}>
              {t('setup.back')}
            </button>
          </div>
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
