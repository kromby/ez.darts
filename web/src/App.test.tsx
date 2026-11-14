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

  it('picks players, sets up x01 and starts a game', async () => {
    mockHealth('ok')
    const user = userEvent.setup()

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Leikmenn' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Óli{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))

    expect(screen.getByRole('heading', { name: 'x01' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '501 tvöfalt út' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Óli' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Til baka' }))
    expect(screen.getByRole('list', { name: 'Kaströð' })).toHaveTextContent(
      /Anna.*Óli/,
    )
    await user.click(screen.getByRole('button', { name: 'Áfram' }))

    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Leikskjárinn kemur fljótlega.',
    )
  })
})
