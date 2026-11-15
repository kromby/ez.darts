import type { OptionValues } from '../engine/config'
import type { GameRecord, PlayerId, PlayerSlot } from '../engine/game'
import type { Player } from '../players/player'
import type { StatsRow } from '../stats/rows'

/** A game's setup-screen values, kept so the next game starts from them. */
export type SetupValues = {
  options: OptionValues
  playerOptions: Record<PlayerId, OptionValues>
}

/** Choices remembered between visits. */
export type Settings = {
  /** The players picked last, in throwing order and teams. */
  slots: PlayerSlot[]
  /** The game picked last. */
  gameId: string
  /** The last setup used for each game, by game id. */
  setups: Record<string, SetupValues>
  /**
   * Households this device's guest data has been offered to (imported or
   * skipped), so the offer comes once per household.
   */
  importOffered: string[]
}

export type SettingKey = keyof Settings

/** A game record as stored, whatever its game's option type. */
export type StoredGame = GameRecord<unknown>

/**
 * Where players, games and settings are kept. A guest's data lives on the
 * device (IndexedDB, #15); a signed-in household's comes from the API
 * (#18). The app only talks to this interface, so it can swap one for the
 * other on sign-in and sign-out, and import from one into the other.
 *
 * Every method returns a promise, as the API's will. Writes replace the
 * whole item (upsert), so the same calls create and update.
 */
export interface DataStore {
  players: {
    /** Every player, sorted by name. */
    list(): Promise<Player[]>
    put(player: Player): Promise<void>
  }
  games: {
    /** Every game, finished or not, newest first. */
    list(): Promise<StoredGame[]>
    get(id: string): Promise<StoredGame | undefined>
    /** The newest game without a result, to resume after a reload. */
    unfinished(): Promise<StoredGame | undefined>
    /** Saved after every dart, so a reload loses nothing. */
    put(game: StoredGame): Promise<void>
    /** For a game quit before the end, which is not kept. */
    remove(id: string): Promise<void>
  }
  settings: {
    get<K extends SettingKey>(key: K): Promise<Settings[K] | undefined>
    put<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>
  }
  stats: {
    /**
     * Every stats row: per player, game and ISO week, from the finished
     * games' summaries. The API keeps them as games are saved; a guest's
     * are added up from the games on the device.
     */
    rows(): Promise<StatsRow[]>
  }
}

/** Names in Icelandic alphabetical order, e.g. Á right after A. */
export function byName(a: Player, b: Player): number {
  return a.name.localeCompare(b.name, 'is')
}

/** Newest first; ISO timestamps sort as text. */
export function newestFirst(a: StoredGame, b: StoredGame): number {
  return b.startedAt.localeCompare(a.startedAt)
}
