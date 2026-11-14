import type { PlayerId, PlayerSlot, TeamId } from './game'

/** A team, or a single player when not playing in teams. */
export type SideId = TeamId | PlayerId

/** Who shares a score: one player, or the members of a team. */
export type Side = {
  id: SideId
  /** Throwing order within the side. */
  members: PlayerId[]
}

/**
 * Shared turn state for a game. `board` is the game's own per-side data
 * (scores, lives …); `turnStart` is a copy of it from the start of the
 * current turn, so a game can bust back to it.
 */
export type Turns<TBoard> = {
  sides: Side[]
  /** Index into `sides` of the side throwing now. */
  current: number
  /** Turns each side has finished, used to rotate its members. */
  turnsTaken: number[]
  dartsPerTurn: number
  /** Darts thrown so far in the current turn. */
  dartsThrown: number
  /** Sides that have finished, in finishing order. */
  finished: SideId[]
  /** Sides knocked out, in the order they went out. */
  eliminated: SideId[]
  board: TBoard
  turnStart: TBoard
}

export type TurnOptions = {
  /** Defaults to 3. */
  dartsPerTurn?: number
}

/**
 * Groups slots into sides. Teams keep the order their first member appears
 * in; players without a team are a side of their own.
 */
export function sidesFromSlots(slots: readonly PlayerSlot[]): Side[] {
  const sides: Side[] = []
  for (const slot of slots) {
    const id = slot.teamId ?? slot.playerId
    const side = sides.find((s) => s.id === id)
    if (side) side.members.push(slot.playerId)
    else sides.push({ id, members: [slot.playerId] })
  }
  return sides
}

export function startTurns<TBoard>(
  sides: readonly Side[],
  board: TBoard,
  { dartsPerTurn = 3 }: TurnOptions = {},
): Turns<TBoard> {
  if (sides.length === 0) throw new RangeError('A game needs at least one side')
  return {
    sides: sides.map((side) => ({ ...side, members: [...side.members] })),
    current: 0,
    turnsTaken: sides.map(() => 0),
    dartsPerTurn,
    dartsThrown: 0,
    finished: [],
    eliminated: [],
    board,
    turnStart: board,
  }
}

export function currentSide<TBoard>(turns: Turns<TBoard>): Side {
  return turns.sides[turns.current]
}

/** The player up: sides rotate, and each side rotates its own members. */
export function currentThrower<TBoard>(turns: Turns<TBoard>): PlayerId {
  const side = currentSide(turns)
  return side.members[turns.turnsTaken[turns.current] % side.members.length]
}

export function dartsLeft<TBoard>(turns: Turns<TBoard>): number {
  return turns.dartsPerTurn - turns.dartsThrown
}

/** Whether a side is still throwing (not finished or eliminated). */
export function isActive<TBoard>(turns: Turns<TBoard>, id: SideId): boolean {
  return !turns.finished.includes(id) && !turns.eliminated.includes(id)
}

export function activeSides<TBoard>(turns: Turns<TBoard>): Side[] {
  return turns.sides.filter((side) => isActive(turns, side.id))
}

/**
 * Records a dart with the game's updated board, ending the turn when the
 * side has no darts left.
 */
export function countDart<TBoard>(
  turns: Turns<TBoard>,
  board: TBoard,
): Turns<TBoard> {
  const next = { ...turns, board, dartsThrown: turns.dartsThrown + 1 }
  return dartsLeft(next) <= 0 ? endTurn(next) : next
}

/**
 * Ends the current turn early or on time: passes to the next side still
 * throwing and snapshots the board for a possible bust. When no side is
 * left the current side stays put.
 */
export function endTurn<TBoard>(turns: Turns<TBoard>): Turns<TBoard> {
  const turnsTaken = turns.turnsTaken.map((count, index) =>
    index === turns.current ? count + 1 : count,
  )
  let current = turns.current
  for (let step = 1; step <= turns.sides.length; step++) {
    const candidate = (turns.current + step) % turns.sides.length
    if (isActive(turns, turns.sides[candidate].id)) {
      current = candidate
      break
    }
  }
  return {
    ...turns,
    current,
    turnsTaken,
    dartsThrown: 0,
    turnStart: turns.board,
  }
}

/** Puts the board back to the start of the turn and ends the turn. */
export function bust<TBoard>(turns: Turns<TBoard>): Turns<TBoard> {
  return endTurn({ ...turns, board: turns.turnStart })
}

/** Marks a side as finished; call `endTurn` if it was throwing. */
export function finish<TBoard>(
  turns: Turns<TBoard>,
  id: SideId,
): Turns<TBoard> {
  return isActive(turns, id)
    ? { ...turns, finished: [...turns.finished, id] }
    : turns
}

/** Marks a side as knocked out; call `endTurn` if it was throwing. */
export function eliminate<TBoard>(
  turns: Turns<TBoard>,
  id: SideId,
): Turns<TBoard> {
  return isActive(turns, id)
    ? { ...turns, eliminated: [...turns.eliminated, id] }
    : turns
}
