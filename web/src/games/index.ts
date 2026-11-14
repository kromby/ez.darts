import {
  gameStarter,
  type GameStarter,
} from '../components/GameShell/startGame'
import { parseGameConfig, type GameConfig } from '../engine/config'
import type { GameRecord } from '../engine/game'
import { aroundTheWorld } from './aroundTheWorld/aroundTheWorld'
import aroundTheWorldConfig from './aroundTheWorld/config.json'
import killerConfig from './killer/config.json'
import { killer } from './killer/killer'
import x01Config from './x01/config.json'
import { x01 } from './x01/x01'

/**
 * Every game's config, in the order the game picker shows them. Adding a
 * game: its JSON config, module and tests, then list it here and below.
 */
export const gameConfigs: GameConfig[] = [
  x01Config,
  aroundTheWorldConfig,
  killerConfig,
].map(parseGameConfig)

export function findGameConfig(id: string): GameConfig | undefined {
  return gameConfigs.find((config) => config.id === id)
}

const games: GameStarter[] = [
  gameStarter(x01),
  gameStarter(aroundTheWorld),
  gameStarter(killer),
]

export function findGame(id: string): GameStarter | undefined {
  return games.find((game) => game.id === id)
}

/**
 * The record with its summary, worked out by replaying it when a finished
 * game was saved without one (before stats, #20). Unchanged otherwise, or
 * when the game is unknown or can't be replayed.
 */
export function withSummary<T extends GameRecord<unknown>>(record: T): T {
  if (!record.result || record.summary) return record
  try {
    const summary = findGame(record.game)?.summarize(record)
    return summary ? { ...record, summary } : record
  } catch {
    return record
  }
}
