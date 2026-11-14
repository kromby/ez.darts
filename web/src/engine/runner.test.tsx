import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BULL, MISS, dart } from './dart'
import type { GameModule, GameResult, PlayerId, PlayerSlot } from './game'
import { createGameRecord, createGameRunner, replay } from './runner'

/** Trivial test game: take turns of 3 darts; first to the target wins. */
type RaceOptions = { target: number }
type RaceState = {
  target: number
  order: PlayerId[]
  scores: Record<PlayerId, number>
  turn: number
  dartsThrown: number
  winner: PlayerId | null
}

const race: GameModule<RaceOptions, RaceState> = {
  id: 'race',
  init: (options, slots) => ({
    target: options.target,
    order: slots.map((slot) => slot.playerId),
    scores: Object.fromEntries(slots.map((slot) => [slot.playerId, 0])),
    turn: 0,
    dartsThrown: 0,
    winner: null,
  }),
  applyDart(state, thrown) {
    const player = state.order[state.turn]
    const score = state.scores[player] + thrown.segment * thrown.multiplier
    const winner = score >= state.target ? player : null
    const endOfTurn = state.dartsThrown === 2 || winner !== null
    return {
      ...state,
      scores: { ...state.scores, [player]: score },
      turn: endOfTurn ? (state.turn + 1) % state.order.length : state.turn,
      dartsThrown: endOfTurn ? 0 : state.dartsThrown + 1,
      winner,
    }
  },
  isOver: (state) => state.winner !== null,
  currentThrower: (state) => state.order[state.turn],
  standings: (state) =>
    [...state.order].sort((a, b) => state.scores[b] - state.scores[a]),
  Scoreboard: ({ state }) => (
    <ul>
      {state.order.map((player) => (
        <li key={player}>
          {player}: {state.scores[player]}
        </li>
      ))}
    </ul>
  ),
}

const slots: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'bjarni' }]
const t20 = dart(20, 3)
const startedAt = new Date('2026-11-14T20:00:00Z')
const finishedAt = new Date('2026-11-14T20:05:00Z')

function newRunner(onFinish = vi.fn<(result: GameResult) => void>()) {
  const record = createGameRecord(race, {
    id: 'game-1',
    options: { target: 200 },
    slots,
    configVersion: 1,
    startedAt,
  })
  const runner = createGameRunner(race, record, {
    onFinish,
    now: () => finishedAt,
  })
  return { runner, onFinish }
}

function throwAll(runner: ReturnType<typeof newRunner>['runner'], n: number) {
  for (let i = 0; i < n; i++) runner.throwDart(t20)
}

describe('createGameRecord', () => {
  it('starts an empty game record for the module', () => {
    const { runner } = newRunner()

    expect(runner.getSnapshot().record).toEqual({
      id: 'game-1',
      game: 'race',
      configVersion: 1,
      options: { target: 200 },
      slots,
      darts: [],
      startedAt: '2026-11-14T20:00:00.000Z',
      result: null,
    })
  })

  it('generates an id when none is given', () => {
    const record = createGameRecord(race, {
      options: { target: 200 },
      slots,
      configVersion: 1,
    })

    expect(record.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('createGameRunner', () => {
  it('logs each dart with the player who threw it', () => {
    const { runner } = newRunner()

    throwAll(runner, 3)
    runner.throwDart(dart(BULL, 2))

    const { record, state } = runner.getSnapshot()
    expect(record.darts.map((thrown) => thrown.playerId)).toEqual([
      'anna',
      'anna',
      'anna',
      'bjarni',
    ])
    expect(record.darts[3].dart).toEqual({ segment: BULL, multiplier: 2 })
    expect(state.scores).toEqual({ anna: 180, bjarni: 50 })
  })

  it('runs a game to the end and emits the result once', () => {
    const { runner, onFinish } = newRunner()

    throwAll(runner, 3) // anna 180
    runner.throwDart(MISS) // bjarni
    runner.throwDart(MISS)
    runner.throwDart(MISS)
    runner.throwDart(t20) // anna 240, wins

    const result = {
      standings: ['anna', 'bjarni'],
      finishedAt: finishedAt.toISOString(),
    }
    expect(runner.getSnapshot().record.result).toEqual(result)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(result)
    expect(() => runner.throwDart(t20)).toThrow('already over')
  })

  it('undoes the last dart by replaying the log', () => {
    const { runner } = newRunner()
    throwAll(runner, 4)
    const afterThree = replay(race, {
      ...runner.getSnapshot().record,
      darts: runner.getSnapshot().record.darts.slice(0, 3),
    })

    expect(runner.undo()).toBe(true)

    const { record, state } = runner.getSnapshot()
    expect(record.darts).toHaveLength(3)
    expect(state).toEqual(afterThree)
    expect(race.currentThrower(state)).toBe('bjarni')
  })

  it('reopens a finished game when the winning dart is undone', () => {
    const { runner, onFinish } = newRunner()
    throwAll(runner, 3)
    runner.throwDart(MISS)
    runner.throwDart(MISS)
    runner.throwDart(MISS)
    runner.throwDart(t20)

    runner.undo()

    expect(runner.getSnapshot().record.result).toBeNull()
    expect(race.isOver(runner.getSnapshot().state)).toBe(false)

    runner.throwDart(t20)
    expect(onFinish).toHaveBeenCalledTimes(2)
  })

  it('does nothing when there is no dart to undo', () => {
    const { runner } = newRunner()
    const before = runner.getSnapshot()

    expect(runner.undo()).toBe(false)
    expect(runner.getSnapshot()).toBe(before)
  })

  it('rejects a dart that cannot be thrown', () => {
    const { runner } = newRunner()

    expect(() => runner.throwDart({ segment: BULL, multiplier: 3 })).toThrow(
      RangeError,
    )
    expect(runner.getSnapshot().record.darts).toHaveLength(0)
  })

  it('resumes a saved game from its record', () => {
    const { runner } = newRunner()
    throwAll(runner, 4)
    const saved = JSON.parse(JSON.stringify(runner.getSnapshot().record))

    const resumed = createGameRunner(race, saved)

    expect(resumed.getSnapshot().state).toEqual(runner.getSnapshot().state)
  })

  it('notifies subscribers with a new snapshot on every change', () => {
    const { runner } = newRunner()
    const listener = vi.fn<() => void>()
    const unsubscribe = runner.subscribe(listener)
    const first = runner.getSnapshot()

    runner.throwDart(t20)
    runner.undo()
    unsubscribe()
    runner.throwDart(t20)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(runner.getSnapshot()).not.toBe(first)
  })

  it("renders the module's scoreboard from the runner state", () => {
    const { runner } = newRunner()
    throwAll(runner, 3)
    const { Scoreboard } = race

    render(
      <Scoreboard state={runner.getSnapshot().state} playerName={(id) => id} />,
    )

    expect(screen.getByText('anna: 180')).toBeInTheDocument()
    expect(screen.getByText('bjarni: 0')).toBeInTheDocument()
  })
})
