import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MISS, dart, type Dart } from '../../engine/dart'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord, createGameRunner } from '../../engine/runner'
import { currentThrower } from '../../engine/turns'
import {
  average,
  toX01Options,
  x01,
  type X01Options,
  type X01State,
} from './x01'

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
    options: {
      startScore: 501,
      in: 'single',
      out: 'double',
      playOn: false,
      ...options,
    },
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

describe('x01 play-on', () => {
  const three: PlayerSlot[] = [
    { playerId: 'anna' },
    { playerId: 'oli' },
    { playerId: 'dagny' },
  ]

  it('keeps playing for places until one side is left', () => {
    const afterFirst = play(
      { startScore: 40, playOn: true },
      ['D20'], // anna checks out
      three,
    )
    expect(x01.isOver(afterFirst.state)).toBe(false)
    expect(afterFirst.record.result).toBeNull()
    // Anna is skipped from now on.
    expect(currentThrower(afterFirst.state.turns)).toBe('oli')

    const { state, record } = play(
      { startScore: 40, playOn: true },
      [
        'D20', // anna 1st
        'S20',
        'M',
        'M', // oli 20
        'D20', // dagny 2nd: only oli is left, so the game ends
      ],
      three,
    )
    expect(x01.isOver(state)).toBe(true)
    expect(record.result?.standings).toEqual(['anna', 'dagny', 'oli'])
  })

  it('ends a two-player game at the first checkout', () => {
    const { state } = play({ startScore: 40, playOn: true }, ['D20'])

    expect(x01.isOver(state)).toBe(true)
  })

  it('ends a solo game when the player checks out', () => {
    const solo1: PlayerSlot[] = [{ playerId: 'anna' }]
    const before = play({ startScore: 40, playOn: true }, ['S10'], solo1)
    expect(x01.isOver(before.state)).toBe(false)

    const { state } = play({ startScore: 40, playOn: true }, ['D20'], solo1)
    expect(x01.isOver(state)).toBe(true)
  })

  it('without play-on, ends at the first checkout', () => {
    const { state } = play({ startScore: 40 }, ['D20'], three)

    expect(x01.isOver(state)).toBe(true)
  })
})

