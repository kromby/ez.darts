import type { ReactNode } from 'react'
import type { OptionValues } from '../../engine/config'
import type {
  GameModule,
  GameRecord,
  PlayerId,
  PlayerSlot,
} from '../../engine/game'
import { createGameRecord } from '../../engine/runner'
import GameShell from './GameShell'

export type ShellCallbacks = {
  playerName(id: PlayerId): string
  onPlayAgain(): void
  onExit(): void
}

/**
 * A game in play. Its option and state types stay with its module, so the
 * app can hold any game without knowing them.
 */
export type StartedGame = {
  record: GameRecord<unknown>
  /** The game screen, keyed to this game. */
  render(callbacks: ShellCallbacks): ReactNode
  /** A fresh game with the same players and options. */
  again(): StartedGame
}

export type NewGameSetup = {
  /** The setup screen's values. */
  options: OptionValues
  slots: PlayerSlot[]
  configVersion: number
}

/** Starts games of one module from setup values. */
export type GameStarter = {
  id: string
  start(setup: NewGameSetup): StartedGame
}

function play<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  record: GameRecord<TOptions>,
): StartedGame {
  return {
    record,
    render: (callbacks) => (
      <GameShell
        key={record.id}
        module={module}
        record={record}
        {...callbacks}
      />
    ),
    again: () =>
      play(
        module,
        createGameRecord(module, {
          options: record.options,
          slots: record.slots,
          configVersion: record.configVersion,
        }),
      ),
  }
}

export function gameStarter<TOptions, TState>(
  module: GameModule<TOptions, TState>,
): GameStarter {
  return {
    id: module.id,
    start: ({ options, slots, configVersion }) =>
      play(
        module,
        createGameRecord(module, {
          options: module.toOptions(options),
          slots,
          configVersion,
        }),
      ),
  }
}
