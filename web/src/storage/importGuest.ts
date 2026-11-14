import type { PlayerId } from '../engine/game'
import { playerNamed, type Player } from '../players/player'
import type { DataStore, StoredGame } from './store'

export type GuestData = { players: Player[]; games: StoredGame[] }

export type ImportResult = {
  /** Players added to the household. */
  added: number
  /** Guest players matched to a household player of the same name. */
  merged: number
  games: number
}

/** What a guest has on this device, to offer for import. */
export async function guestData(local: DataStore): Promise<GuestData> {
  const [players, games] = await Promise.all([
    local.players.list(),
    local.games.list(),
  ])
  return { players, games }
}

/** Puts each player id through `map`, wherever the game names a player. */
function remap(game: StoredGame, map: Map<PlayerId, PlayerId>): StoredGame {
  const id = (playerId: PlayerId) => map.get(playerId) ?? playerId
  return {
    ...game,
    slots: game.slots.map((slot) => ({ ...slot, playerId: id(slot.playerId) })),
    darts: game.darts.map((thrown) => ({
      ...thrown,
      playerId: id(thrown.playerId),
    })),
    result: game.result && {
      ...game.result,
      standings: game.result.standings.map(id),
    },
  }
}

/**
 * Copies a guest's players and games into the household on first sign-in.
 * A guest player with the same name as a household player (say Anna on the
 * family tablet and on this phone) becomes that player, and their games
 * follow. Ids are kept otherwise, so running it again changes nothing. The
 * guest's data stays on the device.
 */
export async function importGuestData(
  guest: GuestData,
  household: DataStore,
): Promise<ImportResult> {
  const known = await household.players.list()
  const map = new Map<PlayerId, PlayerId>()
  let added = 0
  let merged = 0

  for (const player of guest.players) {
    if (known.some((p) => p.id === player.id)) continue
    const namesake = playerNamed(known, player.name)
    if (namesake) {
      map.set(player.id, namesake.id)
      merged++
      continue
    }
    await household.players.put(player)
    known.push(player)
    added++
  }

  // Oldest first, as they were played.
  for (const game of [...guest.games].reverse()) {
    await household.games.put(remap(game, map))
  }

  return { added, merged, games: guest.games.length }
}
