import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import GameSetup from './components/GameSetup/GameSetup'
import LanguageSwitcher from './components/LanguageSwitcher'
import { gameConfigs } from './games'
import styles from './App.module.css'

function App() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal).then((status) => {
      if (!controller.signal.aborted) setHealth(status)
    })
    return () => controller.abort()
  }, [])

  // Placeholder players until player selection (#8).
  const players = [1, 2].map((number) => ({
    id: `player-${number}`,
    name: t('setup.demoPlayer', { number }),
  }))

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.name}>{t('app.name')}</h1>
        <LanguageSwitcher />
      </header>
      <main className={styles.main}>
        {started ? (
          <div className={styles.placeholder}>
            <p role="status">{t('setup.comingSoon')}</p>
            <button type="button" onClick={() => setStarted(false)}>
              {t('setup.back')}
            </button>
          </div>
        ) : (
          <GameSetup
            config={gameConfigs[0]}
            players={players}
            onStart={() => setStarted(true)}
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
