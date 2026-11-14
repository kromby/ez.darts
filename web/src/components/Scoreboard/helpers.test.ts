import { describe, expect, it } from 'vitest'
import { sideColor } from './helpers'

describe('sideColor', () => {
  const colors: Record<string, string> = { anna: 'var(--player-red)' }
  const playerColor = (id: string) => colors[id]

  it("uses a player's own colour", () => {
    expect(sideColor({ id: 'anna', members: ['anna'] }, 1, playerColor)).toBe(
      'var(--player-red)',
    )
  })

  it('falls back to one by position', () => {
    expect(sideColor({ id: 'oli', members: ['oli'] }, 1, playerColor)).toBe(
      'var(--team-b)',
    )
    expect(sideColor({ id: 'oli', members: ['oli'] }, 3)).toBe('var(--team-a)')
  })

  it("keeps a team's colour", () => {
    expect(
      sideColor({ id: 'B', members: ['anna', 'oli'] }, 0, playerColor),
    ).toBe('var(--team-b)')
  })
})
