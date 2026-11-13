import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth, type HealthStatus } from './api/health'
import LanguageSwitcher from './components/LanguageSwitcher'

function App() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal).then((status) => {
      if (!controller.signal.aborted) setHealth(status)
    })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>{t('app.name')}</h1>
      <p data-testid="api-status">
        {t('api.status', { status: t(`api.statuses.${health}`) })}
      </p>
      <LanguageSwitcher />
    </main>
  )
}

export default App
