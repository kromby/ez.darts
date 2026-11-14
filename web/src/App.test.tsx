import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { languageStorageKey } from './i18n/languages'
import { createMemoryStore } from './storage/memoryStore'
import type { DataStore } from './storage/store'

/** Renders the app and waits for saved data to load. */
async function renderApp(store: DataStore = createMemoryStore()) {
  const result = render(<App store={store} />)
  await screen.findByRole('heading', { name: 'Leikmenn' })
  return result
}

function mockHealth(status: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ status }), { status: 200 }),
  )
}

describe('App', () => {
  it('shows the API status from /api/health in Icelandic by default', async () => {
    mockHealth('ok')

    await renderApp()

    expect(
      screen.getByRole('heading', { name: 'ez.darts' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Forritaskil: í lagi')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything())
    expect(screen.getByLabelText('Tungumál')).toHaveValue('is')
  })

  it('reports the API as unavailable when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'))

    await renderApp()

    expect(
      await screen.findByText('Forritaskil: ekki tiltæk'),
    ).toBeInTheDocument()
  })

  it('switches to English and remembers the choice on this device', async () => {
    mockHealth('ok')
    const user = userEvent.setup()

    await renderApp()
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

    await renderApp()

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

    // Handicaps carry over from setup into the game.
    const anna = within(screen.getByRole('group', { name: 'Anna' }))
    await user.type(anna.getByLabelText('Forgjöf (byrjunarstig)'), '40')
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))

    expect(
      screen.getByRole('heading', { name: '501 · Tvöfalt út · Umferð 1' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('40')

    await user.click(screen.getByRole('button', { name: 'Tvöfalt' }))
    await user.click(screen.getByRole('button', { name: 'Tvöfalt 20' }))

    expect(
      screen.getByRole('heading', { name: 'Anna vann!' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Spila aftur' }))
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('40')

    // Quitting goes back to setup, which keeps the last game's values.
    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    await user.click(screen.getByRole('button', { name: 'Já, hætta' }))
    expect(
      within(screen.getByRole('group', { name: 'Anna' })).getByLabelText(
        'Forgjöf (byrjunarstig)',
      ),
    ).toHaveValue('40')
  })

  it('picks Around the World and plays it', async () => {
    mockHealth('ok')
    const user = userEvent.setup()

    await renderApp()
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))

    const games = within(screen.getByRole('group', { name: 'Leikur' }))
    expect(games.getByRole('button', { name: 'x01' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(games.getByRole('button', { name: 'Hringinn í kring' }))
    expect(
      screen.getByRole('heading', { name: 'Hringinn í kring' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1–20 og miðja' }))
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))

    expect(
      screen.getByRole('heading', { name: '1–20 og miðja · Umferð 1' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tvöfalt' }))
    await user.click(screen.getByRole('button', { name: 'Tvöfalt 1' }))
    expect(screen.getByTestId('remaining')).toHaveTextContent('3')

    // Back at setup the game and its values are kept.
    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    await user.click(screen.getByRole('button', { name: 'Já, hætta' }))
    expect(
      screen.getByRole('button', { name: '1–20 og miðja' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('picks Killer and has players choose their numbers', async () => {
    mockHealth('ok')
    const user = userEvent.setup()

    await renderApp()
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Óli{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))
    const games = within(screen.getByRole('group', { name: 'Leikur' }))
    await user.click(games.getByRole('button', { name: 'Killer' }))
    await user.click(screen.getByRole('radio', { name: 'Velja' }))
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))

    expect(
      screen.getByRole('heading', {
        name: '3 líf · 3 hitt í killer · Leikmenn velja tölur',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Anna velur tölu' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Einfalt 7' }))
    await user.click(screen.getByRole('button', { name: 'Einfalt 12' }))

    expect(
      screen.getByRole('region', { name: 'Kastar: Anna' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('7')
    const sides = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(sides[1]).toHaveTextContent('Óli')
    expect(sides[1]).toHaveTextContent('12')
  })
})

describe('App storage', () => {
  it('remembers players and the last choices on this device', async () => {
    mockHealth('ok')
    const user = userEvent.setup()
    const store = createMemoryStore()

    const first = await renderApp(store)
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Óli{Enter}')
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))
    const games = within(screen.getByRole('group', { name: 'Leikur' }))
    await user.click(games.getByRole('button', { name: 'Hringinn í kring' }))
    await user.click(screen.getByRole('button', { name: '1–20 og miðja' }))
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))
    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    await user.click(screen.getByRole('button', { name: 'Já, hætta' }))
    first.unmount()

    // A reload: the same players, in the same order, then the same game.
    await renderApp(store)
    expect(screen.getByRole('list', { name: 'Kaströð' })).toHaveTextContent(
      /Óli.*Anna/,
    )
    await user.click(screen.getByRole('button', { name: 'Áfram' }))
    expect(
      screen.getByRole('heading', { name: 'Hringinn í kring' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '1–20 og miðja' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('carries on an unfinished game after a reload', async () => {
    mockHealth('ok')
    const user = userEvent.setup()
    const store = createMemoryStore()

    const first = await renderApp(store)
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))
    await user.click(screen.getByRole('button', { name: 'Þrefalt' }))
    await user.click(screen.getByRole('button', { name: 'Þrefalt 20' }))
    expect(screen.getByTestId('remaining')).toHaveTextContent('441')
    first.unmount()

    render(<App store={store} />)

    expect(await screen.findByTestId('remaining')).toHaveTextContent('441')
    expect(
      screen.getByRole('list', { name: 'Pílur í umferðinni' }),
    ).toHaveTextContent('T20')

    // Quitting drops it, so the next visit starts at the players.
    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    await user.click(screen.getByRole('button', { name: 'Já, hætta' }))
    await waitFor(async () => expect(await store.games.list()).toEqual([]))
  })

  it('keeps finished games', async () => {
    mockHealth('ok')
    const user = userEvent.setup()
    const store = createMemoryStore()

    await renderApp(store)
    await user.type(screen.getByLabelText('Nýr leikmaður'), 'Anna{Enter}')
    await user.click(screen.getByRole('button', { name: 'Áfram' }))
    const anna = within(screen.getByRole('group', { name: 'Anna' }))
    await user.type(anna.getByLabelText('Forgjöf (byrjunarstig)'), '40')
    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))
    await user.click(screen.getByRole('button', { name: 'Tvöfalt' }))
    await user.click(screen.getByRole('button', { name: 'Tvöfalt 20' }))
    await user.click(screen.getByRole('button', { name: 'Nýr leikur' }))

    await waitFor(async () => {
      const [finished] = await store.games.list()
      expect(finished.result?.standings).toEqual([expect.any(String)])
      expect(finished.darts).toHaveLength(1)
    })
    expect(await store.games.unfinished()).toBeUndefined()
  })

  it('starts at the players when a saved game cannot be resumed', async () => {
    mockHealth('ok')
    vi.spyOn(console, 'error').mockReturnValue()
    const store = createMemoryStore()
    await store.games.put({
      id: 'broken',
      game: 'no-such-game',
      configVersion: 1,
      options: {},
      slots: [],
      darts: [],
      startedAt: '2026-11-14T20:00:00.000Z',
      result: null,
    })

    await renderApp(store)

    expect(
      screen.getByRole('heading', { name: 'Leikmenn' }),
    ).toBeInTheDocument()
  })
})
