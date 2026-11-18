import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseGameConfig } from '../../engine/config'
import { MISS, dart, type Dart } from '../../engine/dart'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord, createGameRunner } from '../../engine/runner'
import { currentThrower } from '../../engine/turns'
import config from './config.json'
import {
  cricket,
  isDead,
  toCricketOptions,
  turnResult,
  type CricketState,
  type CricketVariant,
} from './cricket'

/** `T20`, `D16`, `S5`, `S25` (outer bull), `D25` (bullseye) or `M` (miss). */
function d(notation: string): Dart {
  if (notation === 'M') return MISS
  const multiplier = { S: 1, D: 2, T: 3 }[notation[0]] as 1 | 2 | 3
  return dart(Number(notation.slice(1)), multiplier)
}

const duo: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }]
const trio: PlayerSlot[] = [...duo, { playerId: 'dagny' }]
const teams: PlayerSlot[] = [
  { playerId: 'anna', teamId: 'A' },
  { playerId: 'oli', teamId: 'B' },
  { playerId: 'dagny', teamId: 'A' },
  { playerId: 'bjorn', teamId: 'B' },
]
const names: Record<string, string> = {
  anna: 'Anna',
  oli: 'Óli',
  dagny: 'Dagný',
  bjorn: 'Björn',
}
const playerName = (id: string) => names[id] ?? id
const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)

function play(
  variant: CricketVariant,
  darts: string[],
  slots: PlayerSlot[] = duo,
) {
  const record = createGameRecord(cricket, {
    options: { variant },
    slots,
    configVersion: 1,
  })
  const runner = createGameRunner(cricket, record)
  for (const notation of darts) runner.throwDart(d(notation))
  return runner.getSnapshot()
}

const side = (state: CricketState, id: string) => state.turns.board[id]
const miss3 = ['M', 'M', 'M']
/** Closes 20 down to 15 in two turns, with the other player missing. */
const closeNumbers = ['T20', 'T19', 'T18', ...miss3, 'T17', 'T16', 'T15']

describe('Cricket config', () => {
  it('parses, with teams and the standard game by default', () => {
    const parsed = parseGameConfig(config)
    expect(parsed.id).toBe(cricket.id)
    expect(parsed.teams).toBe(true)
    expect(
      toCricketOptions(
        Object.fromEntries(parsed.options.map((o) => [o.key, o.default])),
      ),
    ).toEqual({ variant: 'standard' })
    expect(parsed.presets.map((preset) => preset.options.variant)).toEqual([
      'standard',
      'cutThroat',
      'noScore',
    ])
  })

  it('rejects an unknown variant', () => {
    expect(() => toCricketOptions({ variant: 'mickeyMouse' })).toThrow(
      RangeError,
    )
  })
})

describe('Cricket marks', () => {
  it('closes a number with three marks: a triple, or over several darts', () => {
    const { state } = play('standard', ['T20', 'S19', 'D19', 'M'])

    expect(side(state, 'anna').marks[20]).toBe(3)
    expect(side(state, 'anna').marks[19]).toBe(3)
    expect(side(state, 'anna').score).toBe(0)
    expect(state.lastTurn?.closed).toEqual([20, 19])
  })

  it('ignores darts off the cricket numbers', () => {
    const { state } = play('standard', ['T14', 'S1', 'M'])

    expect(side(state, 'anna').marks).toEqual({
      15: 0,
      16: 0,
      17: 0,
      18: 0,
      19: 0,
      20: 0,
      25: 0,
    })
    expect(state.stats.anna).toEqual({ darts: 3, marks: 0, points: 0 })
    expect(state.lastTurn && turnResult(state.lastTurn)).toBe('missed')
  })

  it('counts the outer bull as one mark and the bullseye as two', () => {
    const { state } = play('standard', ['S25', 'D25', 'D25'])

    expect(side(state, 'anna').marks[25]).toBe(3)
    // One mark closed it; the other scores 25 while Óli is open.
    expect(side(state, 'anna').score).toBe(50)
    expect(state.stats.anna).toEqual({ darts: 3, marks: 5, points: 50 })
  })
})

describe('Cricket scoring', () => {
  it('scores extra marks while an opponent is open on the number', () => {
    const { state } = play('standard', ['D20', 'T20', 'S20'])

    // D20 and one mark of the T20 close it; the other three score 20 each.
    expect(side(state, 'anna').score).toBe(60)
    expect(state.lastTurn?.hits.map((hit) => hit.points)).toEqual([0, 40, 20])
    expect(state.lastTurn && turnResult(state.lastTurn)).toBe('scored')
  })

  it('stops scoring a number once every side has closed it', () => {
    const { state } = play('standard', ['T20', 'M', 'M', 'T20', 'M', 'M'])
    expect(isDead(state.turns.board, 20)).toBe(true)

    const after = play('standard', [
      'T20',
      'M',
      'M',
      'T20',
      'M',
      'M',
      'T20',
    ]).state
    expect(side(after, 'anna').score).toBe(0)
    expect(after.stats.anna.marks).toBe(3)
  })

  it('scores nothing on closing a number every opponent has closed', () => {
    // Óli closes 20 first; Anna's marks then close it with nothing to score.
    const { state } = play('standard', [...miss3, 'T20', 'T20', 'M', 'T20'])

    expect(side(state, 'oli').score).toBe(60)
    expect(side(state, 'anna').score).toBe(0)
    expect(isDead(state.turns.board, 20)).toBe(true)
  })
})

