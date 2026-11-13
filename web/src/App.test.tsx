import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { languageStorageKey } from './i18n/languages'

function mockHealth(status: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ status }), { status: 200 }),
  )
}

describe('App', () => {
  it('shows the API status from /api/health in Icelandic by default', async () => {
    mockHealth('ok')

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'ez.darts' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Forritaskil: í lagi')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything())
    expect(screen.getByLabelText('Tungumál')).toHaveValue('is')
  })

  it('reports the API as unavailable when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'))

    render(<App />)

    expect(
      await screen.findByText('Forritaskil: ekki tiltæk'),
    ).toBeInTheDocument()
  })

  it('switches to English and remembers the choice on this device', async () => {
    mockHealth('ok')
    const user = userEvent.setup()

    render(<App />)
    await screen.findByText('Forritaskil: í lagi')

    await user.selectOptions(screen.getByLabelText('Tungumál'), 'English')

    expect(await screen.findByText('API: ok')).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toHaveValue('en')
    expect(localStorage.getItem(languageStorageKey)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
