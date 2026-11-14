/** 0 = miss, 1–20 = board segments, 25 = bull. */
export type Multiplier = 0 | 1 | 2 | 3

export type Dart = {
  segment: number
  multiplier: Multiplier
}

/** Which darts may open or finish a leg. */
export type FitRule = 'single' | 'double' | 'master'

export const BULL = 25

export const MISS: Dart = Object.freeze({ segment: 0, multiplier: 0 })

/**
 * Treats a dart as missed when either part is 0. `MISS` is the one valid
 * form; the check is lenient so a stray `{ segment: 20, multiplier: 0 }`
 * never scores.
 */
export function isMiss(dart: Dart): boolean {
  return dart.segment === 0 || dart.multiplier === 0
}

/** Outer bull scores 25 and the bullseye (double bull) scores 50. */
export function points(dart: Dart): number {
  return isMiss(dart) ? 0 : dart.segment * dart.multiplier
}

export function isDouble(dart: Dart): boolean {
  return !isMiss(dart) && dart.multiplier === 2
}

export function isTriple(dart: Dart): boolean {
  return !isMiss(dart) && dart.multiplier === 3
}

export function isBull(dart: Dart): boolean {
  return !isMiss(dart) && dart.segment === BULL
}

/**
 * Whether a dart may open or finish a leg under a rule: `single` takes any
 * scoring dart, `double` a double (bullseye included), `master` a double or
 * a triple. A miss never fits.
 */
export function fits(dart: Dart, rule: FitRule): boolean {
  if (isMiss(dart)) return false
  switch (rule) {
    case 'single':
      return true
    case 'double':
      return isDouble(dart)
    case 'master':
      return isDouble(dart) || isTriple(dart)
  }
}

/** True for a dart that can land on a board. There is no triple bull. */
export function isValidDart(dart: Dart): boolean {
  const { segment, multiplier } = dart
  if (segment === 0 || multiplier === 0) {
    return segment === 0 && multiplier === 0
  }
  if (segment === BULL) return multiplier === 1 || multiplier === 2
  return (
    Number.isInteger(segment) &&
    segment >= 1 &&
    segment <= 20 &&
    (multiplier === 1 || multiplier === 2 || multiplier === 3)
  )
}

/** Builds a dart, throwing a RangeError for one that cannot be thrown. */
export function dart(segment: number, multiplier: Multiplier): Dart {
  const result = { segment, multiplier }
  if (!isValidDart(result)) {
    throw new RangeError(`Invalid dart: segment ${segment} × ${multiplier}`)
  }
  return result
}

const prefixes = { 1: 'S', 2: 'D', 3: 'T' } as const

/** Board notation such as `T20`, `D16`, `S5` or `D25` (bullseye); `null` for a miss. */
export function notation(dart: Dart): string | null {
  if (isMiss(dart)) return null
  return `${prefixes[dart.multiplier as 1 | 2 | 3]}${dart.segment}`
}
