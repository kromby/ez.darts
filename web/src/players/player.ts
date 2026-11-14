import type { PlayerId } from '../engine/game'

/** Avatar colours; stored by name so any store can keep them. */
export const playerColors = [
  'sky',
  'pink',
  'lime',
  'amber',
  'violet',
  'teal',
  'red',
  'orange',
] as const

export type PlayerColor = (typeof playerColors)[number]

export type Player = {
  id: PlayerId
  name: string
  /** Avatar colour; older players without one get one by position. */
  color?: PlayerColor
  /**
   * Set when the player is removed. They are kept, so games they played
   * still show their name, but they are no longer offered for new games.
   */
  archivedAt?: string
}

/** Trims and collapses spaces so "  Anna  Jóns " and "Anna Jóns" match. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

const sameName = (a: string, b: string) =>
  normalizeName(a).toLocaleLowerCase('is') ===
  normalizeName(b).toLocaleLowerCase('is')

/** The player with this name, if any, so two players never share one. */
export function playerNamed(
  players: readonly Player[],
  name: string,
): Player | undefined {
  return players.find((player) => sameName(player.name, name))
}

export function isNameTaken(players: readonly Player[], name: string): boolean {
  return playerNamed(players, name) !== undefined
}

export function isActive(player: Player): boolean {
  return player.archivedAt === undefined
}

/** The first colour nobody in play has, so new players look different. */
export function nextColor(players: readonly Player[]): PlayerColor {
  const used = players.filter(isActive).map((player) => player.color)
  return (
    playerColors.find((color) => !used.includes(color)) ??
    playerColors[used.length % playerColors.length]
  )
}

/**
 * Gives players saved before colours existed a colour each, the first free
 * one in turn. Returns only the players that changed, to save.
 */
export function withColors(players: readonly Player[]): Player[] {
  const all = [...players]
  const changed: Player[] = []
  all.forEach((player, index) => {
    if (player.color) return
    const colored = { ...player, color: nextColor(all) }
    all[index] = colored
    changed.push(colored)
  })
  return changed
}

export function createPlayer(
  name: string,
  others: readonly Player[] = [],
  color: PlayerColor = nextColor(others),
): Player {
  return { id: crypto.randomUUID(), name: normalizeName(name), color }
}

/** The player's colour as a CSS value, e.g. for an avatar. */
export function colorValue(player: Pick<Player, 'color'> | undefined) {
  return `var(--player-${player?.color ?? playerColors[0]})`
}

/** The avatar letter: the first letter of the name. */
export function initial(name: string): string {
  return Array.from(normalizeName(name))[0]?.toLocaleUpperCase('is') ?? '?'
}
