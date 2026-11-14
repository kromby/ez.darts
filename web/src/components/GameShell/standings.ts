import type { PlayerId, PlayerSlot } from '../../engine/game'

/**
 * Groups standings into places: team members that follow each other share
 * a place, everyone else has their own.
 */
export function groupStandings(
  standings: readonly PlayerId[],
  slots: readonly PlayerSlot[],
): PlayerId[][] {
  const places: { side: string; players: PlayerId[] }[] = []
  for (const id of standings) {
    const side = slots.find((slot) => slot.playerId === id)?.teamId ?? id
    const last = places.at(-1)
    if (last?.side === side) last.players.push(id)
    else places.push({ side, players: [id] })
  }
  return places.map((place) => place.players)
}
