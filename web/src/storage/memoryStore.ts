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

  return {
    players: {
      list: async () => [...players.values()].map(copy).sort(byName),
      put: async (player) => {
        players.set(player.id, copy(player))
      },
    },
    games: {
      list: async () => [...games.values()].map(copy).sort(newestFirst),
      get: async (id) => {
        const game = games.get(id)
        return game && copy(game)
      },
      unfinished: async () => {
        const game = [...games.values()]
          .sort(newestFirst)
          .find((stored) => stored.result === null)
        return game && copy(game)
      },
      put: async (game) => {
        games.set(game.id, copy(game))
      },
      remove: async (id) => {
        games.delete(id)
      },
    },
    settings: {
      get: async <K extends SettingKey>(key: K) => {
        const value = settings.get(key) as Settings[K] | undefined
        return value === undefined ? undefined : copy(value)
      },
      put: async (key, value) => {
        settings.set(key, copy(value))
      },
    },
  }
}
