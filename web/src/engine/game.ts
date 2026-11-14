import type { ComponentType } from 'react'
import type { Dart } from './dart'

export type PlayerId = string
export type TeamId = string

/** A player's place in the game, in throwing order. */
export type PlayerSlot = {
  playerId: PlayerId
  /** Set when the game is played in teams. */
  teamId?: TeamId
  /** Per-player options from the game config, such as a handicap. */
  options?: Record<string, unknown>
}

/**
 * Every game is a module with this shape, run by the shared game runner.
 * All functions must be pure: the runner rebuilds state by replaying the
 * dart log, so the same darts must always give the same state.
 */
export interface GameModule<TOptions, TState> {
  /** Matches the game config's `id`, e.g. `x01`. */
  id: string
  init(options: TOptions, slots: readonly PlayerSlot[]): TState
  applyDart(state: TState, dart: Dart): TState
  isOver(state: TState): boolean
  /** Who throws the next dart; the runner records it with the dart. */
  currentThrower(state: TState): PlayerId
  /** Players from first place to last. */
  standings(state: TState): PlayerId[]
  Scoreboard: ComponentType<{ state: TState }>
  hint?(state: TState): string | null
}

export type ThrownDart = {
  playerId: PlayerId
  dart: Dart
}

export type GameResult = {
  standings: PlayerId[]
  /** ISO 8601 timestamp. */
  finishedAt: string
}

/** Everything needed to save, resume and replay a game. */
export type GameRecord<TOptions> = {
  id: string
  /** The game module's id, e.g. `x01`. */
  game: string
  configVersion: number
  options: TOptions
  /** Players and teams in throwing order. */
  slots: PlayerSlot[]
  darts: ThrownDart[]
  /** ISO 8601 timestamp. */
  startedAt: string
  result: GameResult | null
}
