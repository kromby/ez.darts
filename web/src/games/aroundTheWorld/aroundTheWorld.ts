import { isValidDart, type Dart } from '../../engine/dart'
import type { OptionValues } from '../../engine/config'
import type { GameModule, PlayerId, PlayerSlot } from '../../engine/game'
import {
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
import {
  steps,
  targets,
  type AtwOptions,
  type AtwProgress,
  type AtwRule,
} from './rules'
import Scoreboard from './Scoreboard'
import Status from './Status'

export {
  needs,
  steps,
  targets,
  type AtwOptions,
  type AtwProgress,
  type AtwRule,
} from './rules'

export type AtwBoard = Record<SideId, AtwProgress>

export type AtwTurn = {
  sideId: SideId
  playerId: PlayerId
  darts: Dart[]
  /** Target indexes at the start and end of the turn. */
  from: number
  to: number
  result: 'advanced' | 'missed' | 'finished'
}

export type AtwStats = { darts: number; hits: number }

export type AtwState = {
  options: AtwOptions
  turns: Turns<AtwBoard>
  turnDarts: Dart[]
  /** Targets each dart of the turn moved on: 0 for a miss. */
  turnSteps: number[]
  lastTurn: AtwTurn | null
  stats: Record<PlayerId, AtwStats>
}

const rules: readonly AtwRule[] = ['single', 'double']

function isRule(value: unknown): value is AtwRule {
  return rules.includes(value as AtwRule)
}

/** Reads the options from the setup screen's values. */
export function toAtwOptions(values: OptionValues): AtwOptions {
  if (!isRule(values.in) || !isRule(values.out)) {
    throw new RangeError('Invalid Around the World in/out rule')
  }
  return {
    in: values.in,
    out: values.out,
    bull: values.bull === true,
    missEndsTurn: values.missEndsTurn === true,
    playOn: values.playOn === true,
  }
}

function init(options: AtwOptions, slots: readonly PlayerSlot[]): AtwState {
  const sides = sidesFromSlots(slots)
  const board: AtwBoard = Object.fromEntries(
    sides.map((side) => [
      side.id,
      { target: 0, opened: options.in === 'single' },
    ]),
  )
  return {
    options,
    turns: startTurns(sides, board),
    turnDarts: [],
    turnSteps: [],
    lastTurn: null,
    stats: Object.fromEntries(
      slots.map((slot) => [slot.playerId, { darts: 0, hits: 0 }]),
    ),
  }
}

function applyDart(state: AtwState, dart: Dart): AtwState {
  if (!isValidDart(dart)) throw new RangeError('Invalid dart')
  if (isOver(state)) return state

  const { turns, options } = state
  const side = currentSide(turns)
  const playerId = currentThrower(turns)
  const progress = turns.board[side.id]
  const last = targets(options).length - 1
  const moved = steps(options, progress, dart)
  const finished = moved > 0 && progress.target === last
  const next: AtwProgress = {
    target: Math.min(progress.target + moved, last),
    opened: progress.opened || moved > 0,
  }
  const board = { ...turns.board, [side.id]: next }
  const turnDarts = [...state.turnDarts, dart]
  const player = state.stats[playerId]
  const stats = {
    ...state.stats,
    [playerId]: {
      darts: player.darts + 1,
      hits: player.hits + (moved > 0 ? 1 : 0),
    },
  }
  const from = turns.turnStart[side.id].target
  const lastTurn = (result: AtwTurn['result']): AtwTurn => ({
    sideId: side.id,
    playerId,
    darts: turnDarts,
    from,
    to: next.target,
    result,
  })

  if (finished) {
    return {
      ...state,
      turns: endTurn(finish({ ...turns, board }, side.id)),
      turnDarts: [],
      turnSteps: [],
      lastTurn: lastTurn('finished'),
      stats,
    }
  }

  const after =
    moved === 0 && options.missEndsTurn
      ? endTurn({ ...turns, board })
      : countDart(turns, board)
  const turnEnded = after.dartsThrown === 0
  return {
    ...state,
    turns: after,
    turnDarts: turnEnded ? [] : turnDarts,
    turnSteps: turnEnded ? [] : [...state.turnSteps, moved],
    lastTurn: turnEnded
      ? lastTurn(next.target > from ? 'advanced' : 'missed')
      : state.lastTurn,
    stats,
  }
}

/**
 * Ends at the first finish, or with play-on once every side but one has
 * finished (a solo game ends when the player finishes).
 */
function isOver(state: AtwState): boolean {
  const { finished, sides } = state.turns
  const needed = state.options.playOn ? Math.max(1, sides.length - 1) : 1
  return finished.length >= needed
}

/** Finished sides first, then the rest by how far round they got. */
function standings(state: AtwState): PlayerId[] {
  const { sides, finished, board } = state.turns
  const order = [
    ...finished.flatMap((id) => sides.filter((side) => side.id === id)),
    ...sides
      .filter((side) => !finished.includes(side.id))
      .sort((a, b) => board[b.id].target - board[a.id].target),
  ]
  return order.flatMap((side) => side.members)
}

export const aroundTheWorld: GameModule<AtwOptions, AtwState> = {
  id: 'around-the-world',
  toOptions: toAtwOptions,
  init,
  applyDart,
  isOver,
  currentThrower: (state) => currentThrower(state.turns),
  standings,
  Scoreboard,
  Status,
  PlayerSummary,
}
