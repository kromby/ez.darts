import {
  fits,
  isValidDart,
  points,
  type Dart,
  type FitRule,
} from '../../engine/dart'
import type { OptionValues } from '../../engine/config'
import type { GameModule, PlayerId, PlayerSlot } from '../../engine/game'
import {
  bust,
  countDart,
  currentSide,
  currentThrower,
  endTurn,
  finish,
  sidesFromSlots,
  startTurns,
  type SideId,
  type Turns,
} from '../../engine/turns'
import PlayerSummary from './PlayerSummary'
import type { X01Stats } from './stats'
import Scoreboard from './Scoreboard'
import Status from './Status'

export type X01Options = {
  startScore: number
  in: FitRule
  out: FitRule
  /** Keep playing after the first checkout until only one side is left. */
  playOn: boolean
}

export type SideScore = {
  /** The side's start score: the game's, or a handicap. */
  start: number
  /** Points still needed to finish. */
  remaining: number
  /** Whether the side has met the "in" rule and scores. */
  opened: boolean
}

export type X01Board = Record<SideId, SideScore>

/** A finished turn, kept for feedback such as "Bust!". */
export type X01Turn = {
  sideId: SideId
  playerId: PlayerId
  darts: Dart[]
  /** Remaining at the start of the turn. */
  from: number
  result: 'scored' | 'bust' | 'finished'
}

export type X01State = {
  options: X01Options
  turns: Turns<X01Board>
  /** Darts thrown so far in the current turn. */
  turnDarts: Dart[]
  lastTurn: X01Turn | null
  stats: Record<PlayerId, X01Stats>
}

export { average, type X01Stats } from './stats'

const rules: readonly FitRule[] = ['single', 'double', 'master']

function isRule(value: unknown): value is FitRule {
  return rules.includes(value as FitRule)
}

/** Reads x01 options from the setup screen's values. */
export function toX01Options(values: OptionValues): X01Options {
  const { startScore } = values
  if (
    typeof startScore !== 'number' ||
    !Number.isInteger(startScore) ||
    startScore < 2
  ) {
    throw new RangeError(`Invalid x01 start score: ${String(startScore)}`)
  }
  if (!isRule(values.in) || !isRule(values.out)) {
    throw new RangeError('Invalid x01 in/out rule')
  }
  // Missing in games saved before the option existed: end at the first checkout.
  return {
    startScore,
    in: values.in,
    out: values.out,
    playOn: values.playOn === true,
  }
}

function handicap(slot: PlayerSlot): number | null {
  const value = slot.options?.startScore
  return typeof value === 'number' && Number.isInteger(value) && value >= 2
    ? value
    : null
}

function init(options: X01Options, slots: readonly PlayerSlot[]): X01State {
  const sides = sidesFromSlots(slots)
  const board: X01Board = Object.fromEntries(
    sides.map((side) => {
      // A team takes the first handicap set by one of its members.
      const start =
        slots
          .filter((slot) => side.members.includes(slot.playerId))
          .map(handicap)
          .find((value) => value !== null) ?? options.startScore
      const score: SideScore = {
        start,
        remaining: start,
        opened: options.in === 'single',
      }
      return [side.id, score]
    }),
  )
  return {
    options,
    turns: startTurns(sides, board),
    turnDarts: [],
    lastTurn: null,
    stats: Object.fromEntries(
      slots.map((slot) => [
        slot.playerId,
        { darts: 0, scored: 0, bestTurn: 0, checkout: null },
      ]),
    ),
  }
}

/**
 * Busts when the dart takes the side below 0, leaves 1 when the out rule
 * needs a double or triple, or reaches 0 with a dart that does not fit the
 * out rule.
 */
function isBust(remaining: number, dart: Dart, out: FitRule): boolean {
  return (
    remaining < 0 ||
    (remaining === 1 && out !== 'single') ||
    (remaining === 0 && !fits(dart, out))
  )
}

function applyDart(state: X01State, dart: Dart): X01State {
  if (!isValidDart(dart)) throw new RangeError('Invalid dart')
  if (isOver(state)) return state

  const { turns, options } = state
  const side = currentSide(turns)
  const playerId = currentThrower(turns)
  const score = turns.board[side.id]
  const turnStart = turns.turnStart[side.id]
  const turnDarts = [...state.turnDarts, dart]
  const opened = score.opened || fits(dart, options.in)
  const remaining = opened ? score.remaining - points(dart) : score.remaining
  const lastTurn = (result: X01Turn['result']): X01Turn => ({
    sideId: side.id,
    playerId,
    darts: turnDarts,
    from: turnStart.remaining,
    result,
  })
  const player = state.stats[playerId]
  const stats = (next: Partial<X01Stats>) => ({
    ...state.stats,
    [playerId]: { ...player, darts: player.darts + 1, ...next },
  })

  if (isBust(remaining, dart, options.out)) {
    return {
      ...state,
      turns: bust(turns),
      turnDarts: [],
      lastTurn: lastTurn('bust'),
      // Take back the points from the turn's earlier darts.
      stats: stats({
        scored: player.scored - (turnStart.remaining - score.remaining),
      }),
    }
  }

  const board = { ...turns.board, [side.id]: { ...score, remaining, opened } }
  const scored = player.scored + (score.remaining - remaining)
  const turnTotal = turnStart.remaining - remaining

  if (remaining === 0) {
    return {
      ...state,
      turns: endTurn(finish({ ...turns, board }, side.id)),
      turnDarts: [],
      lastTurn: lastTurn('finished'),
      stats: stats({
        scored,
        bestTurn: Math.max(player.bestTurn, turnTotal),
        checkout: turnStart.remaining,
      }),
    }
  }

  const next = countDart(turns, board)
  const turnEnded = next.dartsThrown === 0
  return {
    ...state,
    turns: next,
    turnDarts: turnEnded ? [] : turnDarts,
    lastTurn: turnEnded ? lastTurn('scored') : state.lastTurn,
    stats: stats({
      scored,
      bestTurn: turnEnded
        ? Math.max(player.bestTurn, turnTotal)
        : player.bestTurn,
    }),
  }
}

/**
 * Ends at the first checkout, or with play-on once every side but one has
 * checked out (a solo game ends when the player checks out).
 */
function isOver(state: X01State): boolean {
  const { finished, sides } = state.turns
  const needed = state.options.playOn ? Math.max(1, sides.length - 1) : 1
  return finished.length >= needed
}

/** Finished sides first, then the rest by fewest points left. */
function standings(state: X01State): PlayerId[] {
  const { sides, finished, board } = state.turns
  const order = [
    ...finished.flatMap((id) => sides.filter((side) => side.id === id)),
    ...sides
      .filter((side) => !finished.includes(side.id))
      .sort((a, b) => board[a.id].remaining - board[b.id].remaining),
  ]
  return order.flatMap((side) => side.members)
}

export const x01: GameModule<X01Options, X01State> = {
  id: 'x01',
  toOptions: toX01Options,
  init,
  applyDart,
  isOver,
  currentThrower: (state) => currentThrower(state.turns),
  standings,
  Scoreboard,
  Status,
  PlayerSummary,
}
