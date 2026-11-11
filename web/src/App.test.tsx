import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the API status from /api/health', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    )

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'ez.darts' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('API: ok')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything())
  })

  it('reports the API as unavailable when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'))

    render(<App />)

    expect(await screen.findByText('API: unavailable')).toBeInTheDocument()
  })
})
