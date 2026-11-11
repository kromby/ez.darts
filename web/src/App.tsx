import { useEffect, useState } from 'react'
import { fetchHealth, type HealthStatus } from './api/health'

function App() {
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
      <h1>ez.darts</h1>
      <p data-testid="api-status">API: {health}</p>
    </main>
  )
}

export default App
