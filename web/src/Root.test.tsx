import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createAuthSource, guest, type AuthSource } from './auth/auth'
import Root from './Root'
import { createMemoryStore } from './storage/memoryStore'
import { fakeAccountApi } from './test/fakeAccountApi'
import type { DataStore } from './storage/store'

function mockHealth() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
  )
}

/** Memory stores standing in for the API, one per household. */
function households() {
  const stores = new Map<string, DataStore>()
  const create = vi.fn<(householdId: string, devHeader: boolean) => DataStore>(
    (householdId) => {
      const store = stores.get(householdId) ?? createMemoryStore()
      stores.set(householdId, store)
      return store
    },
  )
  return { stores, create }
}

async function setup({ guestPlayers = ['Anna'] } = {}) {
  mockHealth()
  const local = createMemoryStore()
  for (const name of guestPlayers) {
    await local.players.put({ id: `guest-${name}`, name, color: 'sky' })
  }
  const auth = createAuthSource()
  const homes = households()
  render(
    <Root
      local={local}
      auth={auth}
      accountApi={fakeAccountApi().api}
      createHouseholdStore={homes.create}
    />,
  )
  await screen.findByRole('heading', { name: 'Leikmenn' })
  return { local, auth, homes, user: userEvent.setup() }
}

const signIn = (auth: AuthSource, householdId = 'home') =>
  act(() => auth.set({ status: 'signedIn', householdId }))

const offer = () =>
  screen.queryByRole('region', { name: 'Flytja inn gögn af þessu tæki?' })

describe('Root', () => {
  it("uses the device's store for a guest", async () => {
    const { homes } = await setup()

    expect(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    ).toBeInTheDocument()
    expect(homes.create).not.toHaveBeenCalled()
    expect(offer()).not.toBeInTheDocument()
  })

  it("switches to the household's store on sign-in and back on sign-out", async () => {
    const { auth, homes } = await setup()
    const home = createMemoryStore()
    await home.players.put({ id: 'home-oli', name: 'Óli' })
    homes.stores.set('home', home)

    signIn(auth)

    expect(
      await screen.findByRole('button', { name: 'Bæta Óli í leikinn' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bæta Anna í leikinn' }),
    ).not.toBeInTheDocument()
    expect(homes.create).toHaveBeenCalledWith('home', false)

    act(() => auth.set(guest))
    expect(
      await screen.findByRole('button', { name: 'Bæta Anna í leikinn' }),
    ).toBeInTheDocument()
  })

  it('offers once to import guest data, and imports it', async () => {
    const { auth, homes, local, user } = await setup({
      guestPlayers: ['Anna', 'Dagný'],
    })

    signIn(auth)

    expect(
      await screen.findByText(/Á þessu tæki eru 2 leikmenn og 0 leikir/),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Flytja inn' }))

    expect(
      await screen.findByText('Flutt inn: 2 leikmenn og 0 leikir.'),
    ).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'Bæta Dagný í leikinn' }),
    ).toBeInTheDocument()
    expect(await homes.stores.get('home')?.players.list()).toHaveLength(2)
    expect(await local.settings.get('importOffered')).toEqual(['home'])
    await user.click(screen.getByRole('button', { name: 'Loka' }))
    expect(screen.queryByRole('status', { name: /Flutt inn/ })).toBeNull()

    // Signing in again later doesn't ask again.
    act(() => auth.set(guest))
    await screen.findByRole('button', { name: 'Bæta Anna í leikinn' })
    signIn(auth)
    await screen.findByRole('button', { name: 'Bæta Dagný í leikinn' })
    expect(offer()).not.toBeInTheDocument()
  })

  it("remembers a skip, and doesn't import", async () => {
    const { auth, homes, local, user } = await setup()

    signIn(auth)
    await user.click(await screen.findByRole('button', { name: 'Sleppa' }))

    expect(offer()).not.toBeInTheDocument()
    await waitFor(async () =>
      expect(await local.settings.get('importOffered')).toEqual(['home']),
    )
    expect(await homes.stores.get('home')?.players.list()).toEqual([])
  })

  it('offers again to another household', async () => {
    const { auth, local } = await setup()
    await local.settings.put('importOffered', ['home'])

    signIn(auth, 'cabin')

    expect(
      await screen.findByRole('button', { name: 'Flytja inn' }),
    ).toBeVisible()
  })

  it('says when the import fails, and can try again', async () => {
    const { auth, homes, user } = await setup()
    const failing = createMemoryStore()
    const put = vi
      .spyOn(failing.players, 'put')
      .mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockReturnValue()
    homes.stores.set('home', failing)

    signIn(auth)
    await user.click(await screen.findByRole('button', { name: 'Flytja inn' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Innflutningur tókst ekki. Reyndu aftur.',
    )
    await user.click(screen.getByRole('button', { name: 'Flytja inn' }))
    expect(await screen.findByText(/Flutt inn: 1 leikmaður/)).toBeVisible()
    expect(put).toHaveBeenCalledTimes(2)
  })

  it('offers nothing when the device has no guest data', async () => {
    const { auth } = await setup({ guestPlayers: [] })

    signIn(auth)
    await screen.findByRole('heading', { name: 'Leikmenn' })

    expect(offer()).not.toBeInTheDocument()
  })

  it('signs up from the header, offers the import, and signs out again', async () => {
    mockHealth()
    const local = createMemoryStore()
    await local.players.put({ id: 'guest-anna', name: 'Anna', color: 'sky' })
    const auth = createAuthSource()
    const homes = households()
    const account = fakeAccountApi()
    render(
      <Root
        local={local}
        auth={auth}
        accountApi={account.api}
        createHouseholdStore={homes.create}
      />,
    )
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Leikmenn' })

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    await user.click(screen.getByRole('button', { name: 'Nýskráning' }))
    await user.type(screen.getByLabelText('Netfang'), 'anna@example.com')
    await user.type(screen.getByLabelText('Lykilorð'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Stofna aðgang' }))

    expect(homes.create).toHaveBeenCalledWith('home-1', false)
    await user.click(await screen.findByRole('button', { name: 'Flytja inn' }))
    expect(
      await screen.findByText('Flutt inn: 1 leikmaður og 0 leikir.'),
    ).toBeVisible()
    expect(await homes.stores.get('home-1')?.players.list()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Aðgangur' }))
    await user.click(screen.getByRole('button', { name: 'Skrá út' }))
    expect(auth.get()).toBe(guest)
    expect(
      await screen.findByRole('button', { name: 'Skrá inn' }),
    ).toBeInTheDocument()
  })
})
