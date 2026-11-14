import { describe, expect, it, vi } from 'vitest'
import { createAccountApi } from './accountApi'
import { createAuthSource, guest, restoreSession } from './auth'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function api(response: () => Response | Promise<Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(response()),
  )
  return { fetch, account: createAccountApi({ fetch }) }
}

describe('account API', () => {
  it('signs in with a same-origin JSON POST', async () => {
    const { fetch, account } = api(() =>
      json({ email: 'anna@example.com', householdId: 'home' }),
    )

    const result = await account.login('anna@example.com', 'correct horse')

    expect(result).toEqual({
      ok: true,
      value: { email: 'anna@example.com', householdId: 'home' },
    })
    expect(fetch).toHaveBeenCalledWith('/api/account/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'anna@example.com',
        password: 'correct horse',
      }),
    })
  })

  it('reads the error code', async () => {
    const taken = api(() =>
      json({ error: 'Taken', code: 'email-taken' }, 409),
    ).account
    const locked = api(() => json({ code: 'locked-out' }, 429)).account

    expect(await taken.register('anna@example.com', 'x')).toEqual({
      ok: false,
      error: 'email-taken',
    })
    expect(await locked.login('anna@example.com', 'x')).toEqual({
      ok: false,
      error: 'locked-out',
    })
  })

  it('reports a network failure', async () => {
    const { account } = api(() => Promise.reject(new TypeError('offline')))

    expect(await account.login('a@b.is', 'x')).toEqual({
      ok: false,
      error: 'network',
    })
    expect(await account.me()).toBeNull()
    await expect(account.logout()).resolves.toBeUndefined()
  })

  it('changes the password', async () => {
    const { fetch, account } = api(() => new Response(null, { status: 204 }))

    expect(await account.changePassword('old one!', 'new one!')).toEqual({
      ok: true,
      value: null,
    })
    expect(fetch.mock.calls[0][0]).toBe('/api/account/password')
  })
})

describe('restoreSession', () => {
  it('signs in from a live session cookie', async () => {
    const auth = createAuthSource()

    await restoreSession(auth, () =>
      Promise.resolve({ email: 'anna@example.com', householdId: 'home' }),
    )

    expect(auth.get()).toEqual({
      status: 'signedIn',
      householdId: 'home',
      email: 'anna@example.com',
    })
  })

  it('falls back without a session', async () => {
    const auth = createAuthSource()
    const dev = {
      status: 'signedIn' as const,
      householdId: 'dev',
      devHeader: true,
    }

    await restoreSession(auth, () => Promise.resolve(null))
    expect(auth.get()).toBe(guest)
    await restoreSession(auth, () => Promise.resolve(null), dev)
    expect(auth.get()).toBe(dev)
  })
})
