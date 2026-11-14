import type { OptionValues } from '../../engine/config'
import { BULL, isMiss, isValidDart, type Dart } from '../../engine/dart'
import type { GameModule, PlayerId, PlayerSlot } from '../../engine/game'
import {
  activeSides,
  countDart,
  currentThrower,
  eliminate,
  endTurn,
  isActive,
  sidesFromSlots,
  startTurns,
  type Turns,
} from '../../engine/turns'
import PlayerSummary from './PlayerSummary'
import {
  damage,
  isKiller,
  strength,
  claiming,
  type KillerAssign,
  type KillerBoard,
  type KillerClaim,
  type KillerMode,
  type KillerOptions,
  type KillerTurn,
} from './rules'
import Scoreboard from './Scoreboard'
import Status from './Status'

export {
  claiming,
  isKiller,
  strength,
  turnResult,
  type KillerAssign,
  type KillerBoard,
  type KillerClaim,
  type KillerMode,
  type KillerOptions,
  type KillerPlayer,
  type KillerResult,
  type KillerTurn,
} from './rules'

export type KillerStats = {
  /** Darts in the game itself, not those thrown for a number. */
  darts: number
  /** Lives or hits taken from other players. */
  taken: number
  knockouts: number
}

export type KillerState = {
  options: KillerOptions
  turns: Turns<KillerBoard>
  /** The turn in progress; `null` before its first dart. */
  turn: KillerTurn | null
  lastTurn: KillerTurn | null
  lastClaim: KillerClaim | null
  stats: Record<PlayerId, KillerStats>
}

const assignModes: readonly KillerAssign[] = ['random', 'choose', 'throw']
const modes: readonly KillerMode[] = ['lives', 'hits']

function readCount(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new RangeError(`Killer ${name} must be a whole number from 1`)
  }
  return value
}

/** Reads the options from the setup screen's values. */
export function toKillerOptions(values: OptionValues): KillerOptions {
  const { assign, mode } = values
  if (!assignModes.includes(assign as KillerAssign)) {
    throw new RangeError('Invalid Killer number assignment')
  }
  if (!modes.includes(mode as KillerMode)) {
    throw new RangeError('Invalid Killer mode')
  }
  return {
    assign: assign as KillerAssign,
    mode: mode as KillerMode,
    hitsToKiller: readCount(values.hitsToKiller, 'hits to become a killer'),
    lives: readCount(values.lives, 'lives'),
    selfHit: values.selfHit === true,
    numbers: null,
  }
}

const boardNumbers = Array.from({ length: 20 }, (_, index) => index + 1)

/** Draws a different number for each player when they are random. */
function prepare(
  options: KillerOptions,
  slots: readonly PlayerSlot[],
  random: () => number,
): KillerOptions {
  if (options.assign !== 'random') return { ...options, numbers: null }
  const pool = [...boardNumbers]
  const numbers: Record<PlayerId, number> = {}
  for (const slot of slots) {
    const [number] = pool.splice(Math.floor(random() * pool.length), 1)
    numbers[slot.playerId] = number
  }
  return { ...options, numbers }
}

function init(
  options: KillerOptions,
  slots: readonly PlayerSlot[],
): KillerState {
  if (slots.length > boardNumbers.length) {
    throw new RangeError('Killer has a number for at most 20 players')
  }
  const { numbers } = options
  if (options.assign === 'random') {
    const drawn = slots.map((slot) => numbers?.[slot.playerId])
    const valid = drawn.every(
      (number) => number !== undefined && boardNumbers.includes(number),
    )
    if (!valid || new Set(drawn).size !== drawn.length) {
      throw new RangeError('Draw Killer numbers with prepare() first')
    }
  }
  // Teams are not supported, so each player is their own side.
  const sides = sidesFromSlots(slots.map(({ playerId }) => ({ playerId })))
  const board: KillerBoard = Object.fromEntries(
    sides.map((side) => [
      side.id,
      {
        number:
          options.assign === 'random' ? (numbers?.[side.id] ?? null) : null,
        hits: 0,
        lives: options.lives,
      },
    ]),
  )
  return {
    options,
    turns: startTurns(sides, board),
    turn: null,
    lastTurn: null,
    lastClaim: null,
    stats: Object.fromEntries(
      sides.map((side) => [side.id, { darts: 0, taken: 0, knockouts: 0 }]),
    ),
  }
}

/**
 * A dart for a number: any number from 1 to 20 nobody has. A miss, the bull
 * or a number already taken means the same player goes again.
 */
function claim(state: KillerState, playerId: PlayerId, dart: Dart) {
  const { turns } = state
  const taken = Object.values(turns.board).some(
    (player) => player.number === dart.segment,
  )
  let result: KillerClaim['result'] = 'claimed'
  if (isMiss(dart) || dart.segment === BULL) result = 'missed'
  else if (taken) result = 'taken'
  const board =
    result === 'claimed'
      ? {
          ...turns.board,
          [playerId]: { ...turns.board[playerId], number: dart.segment },
        }
      : turns.board
  return {
    ...state,
    turns: { ...turns, board, turnStart: board },
    lastClaim: { playerId, dart, result },
  }
}

