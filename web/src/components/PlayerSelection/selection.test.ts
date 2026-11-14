import { describe, expect, it } from 'vitest'
import {
  alternateTeams,
  hasTwoTeams,
  shuffle,
  teamCount,
  toSlots,
} from './selection'

describe('shuffle', () => {
  it('reorders with the given random source and keeps every item', () => {
    const items = ['a', 'b', 'c', 'd']

    expect(shuffle(items, () => 0)).toEqual(['b', 'c', 'd', 'a'])
    expect(shuffle(items, () => 0.999)).toEqual(items)
    expect(shuffle(items).sort()).toEqual(items)
    expect(items).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('teams', () => {
  it('offers two teams, or three once there are three players', () => {
    expect(teamCount(1)).toBe(2)
    expect(teamCount(2)).toBe(2)
    expect(teamCount(3)).toBe(3)
    expect(teamCount(6)).toBe(3)
  })

  it('splits players over two teams in turn', () => {
    expect(alternateTeams(['a', 'b', 'c', 'd'])).toEqual({
      a: 'A',
      b: 'B',
      c: 'A',
      d: 'B',
    })
  })

  it('needs players in at least two teams', () => {
    expect(hasTwoTeams(['a', 'b'], { a: 'A', b: 'B' })).toBe(true)
    expect(hasTwoTeams(['a', 'b'], { a: 'A', b: 'A' })).toBe(false)
    expect(hasTwoTeams(['a'], { a: 'A' })).toBe(false)
  })

  it('builds slots in order, with teams only when playing in teams', () => {
    expect(toSlots(['b', 'a'], null)).toEqual([
      { playerId: 'b' },
      { playerId: 'a' },
    ])
    expect(toSlots(['b', 'a'], { a: 'A', b: 'B' })).toEqual([
      { playerId: 'b', teamId: 'B' },
      { playerId: 'a', teamId: 'A' },
    ])
  })
})
