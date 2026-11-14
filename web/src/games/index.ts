import { parseGameConfig, type GameConfig } from '../engine/config'
import x01 from './x01/config.json'

/** Every game's config. Adding a game: its JSON config, module and tests. */
export const gameConfigs: GameConfig[] = [x01].map(parseGameConfig)

export function findGameConfig(id: string): GameConfig | undefined {
  return gameConfigs.find((config) => config.id === id)
}
