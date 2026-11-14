import type { Player } from '../players/player'
import {
  byName,
  newestFirst,
  type DataStore,
  type SettingKey,
  type Settings,
  type StoredGame,
} from './store'

/**
 * Keeps everything in memory: for tests, and for browsers where IndexedDB
 * is unavailable (some private modes), where data lasts until the page
 * closes. Items are copied in and out, as a real store would.
 */
export function createMemoryStore(): DataStore {
  const players = new Map<string, Player>()
  const games = new Map<string, StoredGame>()
  const settings = new Map<SettingKey, unknown>()
  const copy = <T>(value: T): T => structuredClone(value)
  const done = Promise.resolve()

  return {
    players: {
      list: () => Promise.resolve([...players.values()].map(copy).sort(byName)),
      put: (player) => {
        players.set(player.id, copy(player))
        return done
      },
    },
    games: {
      list: () =>
        Promise.resolve([...games.values()].map(copy).sort(newestFirst)),
      get: (id) => {
        const game = games.get(id)
        return Promise.resolve(game && copy(game))
      },
      unfinished: () => {
        const game = [...games.values()]
          .sort(newestFirst)
          .find((stored) => stored.result === null)
        return Promise.resolve(game && copy(game))
      },
      put: (game) => {
        games.set(game.id, copy(game))
        return done
      },
      remove: (id) => {
        games.delete(id)
        return done
      },
    },
    settings: {
      get: <K extends SettingKey>(key: K) => {
        const value = settings.get(key) as Settings[K] | undefined
        return Promise.resolve(value === undefined ? undefined : copy(value))
      },
      put: (key, value) => {
        settings.set(key, copy(value))
        return done
      },
    },
  }
}
