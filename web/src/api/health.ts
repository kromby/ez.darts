export type HealthStatus = 'ok' | 'unavailable'

export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    const response = await fetch('/api/health', { signal })
    if (!response.ok) return 'unavailable'
    const body = (await response.json()) as { status?: string }
    return body.status === 'ok' ? 'ok' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}
