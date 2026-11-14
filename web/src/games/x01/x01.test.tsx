import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MISS, dart, type Dart } from '../../engine/dart'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord, createGameRunner } from '../../engine/runner'
import { currentThrower } from '../../engine/turns'
import { toX01Options, x01, type X01Options, type X01State } from './x01'

/** `T20`, `D16`, `S5`, `D25` (bullseye) or `M` (miss). */
function d(notation: string): Dart {
  if (notation === 'M') return MISS
  const multiplier = { S: 1, D: 2, T: 3 }[notation[0]] as 1 | 2 | 3
  return dart(Number(notation.slice(1)), multiplier)
}

const solo: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }]

function play(
  options: Partial<X01Options>,
  darts: string[],
  slots: PlayerSlot[] = solo,
) {
  const record = createGameRecord(x01, {
    options: { startScore: 501, in: 'single', out: 'double', ...options },
    slots,
    configVersion: 1,
  })
  const runner = createGameRunner(x01, record)
  for (const notation of darts) runner.throwDart(d(notation))
  return runner.getSnapshot()
}

const remaining = (state: X01State, side: string) =>
  state.turns.board[side].remaining

describe('x01 scoring', () => {
  it('counts down from the start score and passes the turn after 3 darts', () => {
    const { state } = play({}, ['T20', 'T20', 'T20', 'S1'])

    expect(remaining(state, 'anna')).toBe(321)
    expect(remaining(state, 'oli')).toBe(500)
    expect(state.lastTurn).toEqual({
      sideId: 'anna',
      playerId: 'anna',
      darts: [d('T20'), d('T20'), d('T20')],
      from: 501,
      result: 'scored',
    })
    expect(state.turnDarts).toEqual([d('S1')])
    expect(currentThrower(state.turns)).toBe('oli')
  })

  it('starts at 301, 701 or a custom score', () => {
    expect(remaining(play({ startScore: 301 }, []).state, 'anna')).toBe(301)
    expect(remaining(play({ startScore: 701 }, []).state, 'anna')).toBe(701)
    expect(remaining(play({ startScore: 170 }, []).state, 'anna')).toBe(170)
  })
})

describe('x01 in rules', () => {
  it('double in: scores nothing until a double, which counts', () => {
    const { state } = play({ in: 'double' }, ['S20', 'T20', 'D20', 'S5'])

    // Anna: S20 and T20 don't count, D20 opens with 40.
    expect(remaining(state, 'anna')).toBe(461)
    expect(state.turns.board.anna.opened).toBe(true)
    // Óli: S5 doesn't count yet.
    expect(remaining(state, 'oli')).toBe(501)
    expect(state.turns.board.oli.opened).toBe(false)
  })

  it('double in: every dart after opening counts', () => {
    const { state } = play({ in: 'double' }, ['D20', 'S20', 'S1'])

    expect(remaining(state, 'anna')).toBe(440)
  })

  it('double in: the bullseye opens', () => {
    const { state } = play({ in: 'double' }, ['S25', 'D25'])

    expect(remaining(state, 'anna')).toBe(451)
  })

  it('master in: a triple opens', () => {
    const { state } = play({ in: 'master' }, ['S20', 'T19'])

    expect(remaining(state, 'anna')).toBe(444)
  })
})

describe('x01 out rules', () => {
  it('double out: finishes on a double and ends the game', () => {
    const { state, record } = play({ startScore: 100 }, ['T20', 'D20'])

    expect(state.lastTurn?.result).toBe('finished')
    expect(remaining(state, 'anna')).toBe(0)
    expect(x01.isOver(state)).toBe(true)
    expect(record.result?.standings).toEqual(['anna', 'oli'])
  })

  it('double out: finishes on the bullseye', () => {
    const { state } = play({ startScore: 50 }, ['D25'])

    expect(x01.isOver(state)).toBe(true)
  })

  it('single out: any dart that reaches 0 finishes, and 1 is allowed', () => {
    const { state } = play({ startScore: 41, out: 'single' }, [
      'S20',
      'S20',
      'S1',
    ])

    expect(x01.isOver(state)).toBe(true)
  })

  it('master out: finishes on a triple', () => {
    const { state } = play({ startScore: 60, out: 'master' }, ['T20'])

    expect(x01.isOver(state)).toBe(true)
  })
})

