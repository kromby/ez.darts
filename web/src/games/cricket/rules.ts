// Kept apart from cricket.ts so its components can use these without an
// import cycle.
import { BULL, type Dart } from '../../engine/dart'
import type { PlayerId } from '../../engine/game'
import type { SideId } from '../../engine/turns'

/**
 * How extra marks count: for the thrower (`standard`), for every opponent
 * still open on the number, lowest score winning (`cutThroat`), or not at
 * all (`noScore`).
 */
export type CricketVariant = 'standard' | 'cutThroat' | 'noScore'

export type CricketOptions = {
  variant: CricketVariant
}

/** 20 down to 15, then the bull, as on a cricket scoreboard. */
export const TARGETS: readonly number[] = [20, 19, 18, 17, 16, 15, BULL]

/** Three marks close a number. */
export const CLOSED = 3

export type CricketSide = {
  /** Marks per target, up to 3 (closed). */
  marks: Record<number, number>
  score: number
}

/** A team, or one player when not playing in teams. */
export type CricketBoard = Record<SideId, CricketSide>

/** What one dart did. */
export type CricketHit = {
  dart: Dart
  /** Marks that counted: towards closing, or scoring. */
  marks: number
  /** Points it scored: for the thrower, or given to opponents. */
  points: number
}

/** A turn so far, or the last one once it ends. */
export type CricketTurn = {
  sideId: SideId
  playerId: PlayerId
  hits: CricketHit[]
  /** Targets the side closed this turn. */
  closed: number[]
  won: boolean
}

export type CricketResult = 'won' | 'scored' | 'marked' | 'missed'

/** How many marks a dart is worth on a target; 0 off the targets. */
export function marksOf(dart: Dart): number {
  return TARGETS.includes(dart.segment) ? dart.multiplier : 0
}

export function isClosed(side: CricketSide, target: number): boolean {
  return (side.marks[target] ?? 0) >= CLOSED
}

export function closedAll(side: CricketSide): boolean {
  return TARGETS.every((target) => isClosed(side, target))
}

/** Closed by every side: no more points on it. */
export function isDead(board: CricketBoard, target: number): boolean {
  return Object.values(board).every((side) => isClosed(side, target))
}

/** Marks towards closing, counted across every target (21 at most). */
export function closingMarks(side: CricketSide): number {
  return TARGETS.reduce(
    (total, target) => total + Math.min(CLOSED, side.marks[target] ?? 0),
    0,
  )
}

/**
 * Whether a side wins: every number closed, and level or ahead on points;
 * in cut-throat level or behind, and with no score just closed.
 */
export function wins(
  options: CricketOptions,
  board: CricketBoard,
  sideId: SideId,
): boolean {
  const side = board[sideId]
  if (!closedAll(side)) return false
  const others = Object.entries(board)
    .filter(([id]) => id !== sideId)
    .map(([, other]) => other.score)
  switch (options.variant) {
    case 'standard':
      return others.every((score) => side.score >= score)
    case 'cutThroat':
      return others.every((score) => side.score <= score)
    case 'noScore':
      return true
  }
}

/** The most notable thing that happened in a turn. */
export function turnResult(turn: CricketTurn): CricketResult {
  if (turn.won) return 'won'
  if (turn.hits.some((hit) => hit.points > 0)) return 'scored'
  if (turn.hits.some((hit) => hit.marks > 0)) return 'marked'
  return 'missed'
}

/** The turn's marks and points added up. */
export function turnTotals(turn: CricketTurn): {
  marks: number
  points: number
} {
  return turn.hits.reduce(
    (total, hit) => ({
      marks: total.marks + hit.marks,
      points: total.points + hit.points,
    }),
    { marks: 0, points: 0 },
  )
}

/** Marks per round of three darts, or `null` before the first dart. */
export function marksPerRound(stats: {
  darts: number
  marks: number
}): number | null {
  return stats.darts > 0 ? (stats.marks / stats.darts) * 3 : null
}

/** Marks as on a cricket scoreboard: `/`, `X`, then `Ⓧ` once closed. */
export function markSymbol(marks: number): string {
  return ['', '/', 'X', 'Ⓧ'][Math.min(CLOSED, marks)]
}
