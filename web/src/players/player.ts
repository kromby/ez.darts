import type { PlayerId } from '../engine/game'

export type Player = {
  id: PlayerId
  name: string
}

/** Trims and collapses spaces so "  Anna  Jóns " and "Anna Jóns" match. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function isNameTaken(players: readonly Player[], name: string): boolean {
  const wanted = normalizeName(name).toLocaleLowerCase('is')
  return players.some(
    (player) => normalizeName(player.name).toLocaleLowerCase('is') === wanted,
  )
}

export function createPlayer(name: string): Player {
  return { id: crypto.randomUUID(), name: normalizeName(name) }
}