describe('Cricket win', () => {
  it('wins on closing everything while ahead or level', () => {
    const { state, record } = play('standard', [
      ...closeNumbers,
      ...miss3,
      'D25',
      'S25',
    ])

    expect(cricket.isOver(state)).toBe(true)
    expect(cricket.standings(state)).toEqual(['anna', 'oli'])
    expect(state.lastTurn?.won).toBe(true)
    expect(record.result?.standings).toEqual(['anna', 'oli'])
  })

  it('keeps throwing after closing everything while behind', () => {
    const trailing = [
      ...miss3,
      'T20',
      'T20',
      'M',
      ...closeNumbers,
      ...miss3,
      'D25',
      'S25',
    ]
    const { state } = play('standard', trailing)

    // Everything closed, but 0 against 60.
    expect(cricket.isOver(state)).toBe(false)
    expect(currentThrower(state.turns)).toBe('anna')

    // 19 is still open for Óli: 57 is not enough, 114 is.
    const first = play('standard', [...trailing, 'M', ...miss3, 'T19']).state
    expect(cricket.isOver(first)).toBe(false)
    const second = play('standard', [
      ...trailing,
      'M',
      ...miss3,
      'T19',
      'T19',
    ]).state
    expect(cricket.isOver(second)).toBe(true)
    expect(cricket.standings(second)).toEqual(['anna', 'oli'])
  })

  it('puts the rest by score, then by marks towards closing', () => {
    const { state } = play(
      'standard',
      ['T20', 'M', 'M', 'S19', 'M', 'M', 'T19', 'T19', 'M'],
      trio,
    )

    expect(side(state, 'dagny').score).toBe(57)
    // Óli and Anna level on 0; Óli has 1 mark, Anna 3.
    expect(cricket.standings(state)).toEqual(['dagny', 'anna', 'oli'])
  })
})

describe('Cricket cut-throat', () => {
  it('gives the points to every opponent still open on the number', () => {
    const { state } = play(
      'cutThroat',
      [...miss3, ...miss3, 'T20', 'M', 'M', 'T20', 'T20', 'M', ...miss3, 'T20'],
      trio,
    )

    // Dagný closed 20 first, so Anna's 60 goes to Óli alone; then Anna has
    // closed it too, and Dagný's 60 also goes to Óli.
    expect(side(state, 'anna').score).toBe(0)
    expect(side(state, 'oli').score).toBe(120)
    expect(side(state, 'dagny').score).toBe(0)
    expect(state.stats.dagny.points).toBe(60)
  })

  it('wins on closing everything with the lowest score', () => {
    const { state } = play('cutThroat', [
      'T20',
      'T20',
      'M',
      ...miss3,
      'T19',
      'T18',
      'T17',
      ...miss3,
      'T16',
      'T15',
      'D25',
      ...miss3,
      'S25',
    ])

    expect(side(state, 'oli').score).toBe(60)
    expect(cricket.isOver(state)).toBe(true)
    expect(cricket.standings(state)).toEqual(['anna', 'oli'])
  })

  it('keeps throwing after closing everything with the higher score', () => {
    const { state } = play('cutThroat', [
      ...miss3,
      'T20',
      'T20',
      'M',
      ...closeNumbers,
      ...miss3,
      'D25',
      'S25',
    ])

    expect(side(state, 'anna').score).toBe(60)
    expect(cricket.isOver(state)).toBe(false)
  })
})

describe('Cricket with no score', () => {
  it('counts no points, and closing everything first wins', () => {
    const { state } = play('noScore', [
      ...miss3,
      'T20',
      'T20',
      'M',
      ...closeNumbers,
      ...miss3,
      'D25',
      'S25',
    ])

    expect(side(state, 'oli').score).toBe(0)
    expect(state.stats.oli.marks).toBe(3)
    expect(cricket.isOver(state)).toBe(true)
    expect(cricket.standings(state)).toEqual(['anna', 'oli'])
  })
})

