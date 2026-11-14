// Kept apart from killer.ts so its components can use these without an
// import cycle.
import type { Dart } from '../../engine/dart'
import type { PlayerId } from '../../engine/game'
import type { Turns } from '../../engine/turns'

/** How players get their numbers. */
export type KillerAssign = 'random' | 'choose' | 'throw'

/** What a killer's hits take from the player whose number they hit. */
export type KillerMode = 'lives' | 'hits'

export type KillerOptions = {
  assign: KillerAssign
  mode: KillerMode
  /** Hits on your own number to become a killer. */
  hitsToKiller: number
  /** Lives each player starts with; only used in lives mode. */
  lives: number
  /** A killer who hits their own number loses a life (or hits). */
  selfHit: boolean
  /**
   * Each player's number when they are drawn at random, set by `prepare`
   * before the game starts. `null` when players choose or throw for them.
   */
  numbers: Record<PlayerId, number> | null
}

export type KillerPlayer = {
  /** 1–20, or `null` until chosen or thrown for. */
  number: number | null
  /** Hits on their own number, up to `hitsToKiller`. */
  hits: number
  lives: number
}

export function isKiller(options: KillerOptions, player: KillerPlayer) {
  return player.hits >= options.hitsToKiller
}

/** What keeps a player in: lives, or hits in hits mode. */
export function strength(options: KillerOptions, player: KillerPlayer) {
  return options.mode === 'lives' ? player.lives : player.hits
}

/**
 * Takes `amount` from a player who was hit. In lives mode they are out at
 * 0 lives; in hits mode a hit with no hits left to lose puts them out, so a
 * player at 0 hits is out after one hit.
 */
export function damage(
  options: KillerOptions,
  player: KillerPlayer,
  amount: number,
): { player: KillerPlayer; out: boolean } {
  if (options.mode === 'lives') {
    const lives = Math.max(0, player.lives - amount)
    return { player: { ...player, lives }, out: lives === 0 }
  }
  return {
    player: { ...player, hits: Math.max(0, player.hits - amount) },
    out: player.hits - amount < 0,
  }
}

/** Killer is played player against player, so each side is one player. */
export type KillerBoard = Record<PlayerId, KillerPlayer>

/** A turn so far, or the last one once it ends. */
export type KillerTurn = {
  playerId: PlayerId
  darts: Dart[]
  /** Per dart: hits gained on your own number (+) or taken (−); 0 for none. */
  effects: number[]
  /** Other players' numbers hit as a killer. */
  attacked: number[]
  /** Hit your own number as a killer, with self-hit on. */
  selfHit: boolean
  becameKiller: boolean
  /** Players put out this turn, the thrower included. */
  knockouts: PlayerId[]
}

export type KillerResult =
  'knockout' | 'killer' | 'attack' | 'selfHit' | 'progress' | 'missed'

/** A dart thrown for a number before the game. */
export type KillerClaim = {
  playerId: PlayerId
  dart: Dart
  result: 'claimed' | 'taken' | 'missed'
}

/** The player still to choose or throw for a number, in throwing order. */
export function claiming(turns: Turns<KillerBoard>): PlayerId | null {
  const { sides, board } = turns
  return sides.find((side) => board[side.id].number === null)?.id ?? null
}

/** The most notable thing that happened in a turn. */
export function turnResult(turn: KillerTurn): KillerResult {
  if (turn.knockouts.length > 0) return 'knockout'
  if (turn.becameKiller) return 'killer'
  if (turn.attacked.length > 0) return 'attack'
  if (turn.selfHit) return 'selfHit'
  if (turn.effects.some((effect) => effect > 0)) return 'progress'
  return 'missed'
}
