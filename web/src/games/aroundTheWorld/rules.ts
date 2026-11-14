// Kept apart from aroundTheWorld.ts so its components can use these
// without an import cycle.
import { BULL, fits, isMiss, type Dart } from '../../engine/dart'

export type AtwRule = 'single' | 'double'

export type AtwOptions = {
  /** What the first target must be hit with to start. */
  in: AtwRule
  /** What the last target must be hit with to finish. */
  out: AtwRule
  /** Finish on the bull after 20; with double out, the bullseye. */
  bull: boolean
  /** A dart that doesn't count ends the turn at once. */
  missEndsTurn: boolean
  /** Keep playing after the first finish until one side is left. */
  playOn: boolean
}

export type AtwProgress = {
  /** Index into the targets of the one to hit next. */
  target: number
  /** Whether the first target has been hit under the in rule. */
  opened: boolean
}

/** 1 to 20, then the bull when the game finishes on it. */
export function targets(options: AtwOptions): number[] {
  const numbers = Array.from({ length: 20 }, (_, index) => index + 1)
  return options.bull ? [...numbers, BULL] : numbers
}

/** What has to be hit at a target, e.g. `D1` with double in. */
export function needs(
  options: AtwOptions,
  progress: AtwProgress,
): 'single' | 'double' {
  const last = targets(options).length - 1
  if (!progress.opened && options.in === 'double') return 'double'
  if (progress.target === last && options.out === 'double') return 'double'
  return 'single'
}

/**
 * How many targets a dart moves a side on: 0 unless it hits the target
 * under the rule that applies there, otherwise its multiplier (a double
 * skips one target, a treble two). It never skips past the last target,
 * which has to be hit to finish.
 */
export function steps(
  options: AtwOptions,
  progress: AtwProgress,
  dart: Dart,
): number {
  const target = targets(options)[progress.target]
  if (isMiss(dart) || dart.segment !== target) return 0
  if (!fits(dart, needs(options, progress))) return 0
  return dart.multiplier
}
