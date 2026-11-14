import { BULL, dart, notation } from '../../engine/dart'
import { needs, targets, type AtwOptions, type AtwProgress } from './rules'

/** A target as shown: `7`, or the bull's name. */
export function targetLabel(
  options: AtwOptions,
  index: number,
  bullName: string,
): string {
  const target = targets(options)[index]
  return target === BULL ? bullName : String(target)
}

/** The dart a side must hit when only a double counts, e.g. `D1`. */
export function neededDart(
  options: AtwOptions,
  progress: AtwProgress,
): string | null {
  if (needs(options, progress) !== 'double') return null
  return notation(dart(targets(options)[progress.target], 2))
}

/** Hit rate as a whole percentage, or `null` before the first dart. */
export function hitRate(stats: { darts: number; hits: number }): number | null {
  return stats.darts > 0 ? Math.round((stats.hits / stats.darts) * 100) : null
}
