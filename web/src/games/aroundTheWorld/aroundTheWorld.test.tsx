import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseGameConfig } from '../../engine/config'
import { MISS, dart, type Dart } from '../../engine/dart'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord, createGameRunner } from '../../engine/runner'
import { currentThrower } from '../../engine/turns'
import {
  aroundTheWorld,
  toAtwOptions,
  type AtwOptions,
  type AtwState,
} from './aroundTheWorld'
import config from './config.json'

/** `T20`, `D16`, `S5`, `D25` (bullseye) or `M` (miss). */
function d(notation: string): Dart {
  if (notation === 'M') return MISS
  const multiplier = { S: 1, D: 2, T: 3 }[notation[0]] as 1 | 2 | 3
  return dart(Number(notation.slice(1)), multiplier)
}

const solo: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }]

function play(
  options: Partial<AtwOptions>,
  darts: string[],
  slots: PlayerSlot[] = solo,
) {
  const record = createGameRecord(aroundTheWorld, {
    options: {
      in: 'single',
      out: 'single',
      bull: false,
      missEndsTurn: false,
      playOn: false,
      ...options,
    },
    slots,
    configVersion: 1,
  })
  const runner = createGameRunner(aroundTheWorld, record)
  for (const notation of darts) runner.throwDart(d(notation))
  return runner.getSnapshot()
}

/** The number a side must hit next. */
const target = (state: AtwState, side: string) =>
  state.turns.board[side].target + 1

/** Anna hits every number from `from` to `to` with singles, Óli misses. */
function climb(from: number, to: number): string[] {
  const darts: string[] = []
  for (let number = from; number <= to; number++) {
    darts.push(`S${number}`)
    if (darts.length % 6 === 3) darts.push('M', 'M', 'M')
  }
  return darts
}

describe('Around the World config', () => {
  it('parses, with single in and out and no bull by default', () => {
    const parsed = parseGameConfig(config)
    expect(parsed.id).toBe(aroundTheWorld.id)
    expect(
      toAtwOptions(
        Object.fromEntries(parsed.options.map((o) => [o.key, o.default])),
      ),
    ).toEqual({
      in: 'single',
      out: 'single',
      bull: false,
      missEndsTurn: false,
      playOn: false,
    })
  })

  it('rejects unknown rules', () => {
    expect(() => toAtwOptions({ in: 'master', out: 'single' })).toThrow(
      RangeError,
    )
  })
})

describe('Around the World targets', () => {
  it('moves on one target for each single hit', () => {
    const { state } = play({}, ['S1', 'S2', 'S5'])

    expect(target(state, 'anna')).toBe(3)
    expect(state.lastTurn).toMatchObject({
      playerId: 'anna',
      from: 0,
      to: 2,
      result: 'advanced',
    })
    expect(currentThrower(state.turns)).toBe('oli')
  })

  it('ignores darts at other numbers', () => {
    const { state } = play({}, ['S20', 'T19', 'M'])

    expect(target(state, 'anna')).toBe(1)
    expect(state.lastTurn?.result).toBe('missed')
  })

  it('skips ahead 2 for a double and 3 for a treble', () => {
    const { state } = play({}, ['D1', 'T3', 'S6'])

    // 1 → 3 → 6 → 7
    expect(target(state, 'anna')).toBe(7)
    expect(state.stats.anna).toEqual({ darts: 3, hits: 3 })
  })

  it('never skips past the last target', () => {
    const { state } = play({}, [...climb(1, 18), 'T19'])

    expect(target(state, 'anna')).toBe(20)
    expect(aroundTheWorld.isOver(state)).toBe(false)
  })

  it('finishes on 20', () => {
    const { state, record } = play({}, [...climb(1, 19), 'S20'])

    expect(aroundTheWorld.isOver(state)).toBe(true)
    expect(record.result?.standings).toEqual(['anna', 'oli'])
    expect(state.lastTurn?.result).toBe('finished')
  })

  it('shows the turn in progress with how far each dart moved', () => {
    const { state } = play({}, ['D1', 'M'])

    expect(state.turnDarts).toEqual([d('D1'), d('M')])
    expect(state.turnSteps).toEqual([2, 0])
  })
})

describe('Around the World in and out rules', () => {
  it('needs a double 1 to start with double in', () => {
    const { state } = play({ in: 'double' }, ['S1', 'T1', 'D1'])

    expect(state.turns.board.anna.opened).toBe(true)
    // D1 opens and skips 2.
    expect(target(state, 'anna')).toBe(3)
    expect(state.stats.anna.hits).toBe(1)
  })

  it('counts any hit once in', () => {
    const { state } = play({ in: 'double' }, ['D1', 'S3', 'S4'])

    expect(target(state, 'anna')).toBe(5)
  })

  it('needs a double 20 to finish with double out', () => {
    const before = [...climb(1, 19)]
    const notYet = play({ out: 'double' }, [...before, 'S20', 'T20'])
    expect(aroundTheWorld.isOver(notYet.state)).toBe(false)
    expect(target(notYet.state, 'anna')).toBe(20)

    const done = play({ out: 'double' }, [...before, 'D20'])
    expect(aroundTheWorld.isOver(done.state)).toBe(true)
  })
})

describe('Around the World bull finish', () => {
  it('adds the bull after 20', () => {
    const { state } = play({ bull: true }, [...climb(1, 19), 'S20'])

    expect(aroundTheWorld.isOver(state)).toBe(false)
    expect(state.turns.board.anna.target).toBe(20)
  })

  it('caps a skip at the bull', () => {
    const { state } = play({ bull: true }, [...climb(1, 18), 'T19'])

    expect(state.turns.board.anna.target).toBe(20)
  })

  it('finishes on either bull with single out', () => {
    const outer = play({ bull: true }, [...climb(1, 20), 'S25'])
    expect(aroundTheWorld.isOver(outer.state)).toBe(true)
  })

  it('needs the bullseye with double out', () => {
    const before = climb(1, 20)

    const outer = play({ bull: true, out: 'double' }, [...before, 'S25'])
    expect(aroundTheWorld.isOver(outer.state)).toBe(false)

    const bullseye = play({ bull: true, out: 'double' }, [...before, 'D25'])
    expect(aroundTheWorld.isOver(bullseye.state)).toBe(true)
  })
})

