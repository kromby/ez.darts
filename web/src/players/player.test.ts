import { describe, expect, it } from 'vitest'
import { createPlayer, isNameTaken, normalizeName } from './player'

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
