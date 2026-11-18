import { BULL, MISS, dart, type Dart, type Multiplier } from './dart'
import type { PlayerId, ThrownDart } from './game'

/** How well a computer player throws. */
export type ComputerLevel = 'easy' | 'medium' | 'hard'

export const computerLevels: readonly ComputerLevel[] = [
  'easy',
  'medium',
  'hard',
]

/*
 * A computer is a game slot, not a saved player, so everything about it is
 * in its id: `computer-hard-2` is the second hard computer in a game. The
 * id is all the API keeps of a slot, and all the stats see of a player.
 * Head to head counts each level as one opponent, `computer-hard`, so
 * games against it add up however many were in a game.
 */
const prefix = 'computer-'
const idPattern = /^computer-(easy|medium|hard)(?:-([1-9]\d*))?$/

export function computerId(level: ComputerLevel, number: number): PlayerId {
  return `${prefix}${level}-${number}`
}

/** The computer's level and number from its id; `null` for a person. */
export function parseComputer(
  playerId: PlayerId,
): { level: ComputerLevel; number: number } | null {
  const match = idPattern.exec(playerId)
  return match
    ? { level: match[1] as ComputerLevel, number: Number(match[2] ?? 1) }
    : null
}

/** The level's one id across games, for head to head: `computer-hard`. */
export function computerRivalId(level: ComputerLevel): PlayerId {
  return `${prefix}${level}`
}

/**
 * Who a player is in head to head: a person by their id, a computer by its
 * level, so "Anna against the hard computer" adds up over games.
 */
export function rivalId(playerId: PlayerId): PlayerId {
  const computer = parseComputer(playerId)
  return computer ? computerRivalId(computer.level) : playerId
}

export function isComputer(playerId: PlayerId): boolean {
  return parseComputer(playerId) !== null
}

/** The id for one more computer of a level, after those already in. */
export function nextComputerId(
  level: ComputerLevel,
  playerIds: readonly PlayerId[],
): PlayerId {
  const taken = new Set(
    playerIds.flatMap((id) => {
      const computer = parseComputer(id)
      return computer?.level === level ? [computer.number] : []
    }),
  )
  let number = 1
  while (taken.has(number)) number++
  return computerId(level, number)
}

/*
 * The board model, in millimetres from the centre of a standard board.
 * Angles run clockwise from straight up, where the 20 is.
 */
const BULLSEYE = 6.35
const OUTER_BULL = 15.9
const TREBLE_INNER = 99
const TREBLE_OUTER = 107
const DOUBLE_INNER = 162
const DOUBLE_OUTER = 170

/** The numbers clockwise from the top. */
export const boardOrder: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
]
const SEGMENT = (2 * Math.PI) / boardOrder.length

export type Point = { x: number; y: number }

/**
 * How far each level's darts land from where it aims: the standard
 * deviation of each axis, in millimetres. A hard computer hits a treble
 * about a third of the time, a medium one about one in ten, and an easy
 * one rarely, often landing on the neighbours or off the board.
 */
export const spread: Record<ComputerLevel, number> = {
  easy: 38,
  medium: 18,
  hard: 9,
}

/** Where to aim for a dart: the middle of its bed. */
export function aimPoint(target: Dart): Point {
  if (target.segment === BULL || target.segment === 0) return { x: 0, y: 0 }
  const radius = {
    1: (TREBLE_OUTER + DOUBLE_INNER) / 2,
    2: (DOUBLE_INNER + DOUBLE_OUTER) / 2,
    3: (TREBLE_INNER + TREBLE_OUTER) / 2,
  }[target.multiplier as 1 | 2 | 3]
  const angle = boardOrder.indexOf(target.segment) * SEGMENT
  return { x: radius * Math.sin(angle), y: radius * Math.cos(angle) }
}

/** The dart that lands at a point; off the board is a miss. */
export function dartAt({ x, y }: Point): Dart {
  const radius = Math.hypot(x, y)
  if (radius <= BULLSEYE) return dart(BULL, 2)
  if (radius <= OUTER_BULL) return dart(BULL, 1)
  if (radius > DOUBLE_OUTER) return MISS
  // Each segment is centred on its angle, so shift by half a segment.
  const angle = (Math.atan2(x, y) + 2 * Math.PI + SEGMENT / 2) % (2 * Math.PI)
  const segment = boardOrder[Math.floor(angle / SEGMENT) % boardOrder.length]
  let multiplier: Multiplier = 1
  if (radius >= DOUBLE_INNER) multiplier = 2
  else if (radius >= TREBLE_INNER && radius <= TREBLE_OUTER) multiplier = 3
  return dart(segment, multiplier)
}

/** A normally distributed number (Box–Muller), from a uniform `random`. */
function gaussian(random: () => number): number {
  // 1 - random() is in (0, 1], so the logarithm is finite.
  const u = 1 - random()
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Throws at a target: lands somewhere around it, as far off as the level's
 * spread, and gives the dart there. `random` works like `Math.random`; it
 * is only used here, so the dart log stays the whole story of a game.
 */
export function throwAt(
  target: Dart,
  level: ComputerLevel,
  random: () => number = Math.random,
): Dart {
  const aim = aimPoint(target)
  const sigma = spread[level]
  return dartAt({
    x: aim.x + sigma * gaussian(random),
    y: aim.y + sigma * gaussian(random),
  })
}

/**
 * How many darts undo takes back: the computers' darts since the last
 * person's dart, then that dart, so it is that person's go again. 0 when
 * no person has thrown.
 */
export function undoCount(darts: readonly ThrownDart[]): number {
  for (let index = darts.length - 1; index >= 0; index--) {
    if (!isComputer(darts[index].playerId)) return darts.length - index
  }
  return 0
}
