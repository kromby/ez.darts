import { describe, expect, it } from 'vitest'
import {
  colorValue,
  createPlayer,
  initial,
  isActive,
  isNameTaken,
  nextColor,
  normalizeName,
  playerColors,
  playerNamed,
  withColors,
  type Player,
} from './player'

describe('players', () => {
  it('normalises spaces in names', () => {
    expect(normalizeName('  Anna   Jóns ')).toBe('Anna Jóns')
  })

  it('finds taken names regardless of case and spacing', () => {
    const players = [{ id: '1', name: 'Óli' }]

    expect(isNameTaken(players, ' óli ')).toBe(true)
    expect(isNameTaken(players, 'ÓLI')).toBe(true)
    expect(isNameTaken(players, 'Oli')).toBe(false)
  })

  it('creates a player with an id and a tidy name', () => {
    const player = createPlayer(' Dagný ')

    expect(player.name).toBe('Dagný')
    expect(player.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('player colours, names and removal', () => {
  const anna: Player = { id: 'anna', name: 'Anna', color: 'sky' }
  const oli: Player = { id: 'oli', name: 'Óli', color: 'pink' }

  it('gives a new player the first colour nobody in play has', () => {
    expect(nextColor([])).toBe('sky')
    expect(nextColor([anna, oli])).toBe('lime')
    expect(createPlayer('Dagný', [anna, oli]).color).toBe('lime')
    // A removed player's colour is free again.
    expect(nextColor([{ ...anna, archivedAt: '2026-11-14T20:00:00Z' }])).toBe(
      'sky',
    )
  })

  it('cycles the colours once all are used', () => {
    const everyone = playerColors.map((color, index) => ({
      id: String(index),
      name: String(index),
      color,
    }))
    expect(nextColor(everyone)).toBe('sky')
  })

  it('keeps a chosen colour', () => {
    expect(createPlayer('Dagný', [anna], 'red').color).toBe('red')
  })

  it("finds a name's owner, removed players too", () => {
    const removed = { ...oli, archivedAt: '2026-11-14T20:00:00Z' }

    expect(playerNamed([anna, removed], ' óli ')).toBe(removed)
    expect(isNameTaken([anna, removed], 'ÓLI')).toBe(true)
    expect(isActive(removed)).toBe(false)
    expect(isActive(anna)).toBe(true)
  })

  it('makes an avatar from the first letter and the colour', () => {
    expect(initial(' ásta ')).toBe('Á')
    expect(initial('Ölvir')).toBe('Ö')
    expect(initial('')).toBe('?')
    expect(colorValue(oli)).toBe('var(--player-pink)')
    // Players saved before colours existed get the first one.
    expect(colorValue({})).toBe('var(--player-sky)')
  })
})

describe('withColors', () => {
  it('colours players saved without one, each differently', () => {
    const players: Player[] = [
      { id: 'anna', name: 'Anna' },
      { id: 'oli', name: 'Óli', color: 'sky' },
      { id: 'dagny', name: 'Dagný' },
    ]

    expect(withColors(players)).toEqual([
      { id: 'anna', name: 'Anna', color: 'pink' },
      { id: 'dagny', name: 'Dagný', color: 'lime' },
    ])
    expect(withColors([players[1]])).toEqual([])
  })
})
