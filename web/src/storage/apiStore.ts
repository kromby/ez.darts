import type { Player } from '../players/player'
import { byName, newestFirst, type DataStore, type StoredGame } from './store'

export class ApiError extends Error {
  name = 'ApiError'
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type ApiStoreOptions = {
  /** Where the API lives; `/api` on the same origin by default. */
  baseUrl?: string
  /**
   * Development only: sent as `X-Household-Id`, which `func start` trusts in
   * place of a session until sign-in (#19). Never set in production, where
   * the session cookie says who is signed in.
   */
  devHousehold?: string
  /**
   * Choices kept on this device rather than with the household, such as the
   * last players picked: the guest's local store.
   */
  settings: DataStore['settings']
  fetch?: typeof fetch
}

/**
 * The signed-in household's store: players and games through the API (#17),
 * so they follow the household to any device. Settings stay on the device.
 */
export function createApiStore({
  baseUrl = '/api',
  devHousehold,
  settings,
  fetch: send = (...args) => fetch(...args),
}: ApiStoreOptions): DataStore {
  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (devHousehold) headers['X-Household-Id'] = devHousehold
    const response = await send(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => '')
      throw new ApiError(
        response.status,
        `${method} ${path} failed with ${response.status} ${text}`.trim(),
      )
    }
    return response
  }

  async function json<T>(path: string): Promise<T | undefined> {
    const response = await request('GET', path)
    // Nothing there, or nothing sent back.
    if (response.status === 404 || response.status === 204) return undefined
    return (await response.json()) as T
  }

  const gameSaves = latestOnly<StoredGame>((game) =>
    request('PUT', `/games/${encodeURIComponent(game.id)}`, game),
  )

  const listGames = async () =>
    ((await json<StoredGame[]>('/games')) ?? []).map(asRecord).sort(newestFirst)

  return {
    players: {
      list: async () => ((await json<Player[]>('/players')) ?? []).sort(byName),
      put: async (player) => {
        await request(
          'PUT',
          `/players/${encodeURIComponent(player.id)}`,
          player,
        )
      },
    },
    games: {
      list: listGames,
      get: async (id) => {
        const game = await json<StoredGame>(`/games/${encodeURIComponent(id)}`)
        return game && asRecord(game)
      },
      unfinished: async () =>
        (await listGames()).find((game) => game.result === null),
      put: (game) => gameSaves(game.id, game),
      remove: async (id) => {
        // Wait for any save of it still on its way, so it doesn't come back.
        await gameSaves.settled(id)
        await request('DELETE', `/games/${encodeURIComponent(id)}`)
      },
    },
    settings,
  }
}

/**
 * The API leaves out empty fields; the app's records have `result: null`
 * for a game in play.
 */
function asRecord(game: StoredGame): StoredGame {
  return { ...game, result: game.result ?? null }
}

type LatestOnly<T> = ((id: string, value: T) => Promise<void>) & {
  /** Resolves once nothing for `id` is being sent or waiting. */
  settled(id: string): Promise<void>
}

/**
 * Sends one value per id at a time, in order, and skips values replaced
 * while they waited: saving after every dart sends the newest record next,
 * never an older one after a newer one. Every caller's promise settles once
 * a save at least as new as theirs is done.
 */
export function latestOnly<T>(
  send: (value: T) => Promise<unknown>,
): LatestOnly<T> {
  type Queue = {
    pending: T | null
    waiters: (() => void)[]
    failures: ((error: unknown) => void)[]
    running: Promise<void>
  }
  const queues = new Map<string, Queue>()

  async function drain(id: string, queue: Queue) {
    while (queue.pending !== null) {
      const value = queue.pending
      const resolve = queue.waiters
      const reject = queue.failures
      queue.pending = null
      queue.waiters = []
      queue.failures = []
      try {
        await send(value)
        for (const done of resolve) done()
      } catch (error) {
        for (const fail of reject) fail(error)
      }
    }
    queues.delete(id)
  }

  const save = (id: string, value: T) =>
    new Promise<void>((resolve, reject) => {
      const existing = queues.get(id)
      if (existing) {
        existing.pending = value
        existing.waiters.push(resolve)
        existing.failures.push(reject)
        return
      }
      const queue: Queue = {
        pending: value,
        waiters: [resolve],
        failures: [reject],
        running: Promise.resolve(),
      }
      queues.set(id, queue)
      queue.running = drain(id, queue)
    })

  save.settled = async (id: string) => {
    await queues.get(id)?.running
  }
  return save
}
