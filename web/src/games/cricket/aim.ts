import { BULL, dart, type Dart } from '../../engine/dart'
import { currentSide } from '../../engine/turns'
import type { CricketState } from './cricket'
import { TARGETS, isClosed } from './rules'

/** The treble of a number; the bullseye for the bull. */
const best = (target: number): Dart =>
  target === BULL ? dart(BULL, 2) : dart(target, 3)

/**
 * Where a computer aims in Cricket. Behind on points with a number to
 * score on (closed by it, open for an opponent), it scores there;
 * otherwise it closes its highest open number. In cut-throat, behind means
 * more points, and scoring gives them to the others.
 */
export function cricketAim(state: CricketState): Dart {
  const { turns, options } = state
  const { board } = turns
  const sideId = currentSide(turns).id
  const mine = board[sideId]
  const others = Object.entries(board).filter(([id]) => id !== sideId)
  const open = TARGETS.filter((target) => !isClosed(mine, target))
  const scoring = TARGETS.filter(
    (target) =>
      isClosed(mine, target) &&
      others.some(([, other]) => !isClosed(other, target)),
  )
  const behind = others.some(([, other]) =>
    options.variant === 'cutThroat'
      ? other.score < mine.score
      : other.score > mine.score,
  )
  const keepsScore = options.variant !== 'noScore'
  if (keepsScore && behind && scoring.length > 0) return best(scoring[0])
  return best(open[0] ?? scoring[0] ?? 20)
}
