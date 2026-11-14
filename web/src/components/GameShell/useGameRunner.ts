import { useState, useSyncExternalStore } from 'react'
import type { GameModule, GameRecord } from '../../engine/game'
import { createGameRunner } from '../../engine/runner'

/**
 * Runs a game for a component. The runner is made once, so give the
 * component a new `key` to start another game.
 */
export function useGameRunner<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  record: GameRecord<TOptions>,
) {
  const [runner] = useState(() => createGameRunner(module, record))
  const snapshot = useSyncExternalStore(runner.subscribe, runner.getSnapshot)
  return { runner, ...snapshot }
}
