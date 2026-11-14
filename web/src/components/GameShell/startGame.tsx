import type { ReactNode } from 'react'
import type { OptionValues } from '../../engine/config'
import type {
  GameModule,
  GameRecord,
  PlayerId,
  PlayerSlot,
  PlayerSummary,
} from '../../engine/game'
import { createGameRecord, replay, summaryOf } from '../../engine/runner'
import GameShell from './GameShell'

export type ShellCallbacks = {
  playerName(id: PlayerId): string
  /** The player's avatar colour as a CSS value. */
  playerColor?(id: PlayerId): string | undefined
  onPlayAgain(): void
  /** With the game's last record: unfinished when it was quit. */
  onExit(record: GameRecord<unknown>): void
  /** Called with the record at the start and after every dart. */
  onRecord?(record: GameRecord<unknown>): void
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
  /**
   * Carries on a saved game, e.g. after a reload. Throws if the record is
   * another game's or can't be replayed.
   */
  resume(record: GameRecord<unknown>): StartedGame
  /**
   * The summary of a finished game of this module, by replaying it: for
   * games saved before summaries were kept. `null` while unfinished.
   */
  summarize(record: GameRecord<unknown>): PlayerSummary[] | null
}

/** A new record, with chance settled by the module's `prepare`. */
function newRecord<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  options: TOptions,
  slots: PlayerSlot[],
  configVersion: number,
): GameRecord<TOptions> {
  return createGameRecord(module, {
    options: module.prepare
      ? module.prepare(options, slots, Math.random)
      : options,
    slots,
    configVersion,
  })
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
        newRecord(module, record.options, record.slots, record.configVersion),
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
        newRecord(module, module.toOptions(options), slots, configVersion),
      ),
    resume: (record) => {
      if (record.game !== module.id) {
        throw new Error(`A ${record.game} game is not ${module.id}`)
      }
      // Saved by this module, so its options are this module's. Replaying
      // checks that before the game screen does.
      const saved = record as GameRecord<TOptions>
      replay(module, saved)
      return play(module, saved)
    },
    summarize: (record) => {
      const { result } = record
      if (record.game !== module.id || !result) return null
      const saved = record as GameRecord<TOptions>
      return summaryOf(module, { ...saved, result }, replay(module, saved))
    },
  }
}