describe('Around the World turns', () => {
  it('plays all 3 darts by default after a miss', () => {
    const { state } = play({}, ['M', 'S1'])

    expect(currentThrower(state.turns)).toBe('anna')
    expect(target(state, 'anna')).toBe(2)
  })

  it('ends the turn at the first miss when asked to', () => {
    const { state } = play({ missEndsTurn: true }, ['S1', 'S5'])

    expect(currentThrower(state.turns)).toBe('oli')
    expect(state.lastTurn).toMatchObject({
      darts: [d('S1'), d('S5')],
      result: 'advanced',
    })
    expect(state.stats.anna).toEqual({ darts: 2, hits: 1 })
  })

  it('plays on for places', () => {
    const slots = [...solo, { playerId: 'dagny' }]
    const darts: string[] = []
    // Anna goes round in 7 turns of trebles and singles; the others miss.
    const anna = ['T1', 'T4', 'T7', 'T10', 'T13', 'T16', 'S19', 'S20']
    for (let turn = 0; turn < 3; turn++) {
      darts.push(...anna.slice(turn * 3, turn * 3 + 3), 'M', 'M', 'M')
      darts.push('M', 'M', 'M')
    }
    const { state } = play({ playOn: true }, darts, slots)

    expect(state.turns.finished).toEqual(['anna'])
    expect(aroundTheWorld.isOver(state)).toBe(false)
    expect(currentThrower(state.turns)).toBe('oli')
    expect(aroundTheWorld.standings(state)).toEqual(['anna', 'oli', 'dagny'])
  })

  it('ranks unfinished sides by how far round they got', () => {
    const { state } = play({}, ['S1', 'M', 'M', 'S1', 'S2', 'S3'])

    expect(aroundTheWorld.standings(state)).toEqual(['oli', 'anna'])
  })

  it('shares a target in teams and rotates throwers', () => {
    const { state } = play(
      {},
      ['S1', 'S2', 'S3', 'M', 'M', 'M', 'S4'],
      [
        { playerId: 'anna', teamId: 'A' },
        { playerId: 'oli', teamId: 'B' },
        { playerId: 'dagny', teamId: 'A' },
      ],
    )

    expect(target(state, 'A')).toBe(5)
    expect(state.stats.dagny).toEqual({ darts: 1, hits: 1 })
    expect(currentThrower(state.turns)).toBe('dagny')
  })
})

const names: Record<string, string> = {
  anna: 'Anna',
  oli: 'Óli',
  dagny: 'Dagný',
}
const playerName = (id: string) => names[id]

describe('Around the World Scoreboard', () => {
  const { Scoreboard } = aroundTheWorld

  it('shows the target, the turn so far and every side', () => {
    const { state } = play({}, ['S1', 'S2', 'S3', 'M', 'D1'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(
      screen.getByRole('region', { name: 'Kastar: Óli' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('3')
    const slots = within(
      screen.getByRole('list', { name: 'Pílur í umferðinni' }),
    ).getAllByRole('listitem')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'Framhjá–',
      'D1+2',
      'Píla 3',
    ])
    const sides = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(sides[0]).toHaveTextContent('Annahittni 100% · 3 pílur4')
    expect(sides[1]).toHaveTextContent('Ólihittni 50% · 2 pílur3')
  })

  it('reports how the last turn went', () => {
    const { state } = play({}, ['S1', 'D2', 'M'])

    render(<Scoreboard state={state} playerName={playerName} />)

    expect(screen.getByRole('status')).toHaveTextContent('Anna: 1 → 4')
    expect(screen.getByRole('status')).toHaveTextContent('S1 D2 Framhjá')
  })

  it('says when a double is needed and names the bull', () => {
    const { state } = play({ in: 'double', bull: true, out: 'double' }, [])
    const { unmount } = render(
      <Scoreboard state={state} playerName={playerName} />,
    )
    expect(screen.getByText('Þarf D1')).toBeInTheDocument()
    expect(screen.getAllByText('ekki inni')).toHaveLength(2)
    unmount()

    const atBull = play({ bull: true, out: 'double' }, climb(1, 20)).state
    render(<Scoreboard state={atBull} playerName={playerName} />)
    expect(screen.getByTestId('remaining')).toHaveTextContent('Miðja')
    expect(screen.getByText('Þarf D25')).toBeInTheDocument()
  })
})

describe('Around the World Status and PlayerSummary', () => {
  it('names the targets, rules and round', () => {
    const { Status } = aroundTheWorld
    if (!Status) throw new Error('Around the World has a Status')
    const { state } = play({ bull: true, out: 'double' }, ['M', 'M', 'M'])

    const { container } = render(
      <Status state={state} playerName={playerName} />,
    )

    expect(container).toHaveTextContent('1–20 og miðja · Tvöfalt út · Umferð 1')
  })

  it('lists darts, hits and hit rate', () => {
    const { PlayerSummary } = aroundTheWorld
    if (!PlayerSummary) throw new Error('Around the World has a summary')
    const { state } = play({}, ['S1', 'M', 'S2', 'M'])

    const { container } = render(
      <PlayerSummary state={state} playerId="anna" />,
    )

    expect(container).toHaveTextContent('Pílur3Hittar pílur2Hittni67%')
  })
})