describe('toX01Options', () => {
  it('reads options from the setup screen', () => {
    expect(
      toX01Options({
        startScore: 501,
        in: 'single',
        out: 'double',
        playOn: true,
      }),
    ).toEqual({ startScore: 501, in: 'single', out: 'double', playOn: true })
  })

  it('ends at the first checkout for games saved without play-on', () => {
    expect(
      toX01Options({ startScore: 501, in: 'single', out: 'double' }).playOn,
    ).toBe(false)
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

describe('x01 stats', () => {
  const stats = (state: X01State, id: string) => state.stats[id]

  it('counts darts and points for the 3-dart average', () => {
    const { state } = play({}, ['T20', 'T20', 'S20', 'S1', 'S1', 'S1'])

    expect(stats(state, 'anna')).toEqual({
      darts: 3,
      scored: 140,
      bestTurn: 140,
      checkout: null,
    })
    expect(average(stats(state, 'anna'))).toBeCloseTo(140)
    expect(average(stats(state, 'oli'))).toBeCloseTo(3)
  })

  it('counts the darts of a bust but none of its points', () => {
    const { state } = play({ startScore: 50 }, ['S20', 'S20', 'S20'])

    expect(stats(state, 'anna')).toMatchObject({
      darts: 3,
      scored: 0,
      bestTurn: 0,
    })
  })

  it('records the best turn and the checkout', () => {
    const { state } = play({ startScore: 101 }, [
      'S1',
      'S1',
      'S1',
      'M',
      'M',
      'M',
      'T20',
      'D19',
    ])

    expect(stats(state, 'anna')).toEqual({
      darts: 5,
      scored: 101,
      bestTurn: 98,
      checkout: 98,
    })
  })

  it('does not count darts before a double in', () => {
    const { state } = play({ in: 'double' }, ['S20', 'D20', 'S20'])

    expect(stats(state, 'anna')).toMatchObject({ darts: 3, scored: 60 })
  })

  it('has no average before the first dart', () => {
    expect(average(stats(play({}, []).state, 'anna'))).toBeNull()
  })
})

const names: Record<string, string> = {
  anna: 'Anna',
  oli: 'Óli',
  dagny: 'Dagný',
}
const playerName = (id: string) => names[id]

function renderBoard(state: X01State, hint?: string | null) {
  const { Scoreboard } = x01
  return render(
    <Scoreboard state={state} playerName={playerName} hint={hint} />,
  )
}

describe('x01 Scoreboard', () => {
  it('shows the thrower, their score and stats, and every side', () => {
    const { state } = play({}, ['T20', 'T20', 'T20', 'S20'])

    renderBoard(state)

    const current = screen.getByRole('region', { name: 'Kastar: Óli' })
    expect(within(current).getByTestId('remaining')).toHaveTextContent('481')
    expect(within(current).getByText('Pílur').nextSibling).toHaveTextContent(
      '1',
    )
    expect(
      within(current).getByText('Umferð frá').nextSibling,
    ).toHaveTextContent('501')
    expect(within(current).getByText('Meðaltal').nextSibling).toHaveTextContent(
      '60,0',
    )

    const sides = within(screen.getByRole('list', { name: 'Staðan' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(sides).toEqual([
      'AAnnameðaltal 180,0 · 3 pílur321',
      'ÓÓlimeðaltal 60,0 · 1 píla481',
    ])
    expect(screen.getByRole('listitem', { current: true })).toHaveTextContent(
      'Óli',
    )
  })

  it('fills the dart slots as the turn goes', () => {
    renderBoard(play({}, ['T20', 'M']).state)

    const slots = within(
      screen.getByRole('list', { name: 'Pílur í umferðinni' }),
    ).getAllByRole('listitem')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'T2060',
      'Framhjá0',
      'Píla 3',
    ])
    expect(slots[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('reports a scored turn until the next dart', () => {
    renderBoard(play({}, ['T20', 'S5', 'M']).state)

    expect(screen.getByRole('status')).toHaveTextContent('Anna: 65')
    expect(screen.getByRole('status')).toHaveTextContent('T20 S5 Framhjá')
    expect(
      screen.queryByRole('list', { name: 'Pílur í umferðinni' }),
    ).not.toBeInTheDocument()
  })

  it('reports a bust', () => {
    renderBoard(play({ startScore: 50 }, ['S20', 'S20', 'S20']).state)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Anna sprakk – aftur á 50',
    )
    expect(screen.getByRole('region', { name: 'Kastar: Óli' })).toHaveAttribute(
      'data-result',
      'bust',
    )
  })

  it('reports a checkout and the place it earned with play-on', () => {
    const { state } = play(
      { startScore: 40, playOn: true },
      ['D20'],
      [{ playerId: 'anna' }, { playerId: 'oli' }, { playerId: 'dagny' }],
    )

    renderBoard(state)

    expect(screen.getByRole('status')).toHaveTextContent('Anna kláraði 40!')
    expect(
      within(screen.getByRole('list', { name: 'Staðan' })).getAllByRole(
        'listitem',
      )[0],
    ).toHaveTextContent('1. sæti')
  })

  it('tags handicaps and sides that are not in yet', () => {
    const { state } = play(
      { in: 'double' },
      ['D20'],
      [{ playerId: 'anna' }, { playerId: 'oli', options: { startScore: 301 } }],
    )

    renderBoard(state)

    const [anna, oli] = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(anna).toHaveTextContent('461')
    expect(anna).not.toHaveTextContent('ekki inni')
    expect(oli).toHaveTextContent('Forgjöf 301')
    expect(oli).toHaveTextContent('ekki inni')
  })

  it('names a team by its members', () => {
    const { state } = play(
      {},
      [],
      [
        { playerId: 'anna', teamId: 'A' },
        { playerId: 'oli', teamId: 'B' },
        { playerId: 'dagny', teamId: 'A' },
      ],
    )

    renderBoard(state)

    expect(
      within(screen.getByRole('list', { name: 'Staðan' })).getAllByRole(
        'listitem',
      )[0],
    ).toHaveTextContent('Anna & Dagný')
  })

  it('keeps a hint slot only when the game gives hints', () => {
    const { state } = play({}, [])

    const { rerender } = renderBoard(state)
    expect(screen.queryByText('Útskot')).not.toBeInTheDocument()

    const { Scoreboard } = x01
    rerender(
      <Scoreboard state={state} playerName={playerName} hint="T20 D20" />,
    )
    expect(screen.getByText('Útskot').parentElement).toHaveTextContent(
      'ÚtskotT20 D20',
    )
  })
})

describe('x01 checkout hints', () => {
  const hint = (state: X01State) => x01.hint?.(state) ?? null

  it('suggests a finish once one is possible', () => {
    expect(hint(play({}, []).state)).toBeNull()
    expect(hint(play({ startScore: 104 }, []).state)).toBe('T18 D25')
    expect(hint(play({ startScore: 170 }, []).state)).toBe('T20 T20 D25')
  })

  it('updates after every dart with the darts left', () => {
    expect(hint(play({ startScore: 104 }, ['S4']).state)).toBe('T20 D20')
    expect(hint(play({ startScore: 104 }, ['S4', 'M']).state)).toBeNull()
    expect(hint(play({ startScore: 104 }, ['S4', 'T20']).state)).toBe('D20')
  })

  it('follows the out rule', () => {
    expect(hint(play({ startScore: 60, out: 'single' }, []).state)).toBe('T20')
    expect(hint(play({ startScore: 3, out: 'master' }, []).state)).toBe('T1')
  })

  it('gives no hint before a double in or once the game is over', () => {
    expect(hint(play({ startScore: 40, in: 'double' }, []).state)).toBeNull()
    expect(hint(play({ startScore: 40 }, ['D20']).state)).toBeNull()
  })

  it('shows the hint and another finish on the scoreboard', () => {
    const { state } = play({ startScore: 100 }, ['M'])

    renderBoard(state, hint(state))

    expect(screen.getByText('Útskot').parentElement).toHaveTextContent(
      'ÚtskotT20 D20eða D25 D25',
    )
  })
})

describe('x01 Status', () => {
  it('names the start score, rules and round', () => {
    const { Status } = x01
    if (!Status) throw new Error('x01 has a Status')
    const { state } = play({ in: 'double', out: 'master' }, [
      'M',
      'M',
      'M',
      'M',
      'M',
      'M',
    ])

    const { container } = render(
      <Status state={state} playerName={playerName} />,
    )

    expect(container).toHaveTextContent(
      '501 · Tvöfalt inn · Meistara út · Umferð 2',
    )
  })
})

describe('x01 PlayerSummary', () => {
  it('lists the key numbers, with the checkout once there is one', () => {
    const { PlayerSummary } = x01
    if (!PlayerSummary) throw new Error('x01 has a PlayerSummary')
    const { state } = play({ startScore: 40 }, ['D20'])

    const anna = render(<PlayerSummary state={state} playerId="anna" />)
    expect(anna.container).toHaveTextContent(
      'Meðaltal120,0Pílur1Besta umferð40Útskot40',
    )
    anna.unmount()

    const oli = render(<PlayerSummary state={state} playerId="oli" />)
    expect(oli.container).toHaveTextContent('Meðaltal–Pílur0Besta umferð0')
    expect(oli.container).not.toHaveTextContent('Útskot')
  })
})
