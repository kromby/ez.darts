import type { ComponentType } from 'react'
import type { OptionValues } from './config'
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

export type ScoreboardProps<TState> = {
  state: TState
  /** Display name for a player id. */
  playerName(id: PlayerId): string
  /** The player's avatar colour as a CSS value, when they have one. */
  playerColor?(id: PlayerId): string | undefined
  /**
   * The module's hint for the thrower, such as a checkout. `null` when there
   * is none right now; left out when the module gives no hints at all.
   */
  hint?: string | null
}

export type PlayerSummaryProps<TState> = {
  state: TState
  playerId: PlayerId
}

/**
 * Every game is a module with this shape, run by the shared game runner.
 * All functions must be pure: the runner rebuilds state by replaying the
 * dart log, so the same darts must always give the same state.
 */
export interface GameModule<TOptions, TState> {
  /** Matches the game config's `id`, e.g. `x01`. */
  id: string
  /** Reads the module's options from the setup screen's values. */
  toOptions(values: OptionValues): TOptions
  /**
   * Settles anything left to chance before each new game (play again
   * included), e.g. Killer's random numbers. The result is what the record
   * stores, so `init` and `applyDart` stay pure. `random` works like
   * `Math.random`.
   */
  prepare?(
    options: TOptions,
    slots: readonly PlayerSlot[],
    random: () => number,
  ): TOptions
  init(options: TOptions, slots: readonly PlayerSlot[]): TState
  applyDart(state: TState, dart: Dart): TState
  isOver(state: TState): boolean
  /** Who throws the next dart; the runner records it with the dart. */
  currentThrower(state: TState): PlayerId
  /** Players from first place to last. */
  standings(state: TState): PlayerId[]
  /** The game state above (phone) or beside (tablet) the dart pad. */
  Scoreboard: ComponentType<ScoreboardProps<TState>>
  /** One line about the game, e.g. "501 · Double out · Round 7". */
  Status?: ComponentType<ScoreboardProps<TState>>
  /** A player's key numbers on the results screen. */
  PlayerSummary?: ComponentType<PlayerSummaryProps<TState>>
  hint?(state: TState): string | null
  /**
   * Points a player scored, for games that keep score: x01 (where they add
   * up to a 3-dart average) and Cricket. Left out by games without points.
   */
  points?(state: TState, playerId: PlayerId): number
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

/**
 * One player's numbers from a finished game, kept with it for stats: where
 * the darts landed (a bull is a single, the bullseye a double), the place
 * (1 is first; team mates share one) and, for x01 and Cricket, the points
 * scored.
 * Stats only add these up, so the API needs no game rules.
 */
export type PlayerSummary = {
  playerId: PlayerId
  darts: number
  singles: number
  doubles: number
  triples: number
  misses: number
  place: number
  points?: number
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
  /** Set with the result: one entry per player, in throwing order. */
  summary?: PlayerSummary[]
}
