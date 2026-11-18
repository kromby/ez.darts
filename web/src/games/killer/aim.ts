import { dart, type Dart } from '../../engine/dart'
import { activeSides, currentThrower } from '../../engine/turns'
import type { KillerState } from './killer'
import { claiming, isKiller, strength } from './rules'

/** 20 down to 1. */
const numbers = Array.from({ length: 20 }, (_, index) => 20 - index)

/**
 * Where a computer aims in Killer. Before the game, the highest number
 * nobody has. Then the double of its own number until it is a killer, and
 * after that the double of the weakest player still in.
 */
export function killerAim(state: KillerState): Dart {
  const { turns, options } = state
  const { board } = turns
  const claimer = claiming(turns)
  if (claimer !== null) {
    const taken = new Set(Object.values(board).map((player) => player.number))
    const free = numbers.find((number) => !taken.has(number))
    return dart(free ?? 20, 1)
  }

  const playerId = currentThrower(turns)
  const me = board[playerId]
  const own = dart(me.number ?? 20, 2)
  if (!isKiller(options, me)) return own
  const weakest = activeSides(turns)
    .filter((side) => side.id !== playerId)
    .map((side) => board[side.id])
    .sort((a, b) => strength(options, a) - strength(options, b))[0]
  return weakest?.number ? dart(weakest.number, 2) : own
}
