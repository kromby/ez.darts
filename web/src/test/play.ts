import { BULL, MISS, dart, type Dart } from '../engine/dart'
import type { GameModule, PlayerSlot } from '../engine/game'

/** `T20`, `D16`, `S5`, `D25` (bullseye) or `M` for a miss. */
export function d(notation: string): Dart {
  if (notation === 'M') return MISS
  const multiplier = { S: 1, D: 2, T: 3 }[notation[0]] as 1 | 2 | 3
  const segment = Number(notation.slice(1))
  return dart(segment === 25 ? BULL : segment, multiplier)
}

/** The state after the darts, thrown in order from the start. */
export function stateAfter<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  options: TOptions,
  slots: readonly PlayerSlot[],
  darts: readonly string[] = [],
): TState {
  return darts.reduce(
    (state, notation) => module.applyDart(state, d(notation)),
    module.init(options, slots),
  )
}