describe('Cricket in teams', () => {
  it('shares marks and score, with team mates taking turns', () => {
    const { state } = play(
      'standard',
      ['S20', 'M', 'M', ...miss3, 'D20', 'S20', 'M', ...miss3],
      teams,
    )

    expect(Object.keys(state.turns.board)).toEqual(['A', 'B'])
    expect(side(state, 'A').marks[20]).toBe(3)
    expect(side(state, 'A').score).toBe(20)
    expect(state.stats.anna.marks).toBe(1)
    expect(state.stats.dagny).toEqual({ darts: 3, marks: 3, points: 20 })
    expect(currentThrower(state.turns)).toBe('anna')
  })

  it('wins and places the team together, each with a summary', () => {
    const { state, record } = play(
      'standard',
      [...closeNumbers, ...miss3, 'D25', 'S25'],
      teams,
    )

    expect(cricket.isOver(state)).toBe(true)
    expect(cricket.standings(state)).toEqual(['anna', 'dagny', 'oli', 'bjorn'])
    expect(record.summary).toEqual([
      expect.objectContaining({ playerId: 'anna', place: 1, darts: 5 }),
      expect.objectContaining({ playerId: 'oli', place: 2, misses: 3 }),
      expect.objectContaining({ playerId: 'dagny', place: 1, triples: 3 }),
      expect.objectContaining({ playerId: 'bjorn', place: 2, darts: 3 }),
    ])
  })
})

describe('Cricket summary', () => {
  it('has darts, where they landed, the place and the points', () => {
    const { record } = play('standard', [
      'T20',
      'T20',
      'S1',
      ...miss3,
      'T19',
      'T18',
      'T17',
      ...miss3,
      'T16',
      'T15',
      'D25',
      ...miss3,
      'S25',
    ])

    expect(record.summary?.[0]).toEqual({
      playerId: 'anna',
      darts: 10,
      singles: 2,
      doubles: 1,
      triples: 7,
      misses: 0,
      place: 1,
      points: 60,
    })
  })
})

describe('Cricket Scoreboard', () => {
  const { Scoreboard } = cricket

  it('shows the score, the turn so far and the marks grid', () => {
    const { state } = play('standard', ['T20', 'M', 'M', 'S20', 'S20'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(
      screen.getByRole('region', { name: 'Kastar: Óli' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('0')
    const slots = within(
      screen.getByRole('list', { name: 'Pílur í umferðinni' }),
    ).getAllByRole('listitem')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'S20/',
      'S20/',
      'Píla 3',
    ])

    const grid = screen.getByRole('table', { name: 'Merki' })
    const columns = within(grid).getAllByRole('columnheader')
    expect(columns.map((column) => column.textContent)).toEqual([
      'Leikmaður eða lið',
      '20',
      '19',
      '18',
      '17',
      '16',
      '15',
      'MiðMiðja',
      'Stig',
    ])
    const [, anna, oli] = within(grid).getAllByRole('row')
    expect(within(anna).getByRole('rowheader')).toHaveTextContent('AAnna')
    expect(cells(anna).slice(0, 2)).toEqual(['Ⓧlokað', '0 merki'])
    expect(cells(oli).slice(0, 2)).toEqual(['X2 merki', '0 merki'])
    expect(cells(oli).at(-1)).toBe('0')
    expect(oli).toHaveAttribute('data-current')
  })

  it('reports how the last turn went', () => {
    const { state } = play('standard', ['T20', 'S20', 'M'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Anna: 4 merki, 20 stig',
    )
    expect(screen.getByRole('status')).toHaveTextContent('T20 S20 Framhjá')
  })

  it('says points went to the others in cut-throat', () => {
    const { state } = play('cutThroat', ['T20', 'S20', 'M'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Anna: 4 merki, 20 stig á hina',
    )
  })

  it('marks a dead number and leaves out the score with no score', () => {
    const { state } = play('noScore', ['T20', 'M', 'M', 'T20', 'M', 'M'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(screen.getByTestId('remaining')).toHaveTextContent('1/7')
    const grid = screen.getByRole('table', { name: 'Merki' })
    expect(
      within(grid).getByRole('columnheader', { name: '20, dauð' }),
    ).toBeInTheDocument()
    expect(
      within(grid).queryByRole('columnheader', { name: 'Stig' }),
    ).not.toBeInTheDocument()
  })
})

describe('Cricket Status and PlayerSummary', () => {
  it('names the variant and round', () => {
    const { Status } = cricket
    if (!Status) throw new Error('Cricket has a Status')
    const { state } = play('cutThroat', miss3)

    const { container } = render(
      <Status state={state} playerName={playerName} />,
    )

    expect(container).toHaveTextContent('Miskunnarlaust · Umferð 1')
  })

  it("shows the player's marks per round, darts, marks and points", () => {
    const { PlayerSummary } = cricket
    if (!PlayerSummary) throw new Error('Cricket has a PlayerSummary')
    const { state } = play('standard', ['T20', 'T20', 'M'])

    render(<PlayerSummary state={state} playerId="anna" />)

    const items = screen
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextSibling?.textContent])
    expect(items).toEqual([
      ['Merki/umf.', '6,0'],
      ['Pílur', '3'],
      ['Merki', '6'],
      ['Stig', '60'],
    ])
  })
})
