import type { OptionValues } from '../../engine/config'
import { isValidDart, type Dart } from '../../engine/dart'
import type { GameModule, PlayerId, PlayerSlot } from '../../engine/game'
import {
  countDart,
  currentSide,
  currentThrower,
  finish,
  sidesFromSlots,
  startTurns,
  type SideId,
  type Turns,
} from '../../engine/turns'
import { cricketAim } from './aim'
import PlayerSummary from './PlayerSummary'
import {
  CLOSED,
  TARGETS,
  closingMarks,
  isClosed,
  marksOf,
  wins,
  type CricketBoard,
  type CricketOptions,
  type CricketSide,
  type CricketTurn,
  type CricketVariant,
} from './rules'
import Scoreboard from './Scoreboard'
import Status from './Status'

export {
  CLOSED,
  TARGETS,
  closedAll,
  closingMarks,
  isClosed,
  isDead,
  markSymbol,
  marksOf,
  marksPerRound,
  turnResult,
  turnTotals,
  wins,
  type CricketBoard,
  type CricketHit,
  type CricketOptions,
  type CricketResult,
  type CricketSide,
  type CricketTurn,
  type CricketVariant,
} from './rules'

export type CricketStats = {
  darts: number
  /** Marks that counted, for marks per round. */
  marks: number
  /** Points the player's darts scored (in cut-throat, given to others). */
  points: number
}

export type CricketState = {
  options: CricketOptions
  turns: Turns<CricketBoard>
  /** The turn in progress; `null` before its first dart. */
  turn: CricketTurn | null
  lastTurn: CricketTurn | null
  stats: Record<PlayerId, CricketStats>
}

const variants: readonly CricketVariant[] = ['standard', 'cutThroat', 'noScore']

/** Reads the options from the setup screen's values. */
export function toCricketOptions(values: OptionValues): CricketOptions {
  const { variant } = values
  if (!variants.includes(variant as CricketVariant)) {
    throw new RangeError(`Invalid Cricket variant: ${String(variant)}`)
  }
  return { variant: variant as CricketVariant }
}

const emptySide = (): CricketSide => ({
  marks: Object.fromEntries(TARGETS.map((target) => [target, 0])),
  score: 0,
})

function init(
  options: CricketOptions,
  slots: readonly PlayerSlot[],
): CricketState {
  const sides = sidesFromSlots(slots)
  const board: CricketBoard = Object.fromEntries(
    sides.map((side) => [side.id, emptySide()]),
  )
  return {
    options,
    turns: startTurns(sides, board),
    turn: null,
    lastTurn: null,
    stats: Object.fromEntries(
      slots.map((slot) => [slot.playerId, { darts: 0, marks: 0, points: 0 }]),
    ),
  }
}

/**
 * The board after a dart: marks towards closing the number first, then
 * the rest score its value while an opponent is still open on it.
 */
function mark(
  options: CricketOptions,
  board: CricketBoard,
  sideId: SideId,
  dart: Dart,
): { board: CricketBoard; marks: number; points: number; closed: boolean } {
  const hits = marksOf(dart)
  if (hits === 0) return { board, marks: 0, points: 0, closed: false }

  const target = dart.segment
  const mine = board[sideId]
  const had = mine.marks[target]
  const closing = Math.min(hits, CLOSED - Math.min(CLOSED, had))
  const open = Object.keys(board).filter(
    (id) => id !== sideId && !isClosed(board[id], target),
  )
  const scoring =
    options.variant !== 'noScore' && open.length > 0 ? hits - closing : 0
  const points = scoring * target

  const next: CricketBoard = {
    ...board,
    [sideId]: {
      marks: { ...mine.marks, [target]: had + closing },
      score: options.variant === 'standard' ? mine.score + points : mine.score,
    },
  }
  if (options.variant === 'cutThroat' && points > 0) {
    for (const id of open) {
      next[id] = { ...next[id], score: next[id].score + points }
    }
  }
  return {
    board: next,
    marks: closing + scoring,
    points,
    closed: had < CLOSED && had + closing >= CLOSED,
  }
}

function applyDart(state: CricketState, dart: Dart): CricketState {
  if (!isValidDart(dart)) throw new RangeError('Invalid dart')
  if (isOver(state)) return state

  const { turns, options } = state
  const side = currentSide(turns)
  const playerId = currentThrower(turns)
  const result = mark(options, turns.board, side.id, dart)
  const { board } = result

  const turn: CricketTurn = state.turn ?? {
    sideId: side.id,
    playerId,
    hits: [],
    closed: [],
    won: false,
  }
  const player = state.stats[playerId]
  const stats = {
    ...state.stats,
    [playerId]: {
      darts: player.darts + 1,
      marks: player.marks + result.marks,
      points: player.points + result.points,
    },
  }

  // The thrower first; in cut-throat their points can also let another
  // side that has closed everything win.
  const order = [side.id, ...turns.sides.map((other) => other.id)]
  const winner = order.find((id) => wins(options, board, id))
  const nextTurn: CricketTurn = {
    ...turn,
    hits: [...turn.hits, { dart, marks: result.marks, points: result.points }],
    closed: result.closed ? [...turn.closed, dart.segment] : turn.closed,
    won: winner === side.id,
  }

  if (winner !== undefined) {
    return {
      ...state,
      turns: finish({ ...turns, board }, winner),
      turn: null,
      lastTurn: nextTurn,
      stats,
    }
  }

  const after = countDart(turns, board)
  const turnEnded = after.dartsThrown === 0
  return {
    ...state,
    turns: after,
    turn: turnEnded ? null : nextTurn,
    lastTurn: turnEnded ? nextTurn : state.lastTurn,
    stats,
  }
}

/** Over as soon as a side wins; there are no places to play on for. */
function isOver(state: CricketState): boolean {
  return state.turns.finished.length > 0
}

/**
 * The winner, then the rest by score (lowest first in cut-throat), then by
 * how close they came to closing everything.
 */
function standings(state: CricketState): PlayerId[] {
  const { turns, options } = state
  const { board } = turns
  const direction = options.variant === 'cutThroat' ? 1 : -1
  const byScore = (a: SideId, b: SideId) =>
    options.variant === 'noScore'
      ? 0
      : direction * (board[a].score - board[b].score)
  const rest = turns.sides
    .map((side) => side.id)
    .filter((id) => !turns.finished.includes(id))
    .sort(
      (a, b) =>
        byScore(a, b) || closingMarks(board[b]) - closingMarks(board[a]),
    )
  const order = [...turns.finished, ...rest]
  return order.flatMap(
    (id) => turns.sides.find((side) => side.id === id)?.members ?? [],
  )
}

export const cricket: GameModule<CricketOptions, CricketState> = {
  id: 'cricket',
  toOptions: toCricketOptions,
  init,
  applyDart,
  isOver,
  currentThrower: (state) => currentThrower(state.turns),
  standings,
  Scoreboard,
  Status,
  PlayerSummary,
  points: (state, playerId) => state.stats[playerId]?.points ?? 0,
  aim: cricketAim,
}