describe('x01 busts', () => {
  it('busts below 0, back to the turn-start score', () => {
    const { state } = play({ startScore: 100 }, ['T20', 'T20'])

    expect(state.lastTurn).toMatchObject({ result: 'bust', from: 100 })
    expect(remaining(state, 'anna')).toBe(100)
    expect(currentThrower(state.turns)).toBe('oli')
    expect(state.turnDarts).toEqual([])
  })

  it('busts when 1 is left with double out', () => {
    const { state } = play({ startScore: 41 }, ['S20', 'S20'])

    expect(state.lastTurn?.result).toBe('bust')
    expect(remaining(state, 'anna')).toBe(41)
  })

  it('busts when 1 is left with master out', () => {
    const { state } = play({ startScore: 41, out: 'master' }, ['S20', 'S20'])

    expect(state.lastTurn?.result).toBe('bust')
  })

  it('busts on 0 without a valid out', () => {
    const double = play({ startScore: 40 }, ['S20', 'S20']).state
    expect(double.lastTurn?.result).toBe('bust')
    expect(remaining(double, 'anna')).toBe(40)

    const master = play({ startScore: 40, out: 'master' }, ['S20', 'S20']).state
    expect(master.lastTurn?.result).toBe('bust')

    const outerBull = play({ startScore: 25 }, ['S25']).state
    expect(outerBull.lastTurn?.result).toBe('bust')
  })

  it('takes back every dart of the turn, not just the last', () => {
    const { state } = play({ startScore: 200 }, [
      'S1',
      'S1',
      'S1', // anna 197
      'M',
      'M',
      'M',
      'T20',
      'T20',
      'T20', // anna 17
      'M',
      'M',
      'M',
      'S10',
      'S5',
      'S5', // 17 → 7 → 2 → bust below 0
    ])

    expect(state.lastTurn).toMatchObject({
      result: 'bust',
      from: 17,
      darts: [d('S10'), d('S5'), d('S5')],
    })
    expect(remaining(state, 'anna')).toBe(17)
  })

  it('a miss never busts', () => {
    const { state } = play({ startScore: 40 }, ['M', 'M', 'M'])

    expect(state.lastTurn?.result).toBe('scored')
    expect(remaining(state, 'anna')).toBe(40)
  })
})

describe('x01 handicaps', () => {
  it('gives a player their own start score', () => {
    const { state } = play(
      {},
      [],
      [{ playerId: 'anna' }, { playerId: 'oli', options: { startScore: 301 } }],
    )

    expect(remaining(state, 'anna')).toBe(501)
    expect(remaining(state, 'oli')).toBe(301)
  })

  it('ignores an unset handicap', () => {
    const { state } = play(
      {},
      [],
      [
        { playerId: 'anna', options: { startScore: null } },
        { playerId: 'oli' },
      ],
    )

    expect(remaining(state, 'anna')).toBe(501)
  })

  it('gives a team the first handicap set by its members', () => {
    const { state } = play(
      {},
      [],
      [
        { playerId: 'a1', teamId: 'A' },
        { playerId: 'b1', teamId: 'B' },
        { playerId: 'a2', teamId: 'A', options: { startScore: 301 } },
        { playerId: 'b2', teamId: 'B' },
      ],
    )

    expect(remaining(state, 'A')).toBe(301)
    expect(remaining(state, 'B')).toBe(501)
  })
})

describe('x01 teams (2v2)', () => {
  const teams: PlayerSlot[] = [
    { playerId: 'a1', teamId: 'A' },
    { playerId: 'b1', teamId: 'B' },
    { playerId: 'a2', teamId: 'A' },
    { playerId: 'b2', teamId: 'B' },
  ]

  it('shares a score and alternates throwers A1, B1, A2, B2', () => {
    const { state, record } = play(
      { startScore: 301 },
      [
        'T20',
        'T20',
        'T20', // a1
        'S1',
        'S1',
        'S1', // b1
        'S20',
        'S20',
        'S20', // a2
        'M',
        'M',
        'M', // b2
      ],
      teams,
    )

    expect(remaining(state, 'A')).toBe(61)
    expect(remaining(state, 'B')).toBe(298)
    expect([...new Set(record.darts.map((thrown) => thrown.playerId))]).toEqual(
      ['a1', 'b1', 'a2', 'b2'],
    )
    expect(currentThrower(state.turns)).toBe('a1')
  })

  it('a team finish puts both members first', () => {
    const { record } = play({ startScore: 40 }, ['D20'], teams)

    expect(record.result?.standings).toEqual(['a1', 'a2', 'b1', 'b2'])
  })
})

describe('x01 standings', () => {
  it('ranks the rest by fewest points left', () => {
    const { record } = play(
      { startScore: 100 },
      [
        'S20',
        'M',
        'M', // anna 80
        'T20',
        'M',
        'M', // oli 40
        'S1',
        'M',
        'M', // dagny 99
        'T20',
        'D10', // anna finishes
      ],
      [{ playerId: 'anna' }, { playerId: 'oli' }, { playerId: 'dagny' }],
    )

    expect(record.result?.standings).toEqual(['anna', 'oli', 'dagny'])
  })
})

describe('toX01Options', () => {
  it('reads options from the setup screen', () => {
    expect(
      toX01Options({ startScore: 501, in: 'single', out: 'double' }),
    ).toEqual({
      startScore: 501,
      in: 'single',
      out: 'double',
    })
  })

  it('rejects invalid options', () => {
    expect(() =>
      toX01Options({ startScore: null, in: 'single', out: 'double' }),
    ).toThrow(RangeError)
    expect(() =>
      toX01Options({ startScore: 501, in: 'triple', out: 'double' }),
    ).toThrow(RangeError)
  })
})

describe('x01 Scoreboard', () => {
  it('shows each side with what is left', () => {
    const { state } = play({ in: 'double' }, ['D20'])
    const names: Record<string, string> = { anna: 'Anna', oli: 'Óli' }
    const { Scoreboard } = x01

    render(<Scoreboard state={state} playerName={(id) => names[id]} />)

    expect(screen.getByText('Anna: 461')).toBeInTheDocument()
    expect(screen.getByText('Óli: 501 (ekki inni)')).toBeInTheDocument()
  })
})
