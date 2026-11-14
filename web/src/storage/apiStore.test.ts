import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiStore, latestOnly } from './apiStore'
import { createMemoryStore } from './memoryStore'
import type { StoredGame } from './store'

type Call = {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

/** A fake API: answers from `routes` by "METHOD /path" and records calls. */
function fakeApi(routes: Record<string, () => Response> = {}) {
  const calls: Call[] = []
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const route = routes[`${method} ${url}`]
    return route ? route() : new Response(null, { status: 204 })
  })
  return { fetch, calls }
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

function game(id: string, startedAt: string, finished = false): StoredGame {
  return {
    id,
    game: 'x01',
    configVersion: 1,
    options: { startScore: 501 },
    slots: [{ playerId: 'anna' }],
    darts: [],
    startedAt,
    result: finished
      ? { standings: ['anna'], finishedAt: '2026-11-14T21:00:00.000Z' }
      : null,
  }
}

function store(
  routes: Record<string, () => Response> = {},
  devHousehold?: string,
) {
  const api = fakeApi(routes)
  return {
    ...api,
    store: createApiStore({
      settings: createMemoryStore().settings,
      fetch: api.fetch,
      devHousehold,
    }),
  }
}

describe('API store', () => {
  it('lists players sorted by name', async () => {
    const { store: api } = store({
      'GET /api/players': json([
        { id: 'oli', name: 'Óli' },
        { id: 'anna', name: 'Anna' },
      ]),
    })

    expect(await api.players.list()).toEqual([
      { id: 'anna', name: 'Anna' },
      { id: 'oli', name: 'Óli' },
    ])
  })

  it('puts a player by id, with the dev header only when asked', async () => {
    const plain = store()
    await plain.store.players.put({ id: 'anna', name: 'Anna', color: 'sky' })
    expect(plain.calls[0]).toEqual({
      url: '/api/players/anna',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: { id: 'anna', name: 'Anna', color: 'sky' },
    })

    const dev = store({}, 'test')
    await dev.store.players.list()
    expect(dev.calls[0].headers).toEqual({ 'X-Household-Id': 'test' })
  })

  it('lists games newest first, with result null for games in play', async () => {
    const { result: _none, ...inPlay } = game('a', '2026-11-13T20:00:00.000Z')
    const finished = game('b', '2026-11-14T20:00:00.000Z', true)
    const { store: api } = store({ 'GET /api/games': json([inPlay, finished]) })

    const games = await api.games.list()

    expect(games.map((g) => g.id)).toEqual(['b', 'a'])
    expect(games[1].result).toBeNull()
    expect((await api.games.unfinished())?.id).toBe('a')
  })

  it('gets a game, or nothing for a 404', async () => {
    const { result: _none, ...inPlay } = game('a', '2026-11-13T20:00:00.000Z')
    const { store: api } = store({
      'GET /api/games/a': json(inPlay),
      'GET /api/games/b': json({ error: 'Not found.' }, 404),
    })

    expect(await api.games.get('a')).toEqual({ ...inPlay, result: null })
    expect(await api.games.get('b')).toBeUndefined()
  })

  it('saves and removes games', async () => {
    const { store: api, calls } = store()
    const record = game('a', '2026-11-13T20:00:00.000Z')

    await api.games.put(record)
    await api.games.remove('a')

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'PUT /api/games/a',
      'DELETE /api/games/a',
    ])
    expect(calls[0].body).toEqual(record)
  })

  it('throws an ApiError, e.g. when nobody is signed in', async () => {
    const { store: api } = store({
      'GET /api/players': json(
        { error: 'A signed-in household is needed.' },
        401,
      ),
    })

    const error = await api.players.list().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
  })

  it('keeps settings on the device', async () => {
    const settings = createMemoryStore().settings
    const api = createApiStore({ settings, fetch: fakeApi().fetch })

    await api.settings.put('gameId', 'killer')

    expect(await settings.get('gameId')).toBe('killer')
  })
})

describe('latestOnly', () => {
  function deferred() {
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  it('sends one at a time and skips values replaced while waiting', async () => {
    const sent: number[] = []
    const gates: ReturnType<typeof deferred>[] = []
    const save = latestOnly<number>((value) => {
      sent.push(value)
      const gate = deferred()
      gates.push(gate)
      return gate.promise
    })

    const first = save('game', 1)
    const second = save('game', 2)
    const third = save('game', 3)
    expect(sent).toEqual([1])

    gates[0].resolve()
    await first
    await vi.waitFor(() => expect(sent).toEqual([1, 3]))
    gates[1].resolve()
    await Promise.all([second, third])
    expect(sent).toEqual([1, 3])
  })

  it('keeps ids apart', async () => {
    const sent: string[] = []
    const save = latestOnly<string>(async (value) => {
      sent.push(value)
    })

    await Promise.all([save('a', 'a1'), save('b', 'b1')])

    expect(sent).toEqual(['a1', 'b1'])
  })

  it('rejects the callers whose save failed, and carries on', async () => {
    const save = latestOnly<number>(async (value) => {
      if (value === 1) throw new Error('offline')
    })

    await expect(save('game', 1)).rejects.toThrow('offline')
    await expect(save('game', 2)).resolves.toBeUndefined()
  })

  it('tells when an id has nothing left to send', async () => {
    const gate = deferred()
    const save = latestOnly<number>(() => gate.promise)
    const saving = save('game', 1)
    let settled = false
    const waiting = save.settled('game').then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    gate.resolve()
    await Promise.all([saving, waiting])
    expect(settled).toBe(true)
    await expect(save.settled('other')).resolves.toBeUndefined()
  })
})
