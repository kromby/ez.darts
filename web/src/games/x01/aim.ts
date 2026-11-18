import { dart, type Dart } from '../../engine/dart'
import { currentSide } from '../../engine/turns'
import { checkouts, x01Checkout } from './checkout'
import type { X01State } from './x01'

const T20 = dart(20, 3)

/**
 * Where a computer aims in x01: the first dart of a checkout it can finish
 * this turn, else the first dart of the best three-dart finish to set one
 * up, else T20. Before it is in with double or master in, D20 or T20.
 */
export function x01Aim(state: X01State): Dart {
  const { turns, options } = state
  const score = turns.board[currentSide(turns).id]
  if (!score.opened) return options.in === 'double' ? dart(20, 2) : T20
  const now = x01Checkout(state)?.best
  const later = checkouts(score.remaining, 3, options.out)[0]
  return (now ?? later)?.[0] ?? T20
}
