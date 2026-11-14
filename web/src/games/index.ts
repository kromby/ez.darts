import { parseGameConfig, type GameConfig } from '../engine/config'
import type { GameModule } from '../engine/game'
import x01Config from './x01/config.json'
import { x01 } from './x01/x01'

/** Every game's config. Adding a game: its JSON config, module and tests. */
export const gameConfigs: GameConfig[] = [x01Config].map(parseGameConfig)

export function findGameConfig(id: string): GameConfig | undefined {
  return gameConfigs.find((config) => config.id === id)
}

/**
 * A module whose option and state types are only known to itself. The app
 * passes its options and state straight back to it, so this is safe.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyGameModule = GameModule<any, any>

const gameModules: AnyGameModule[] = [x01]

export function findGameModule(id: string): AnyGameModule | undefined {
  return gameModules.find((module) => module.id === id)
}
