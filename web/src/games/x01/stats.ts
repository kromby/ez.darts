// Kept apart from x01.ts so its components can use it without an import cycle.

/** A player's running numbers; busted turns count darts but no points. */
export type X01Stats = {
  darts: number
  /** Points scored, for the 3-dart average. */
  scored: number
  /** Highest total of a turn that did not bust. */
  bestTurn: number
  /** The score the player checked out from, once they have. */
  checkout: number | null
}

/** 3-dart average, or `null` before the first dart. */
export function average(stats: X01Stats): number | null {
  return stats.darts > 0 ? (stats.scored / stats.darts) * 3 : null
}
