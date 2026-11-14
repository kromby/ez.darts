import {
  gameStarter,
  type GameStarter,
} from '../components/GameShell/startGame'
import { parseGameConfig, type GameConfig } from '../engine/config'
import { aroundTheWorld } from './aroundTheWorld/aroundTheWorld'
import aroundTheWorldConfig from './aroundTheWorld/config.json'
import x01Config from './x01/config.json'
import { x01 } from './x01/x01'

/**
 * Every game's config, in the order the game picker shows them. Adding a
 * game: its JSON config, module and tests, then list it here and below.
 */
export const gameConfigs: GameConfig[] = [x01Config, aroundTheWorldConfig].map(
  parseGameConfig,
)

export function findGameConfig(id: string): GameConfig | undefined {
  return gameConfigs.find((config) => config.id === id)
}

const games: GameStarter[] = [gameStarter(x01), gameStarter(aroundTheWorld)]

export function findGame(id: string): GameStarter | undefined {
  return games.find((game) => game.id === id)
}
