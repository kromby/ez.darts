import { describe, expect, it } from 'vitest'
import type { PlayerSlot } from './game'
import {
  activeSides,
  bust,
  countDart,
  currentSide,
  currentThrower,
  dartsLeft,
  eliminate,
  endTurn,
  finish,
  sidesFromSlots,
  startTurns,
  type Turns,
} from './turns'

const solo: PlayerSlot[] = [
  { playerId: 'anna' },
  { playerId: 'bjarni' },
  { playerId: 'dagny' },
]

/** Throwers for the next `count` turns. */
function rotation<T>(turns: Turns<T>, count: number) {
  const throwers: string[] = []
  for (let i = 0; i < count; i++) {
    throwers.push(currentThrower(turns))
    turns = endTurn(turns)
  }
  return throwers
}

describe('sidesFromSlots', () => {
  it('makes each player a side when there are no teams', () => {
    expect(sidesFromSlots(solo)).toEqual([
      { id: 'anna', members: ['anna'] },
      { id: 'bjarni', members: ['bjarni'] },
      { id: 'dagny', members: ['dagny'] },
    ])
  })

  it('groups team members in slot order', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'a1', teamId: 'A' },
      { playerId: 'b1', teamId: 'B' },
      { playerId: 'a2', teamId: 'A' },
      { playerId: 'b2', teamId: 'B' },
    ]

    expect(sidesFromSlots(slots)).toEqual([
      { id: 'A', members: ['a1', 'a2'] },
      { id: 'B', members: ['b1', 'b2'] },
    ])
  })
})

describe('rotation', () => {
  it('cycles through the players', () => {
    const turns = startTurns(sidesFromSlots(solo), null)

    expect(rotation(turns, 4)).toEqual(['anna', 'bjarni', 'dagny', 'anna'])
  })

  it('skips eliminated and finished players', () => {
    let turns = startTurns(sidesFromSlots(solo), null)
    turns = eliminate(turns, 'bjarni')

    expect(rotation(turns, 4)).toEqual(['anna', 'dagny', 'anna', 'dagny'])

    turns = endTurn(finish(turns, 'anna'))
    expect(currentThrower(turns)).toBe('dagny')
    expect(rotation(turns, 2)).toEqual(['dagny', 'dagny'])
    expect(activeSides(turns).map((side) => side.id)).toEqual(['dagny'])
  })

  it('passes over a player knocked out while waiting', () => {
    let turns = startTurns(sidesFromSlots(solo), null)
    turns = eliminate(turns, 'bjarni') // e.g. by anna in Killer

    turns = endTurn(turns)

    expect(currentThrower(turns)).toBe('dagny')
  })

  it('stays put when no side is left', () => {
    let turns = startTurns(sidesFromSlots(solo.slice(0, 1)), null)
    turns = endTurn(finish(turns, 'anna'))

    expect(currentThrower(turns)).toBe('anna')
    expect(activeSides(turns)).toEqual([])
  })

  it('alternates teams and team members in 2v2: A1, B1, A2, B2', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'a1', teamId: 'A' },
      { playerId: 'a2', teamId: 'A' },
      { playerId: 'b1', teamId: 'B' },
      { playerId: 'b2', teamId: 'B' },
    ]
    const turns = startTurns(sidesFromSlots(slots), null)

    expect(rotation(turns, 6)).toEqual(['a1', 'b1', 'a2', 'b2', 'a1', 'b1'])
  })

  it('rotates each team on its own when teams differ in size', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'a1', teamId: 'A' },
      { playerId: 'a2', teamId: 'A' },
      { playerId: 'b1', teamId: 'B' },
    ]
    const turns = startTurns(sidesFromSlots(slots), null)

    expect(rotation(turns, 6)).toEqual(['a1', 'b1', 'a2', 'b1', 'a1', 'b1'])
  })

  it('keeps a team member rotation when another team is out', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'a1', teamId: 'A' },
      { playerId: 'b1', teamId: 'B' },
      { playerId: 'a2', teamId: 'A' },
      { playerId: 'b2', teamId: 'B' },
      { playerId: 'c1', teamId: 'C' },
      { playerId: 'c2', teamId: 'C' },
    ]
    let turns = startTurns(sidesFromSlots(slots), null)
    turns = eliminate(turns, 'B')

    expect(rotation(turns, 4)).toEqual(['a1', 'c1', 'a2', 'c2'])
    expect(currentSide(turns).id).toBe('A')
  })
})

describe('darts in a turn', () => {
  it('gives 3 darts by default and ends the turn after the last', () => {
    let turns = startTurns(sidesFromSlots(solo), 0)
    expect(dartsLeft(turns)).toBe(3)

    turns = countDart(turns, 20)
    turns = countDart(turns, 40)
    expect(dartsLeft(turns)).toBe(1)
    expect(currentThrower(turns)).toBe('anna')

    turns = countDart(turns, 60)
    expect(currentThrower(turns)).toBe('bjarni')
    expect(dartsLeft(turns)).toBe(3)
    expect(turns.board).toBe(60)
  })

  it('supports a different number of darts per turn', () => {
    let turns = startTurns(sidesFromSlots(solo), 0, { dartsPerTurn: 1 })

    turns = countDart(turns, 0)

    expect(currentThrower(turns)).toBe('bjarni')
  })

  it('ends a turn early', () => {
    let turns = startTurns(sidesFromSlots(solo), 0)
    turns = countDart(turns, 0)

    turns = endTurn(turns)

    expect(currentThrower(turns)).toBe('bjarni')
    expect(dartsLeft(turns)).toBe(3)
  })
})

describe('bust', () => {
  type Board = Record<string, number>

  it('restores the board to the start of the turn and ends it', () => {
    let turns = startTurns<Board>(sidesFromSlots(solo), {
      anna: 501,
      bjarni: 501,
      dagny: 501,
    })
    turns = countDart(turns, { ...turns.board, anna: 441 })
    turns = countDart(turns, { ...turns.board, anna: 381 })
    turns = countDart(turns, { ...turns.board, anna: 321 }) // turn ends
    turns = countDart(turns, { ...turns.board, bjarni: 441 })

    turns = bust(turns)

    expect(turns.board).toEqual({ anna: 321, bjarni: 501, dagny: 501 })
    expect(currentThrower(turns)).toBe('dagny')
    expect(turns.turnStart).toBe(turns.board)
  })

  it('shares the board snapshot between team members', () => {
    const slots: PlayerSlot[] = [
      { playerId: 'a1', teamId: 'A' },
      { playerId: 'a2', teamId: 'A' },
      { playerId: 'b1', teamId: 'B' },
    ]
    let turns = startTurns<Board>(sidesFromSlots(slots), { A: 101, B: 101 })
    turns = countDart(turns, { ...turns.board, A: 41 })
    turns = endTurn(turns)
    turns = endTurn(turns) // b1

    turns = countDart(turns, { ...turns.board, A: 1 }) // a2 busts on 1
    turns = bust(turns)

    expect(turns.board).toEqual({ A: 41, B: 101 })
    expect(currentThrower(turns)).toBe('b1')
  })
})

describe('finish and eliminate', () => {
  it('keeps the order sides finished and went out in', () => {
    let turns = startTurns(sidesFromSlots(solo), null)
    turns = finish(turns, 'dagny')
    turns = eliminate(turns, 'bjarni')
    turns = finish(turns, 'anna')
    turns = finish(turns, 'dagny') // already finished: ignored

    expect(turns.finished).toEqual(['dagny', 'anna'])
    expect(turns.eliminated).toEqual(['bjarni'])
  })
})
