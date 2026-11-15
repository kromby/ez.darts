import type { Player } from '../players/player'
import { rowsFromGames } from '../stats/rows'
import {
  byName,
  newestFirst,
  type DataStore,
  type SettingKey,
  type Settings,
  type StoredGame,
} from './store'

export const databaseName = 'ez-darts'
/** Bump with an upgrade step in `upgrade` when the stores change. */
const version = 1

const PLAYERS = 'players'
const GAMES = 'games'
const SETTINGS = 'settings'
type StoreName = typeof PLAYERS | typeof GAMES | typeof SETTINGS

function upgrade(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore(PLAYERS, { keyPath: 'id' })
    const games = db.createObjectStore(GAMES, { keyPath: 'id' })
    games.createIndex('startedAt', 'startedAt')
    // Settings are stored under their key, e.g. `slots`.
    db.createObjectStore(SETTINGS)
  }
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function open(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const request = factory.open(name, version)
  request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion)
  return done(request)
}

/**
 * The guest's store: players, games and settings in the browser's
 * IndexedDB, so they stay on this device across visits.
 */
export async function openIndexedDbStore(
  factory: IDBFactory = indexedDB,
  name = databaseName,
): Promise<DataStore> {
  const db = await open(factory, name)
  // Another tab upgrading the database closes this connection.
  db.onversionchange = () => db.close()

  /** Runs one request in its own transaction and waits for it to commit. */
  async function run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    request: (objects: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const transaction = db.transaction(store, mode)
    const result = done(request(transaction.objectStore(store)))
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    return result
  }

  const allGames = async () =>
    (await run(GAMES, 'readonly', (games) => games.getAll())) as StoredGame[]

  return {
    players: {
      list: async () =>
        (
          (await run(PLAYERS, 'readonly', (players) =>
            players.getAll(),
          )) as Player[]
        ).sort(byName),
      put: async (player) => {
        await run(PLAYERS, 'readwrite', (players) => players.put(player))
      },
    },
    games: {
      list: async () => (await allGames()).sort(newestFirst),
      get: async (id) =>
        (await run(GAMES, 'readonly', (games) => games.get(id))) as
          StoredGame | undefined,
      // Few games are unfinished at once (usually none), so reading them
      // all is fine for a guest's history.
      unfinished: async () =>
        (await allGames())
          .sort(newestFirst)
          .find((game) => game.result === null),
      put: async (game) => {
        await run(GAMES, 'readwrite', (games) => games.put(game))
      },
      remove: async (id) => {
        await run(GAMES, 'readwrite', (games) => games.delete(id))
      },
    },
    settings: {
      get: async <K extends SettingKey>(key: K) =>
        (await run(SETTINGS, 'readonly', (settings) => settings.get(key))) as
          Settings[K] | undefined,
      put: async (key, value) => {
        await run(SETTINGS, 'readwrite', (settings) => settings.put(value, key))
      },
    },
    stats: {
      rows: async () => rowsFromGames(await allGames()),
    },
  }
}