/** Whose number a dart landed on, if it is someone's. */
function owner(board: KillerBoard, dart: Dart): PlayerId | undefined {
  if (isMiss(dart)) return undefined
  return Object.keys(board).find((id) => board[id].number === dart.segment)
}

function applyDart(state: KillerState, dart: Dart): KillerState {
  if (!isValidDart(dart)) throw new RangeError('Invalid dart')
  if (isOver(state)) return state
  const claimer = claiming(state.turns)
  if (claimer !== null) return claim(state, claimer, dart)

  const { turns, options } = state
  const playerId = currentThrower(turns)
  const me = turns.board[playerId]
  const target = owner(turns.board, dart)
  const killer = isKiller(options, me)
  const multiplier = dart.multiplier
  const board = { ...turns.board }
  const turn: KillerTurn = state.turn ?? {
    playerId,
    darts: [],
    effects: [],
    attacked: [],
    selfHit: false,
    becameKiller: false,
    knockouts: [],
  }
  let effect = 0
  let knockout: PlayerId | null = null
  let { attacked, selfHit, becameKiller } = turn
  const stats = { ...state.stats[playerId] }

  if (target === playerId && !killer) {
    effect = Math.min(multiplier, options.hitsToKiller - me.hits)
    board[playerId] = { ...me, hits: me.hits + effect }
    becameKiller = becameKiller || isKiller(options, board[playerId])
  } else if (target === playerId && options.selfHit) {
    const hit = damage(options, me, multiplier)
    board[playerId] = hit.player
    effect = -multiplier
    selfHit = true
    if (hit.out) knockout = playerId
  } else if (
    target !== undefined &&
    target !== playerId &&
    killer &&
    isActive(turns, target)
  ) {
    const hit = damage(options, board[target], multiplier)
    board[target] = hit.player
    effect = -multiplier
    attacked = [...attacked, dart.segment]
    stats.taken += multiplier
    if (hit.out) {
      knockout = target
      stats.knockouts += 1
    }
  }
  stats.darts += 1

  const nextTurn: KillerTurn = {
    ...turn,
    darts: [...turn.darts, dart],
    effects: [...turn.effects, effect],
    attacked,
    selfHit,
    becameKiller,
    knockouts: knockout ? [...turn.knockouts, knockout] : turn.knockouts,
  }
  const next = {
    ...state,
    stats: { ...state.stats, [playerId]: stats },
  }
  let after: Turns<KillerBoard> = { ...turns, board }
  if (knockout) after = eliminate(after, knockout)

  if (isOver({ ...next, turns: after })) {
    return { ...next, turns: after, turn: null, lastTurn: nextTurn }
  }
  // Putting yourself out ends your turn at once.
  after = knockout === playerId ? endTurn(after) : countDart(after, board)
  const turnEnded = after.dartsThrown === 0
  return {
    ...next,
    turns: after,
    turn: turnEnded ? null : nextTurn,
    lastTurn: turnEnded ? nextTurn : state.lastTurn,
  }
}

/**
 * Over when one player is left standing. Alone, a player practises
 * becoming a killer, and the game ends when they are one.
 */
function isOver(state: KillerState): boolean {
  const { turns, options } = state
  if (turns.sides.length === 1) {
    return isKiller(options, turns.board[turns.sides[0].id])
  }
  return activeSides(turns).length <= 1
}

/** Players still in, strongest first, then the rest, last out first. */
function standings(state: KillerState): PlayerId[] {
  const { turns, options } = state
  const standing = activeSides(turns)
    .map((side) => side.id)
    .sort(
      (a, b) =>
        strength(options, turns.board[b]) - strength(options, turns.board[a]),
    )
  return [...standing, ...[...turns.eliminated].reverse()]
}

/**
 * For a killer, the numbers of everyone still in; for anyone else, their
 * own number. Nothing while numbers are being chosen.
 */
function hint(state: KillerState): string | null {
  if (isOver(state) || claiming(state.turns) !== null) return null
  const { turns, options } = state
  const playerId = currentThrower(turns)
  const me = turns.board[playerId]
  if (!isKiller(options, me)) return String(me.number)
  const targets = activeSides(turns)
    .filter((side) => side.id !== playerId)
    .map((side) => turns.board[side.id].number)
  return targets.join(' · ')
}

export const killer: GameModule<KillerOptions, KillerState> = {
  id: 'killer',
  toOptions: toKillerOptions,
  prepare,
  init,
  applyDart,
  isOver,
  currentThrower: (state) =>
    claiming(state.turns) ?? currentThrower(state.turns),
  standings,
  Scoreboard,
  Status,
  PlayerSummary,
  hint,
}
