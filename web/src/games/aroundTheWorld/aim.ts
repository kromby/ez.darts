import { dart, type Dart } from '../../engine/dart'
import { currentSide } from '../../engine/turns'
import type { AtwState } from './aroundTheWorld'
import { needs, targets } from './rules'

/**
 * Where a computer aims in Around the World: the side's next number, as a
 * double when that is what it needs there.
 */
export function atwAim(state: AtwState): Dart {
  const { turns, options } = state
  const progress = turns.board[currentSide(turns).id]
  const target = targets(options)[progress.target]
  return dart(target, needs(options, progress) === 'double' ? 2 : 1)
}
