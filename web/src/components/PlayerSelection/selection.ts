import type { PlayerId, PlayerSlot, TeamId } from '../../engine/game'

export const teamIds: readonly TeamId[] = ['A', 'B', 'C']

/** Fisher–Yates shuffle; `random` is injectable for tests. */
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** How many teams to offer: up to three, never more than players. */
export function teamCount(players: number): number {
  return Math.max(2, Math.min(teamIds.length, players))
}

/** Splits players over two teams in turn: A, B, A, B … */
export function alternateTeams(
  ids: readonly PlayerId[],
): Record<PlayerId, TeamId> {
  return Object.fromEntries(ids.map((id, index) => [id, teamIds[index % 2]]))
}

/** At least two teams have players. */
export function hasTwoTeams(
  ids: readonly PlayerId[],
  teamOf: Record<PlayerId, TeamId>,
): boolean {
  return new Set(ids.map((id) => teamOf[id])).size >= 2
}

export function toSlots(
  ids: readonly PlayerId[],
  teamOf: Record<PlayerId, TeamId> | null,
): PlayerSlot[] {
  return ids.map((playerId) =>
    teamOf ? { playerId, teamId: teamOf[playerId] } : { playerId },
  )
}
