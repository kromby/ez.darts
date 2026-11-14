import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gameStarter } from '../../components/GameShell/startGame'
import { parseGameConfig } from '../../engine/config'
import { MISS, dart, type Dart } from '../../engine/dart'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord, createGameRunner } from '../../engine/runner'
import { currentThrower } from '../../engine/turns'
import config from './config.json'
import {
  isKiller,
  killer,
  toKillerOptions,
  turnResult,
  type KillerOptions,
  type KillerState,
} from './killer'

/** `T20`, `D16`, `S5`, `S25` (outer bull) or `M` (miss). */
function d(notation: string): Dart {
  if (notation === 'M') return MISS
  const multiplier = { S: 1, D: 2, T: 3 }[notation[0]] as 1 | 2 | 3
  return dart(Number(notation.slice(1)), multiplier)
}

const duo: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }]
const trio: PlayerSlot[] = [...duo, { playerId: 'dagny' }]
const numbers = { anna: 20, oli: 19, dagny: 18 }

function play(
  options: Partial<KillerOptions>,
  darts: string[],
  slots: PlayerSlot[] = duo,
) {
  const record = createGameRecord(killer, {
    options: {
      assign: 'random',
      mode: 'lives',
      hitsToKiller: 3,
      lives: 3,
      selfHit: false,
      numbers,
      ...options,
    },
    slots,
    configVersion: 1,
  })
  const runner = createGameRunner(killer, record)
  for (const notation of darts) runner.throwDart(d(notation))
  return runner.getSnapshot()
}

const player = (state: KillerState, id: string) => state.turns.board[id]
const miss3 = ['M', 'M', 'M']

describe('Killer config', () => {
  it('parses, with random numbers, 3 hits to killer and 3 lives', () => {
    const parsed = parseGameConfig(config)
    expect(parsed.id).toBe(killer.id)
    expect(parsed.teams).toBe(false)
    expect(
      toKillerOptions(
        Object.fromEntries(parsed.options.map((o) => [o.key, o.default])),
      ),
    ).toEqual({
      assign: 'random',
      mode: 'lives',
      hitsToKiller: 3,
      lives: 3,
      selfHit: false,
      numbers: null,
    })
  })

  it('rejects unknown rules', () => {
    const valid = { assign: 'random', mode: 'lives', hitsToKiller: 3, lives: 3 }
    expect(() => toKillerOptions({ ...valid, assign: 'auction' })).toThrow(
      RangeError,
    )
    expect(() => toKillerOptions({ ...valid, mode: 'points' })).toThrow(
      RangeError,
    )
    expect(() => toKillerOptions({ ...valid, lives: 0 })).toThrow(RangeError)
  })
})

describe('Killer number assignment', () => {
  const options = toKillerOptions({
    assign: 'random',
    mode: 'lives',
    hitsToKiller: 3,
    lives: 3,
  })

  it('draws a different number from 1 to 20 for each player at random', () => {
    const slots = Array.from({ length: 20 }, (_, index) => ({
      playerId: `p${index}`,
    }))
    let seed = 0.37
    const random = () => (seed = (seed * 9301 + 0.49297) % 1)

    const drawn = Object.values(
      killer.prepare?.(options, slots, random).numbers ?? {},
    )

    expect([...drawn].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    )
  })

  it('gives each player their drawn number', () => {
    const prepared = killer.prepare?.(options, duo, () => 0)
    // Always the first number left: 1, then 2.
    expect(prepared?.numbers).toEqual({ anna: 1, oli: 2 })

    const state = killer.init(prepared ?? options, duo)
    expect(player(state, 'anna').number).toBe(1)
    expect(player(state, 'oli').number).toBe(2)
  })

  it('needs the numbers drawn before a random game starts', () => {
    expect(() => killer.init(options, duo)).toThrow(RangeError)
    expect(() =>
      killer.init({ ...options, numbers: { anna: 5, oli: 5 } }, duo),
    ).toThrow(RangeError)
  })

  it('draws again for each new game', () => {
    const starter = gameStarter(killer)
    const game = starter.start({
      options: { assign: 'random', mode: 'lives', hitsToKiller: 3, lives: 3 },
      slots: trio,
      configVersion: 1,
    })
    const first = game.record.options as KillerOptions
    expect(Object.keys(first.numbers ?? {})).toEqual(['anna', 'oli', 'dagny'])
    const again = game.again().record.options as KillerOptions
    expect(Object.keys(again.numbers ?? {})).toEqual(['anna', 'oli', 'dagny'])
    expect(new Set(Object.values(again.numbers ?? {})).size).toBe(3)
  })

  it.each(['choose', 'throw'] as const)(
    'claims numbers with darts when players %s them',
    (assign) => {
      const before = play({ assign, numbers: null }, ['S7', 'D7'])
      expect(player(before.state, 'anna').number).toBe(7)
      expect(before.state.lastClaim).toMatchObject({
        playerId: 'oli',
        result: 'taken',
      })
      expect(killer.currentThrower(before.state)).toBe('oli')

      const { state } = play({ assign, numbers: null }, [
        'S7',
        'D7',
        'M',
        'S25',
        'T12',
      ])
      expect(state.lastClaim).toMatchObject({
        playerId: 'oli',
        result: 'claimed',
      })
      expect(player(state, 'oli').number).toBe(12)
      // Then the game starts with the first player, no darts counted yet.
      expect(killer.currentThrower(state)).toBe('anna')
      expect(state.turns.dartsThrown).toBe(0)
      expect(state.stats.anna.darts).toBe(0)
      expect(state.stats.oli.darts).toBe(0)
    },
  )

  it('rethrows on a miss or the bull', () => {
    const { state } = play({ assign: 'throw', numbers: null }, ['M', 'D25'])

    expect(state.lastClaim?.result).toBe('missed')
    expect(player(state, 'anna').number).toBeNull()
    expect(killer.currentThrower(state)).toBe('anna')
  })
})

describe('Killer: becoming a killer', () => {
  it('counts hits on your own number by the multiplier', () => {
    const { state } = play({}, ['S20', 'D20'])

    expect(player(state, 'anna').hits).toBe(3)
    expect(isKiller(state.options, player(state, 'anna'))).toBe(true)
    expect(state.turn?.effects).toEqual([1, 2])
  })

  it('caps the hits at what is needed', () => {
    const { state } = play({ hitsToKiller: 2 }, ['T20', 'S20', 'M'])

    expect(player(state, 'anna').hits).toBe(2)
    expect(state.lastTurn?.effects).toEqual([2, 0, 0])
    expect(state.lastTurn && turnResult(state.lastTurn)).toBe('killer')
  })

  it("ignores other players' numbers until you are a killer", () => {
    const { state } = play({}, ['T19', 'S19', 'M'])

    expect(player(state, 'oli').lives).toBe(3)
    expect(state.lastTurn && turnResult(state.lastTurn)).toBe('missed')
  })

  it('has your number as the hint, then the numbers to aim for', () => {
    expect(killer.hint?.(play({}, []).state)).toBe('20')
    const { state } = play({}, ['T20', 'M'], trio)
    expect(killer.hint?.(state)).toBe('19 · 18')
  })
})

describe('Killer lives mode', () => {
  it('takes lives by the multiplier and puts a player out at 0', () => {
    const halfway = play({}, ['T20', 'M', 'M', ...miss3, 'D19'])
    expect(player(halfway.state, 'oli').lives).toBe(1)
    expect(killer.isOver(halfway.state)).toBe(false)

    const { state, record } = play({}, [
      'T20',
      'M',
      'M',
      ...miss3,
      'D19',
      'S19',
    ])
    expect(state.turns.eliminated).toEqual(['oli'])
    expect(killer.isOver(state)).toBe(true)
    expect(record.result?.standings).toEqual(['anna', 'oli'])
    expect(state.stats.anna).toEqual({ darts: 5, taken: 3, knockouts: 1 })
  })

  it('skips players who are out and plays on until one is left', () => {
    const { state } = play({}, ['T20', 'T19', 'S18'], trio)

    expect(state.turns.eliminated).toEqual(['oli'])
    expect(player(state, 'dagny').lives).toBe(2)
    expect(killer.isOver(state)).toBe(false)
    expect(currentThrower(state.turns)).toBe('dagny')
    expect(state.lastTurn?.knockouts).toEqual(['oli'])
    expect(state.lastTurn && turnResult(state.lastTurn)).toBe('knockout')
    expect(
      killer.hint?.({ ...state, turns: { ...state.turns, current: 0 } }),
    ).toBe('18')
  })

  it('ranks players still in by lives, then the last out first', () => {
    const { state } = play(
      {},
      ['T20', 'T19', 'S18', ...miss3, 'S18', 'S18'],
      trio,
    )

    expect(killer.isOver(state)).toBe(true)
    expect(killer.standings(state)).toEqual(['anna', 'dagny', 'oli'])
  })

  it('lets a killer hit another killer', () => {
    const { state } = play({}, ['T20', 'M', 'M', 'T19', 'D20', 'M'])

    expect(player(state, 'anna').lives).toBe(1)
    expect(state.stats.oli.taken).toBe(2)
  })
})

describe('Killer hits mode', () => {
  it('takes hits, and a hit with none left puts a player out', () => {
    const start = ['T20', 'M', 'M', 'D19', 'M', 'M']

    const atZero = play({ mode: 'hits' }, [...start, 'D19'])
    expect(player(atZero.state, 'oli').hits).toBe(0)
    expect(killer.isOver(atZero.state)).toBe(false)

    const out = play({ mode: 'hits' }, [...start, 'D19', 'S19'])
    expect(out.state.turns.eliminated).toEqual(['oli'])
    expect(killer.isOver(out.state)).toBe(true)
  })

  it('puts a player with no hits out at the first hit', () => {
    const { state } = play({ mode: 'hits' }, ['T20', 'S19'])

    expect(state.turns.eliminated).toEqual(['oli'])
  })

  it('stops a killer being one when their hits are taken', () => {
    const { state } = play({ mode: 'hits' }, ['T20', 'M', 'M', 'T19', 'S20'])

    expect(player(state, 'anna').hits).toBe(2)
    expect(isKiller(state.options, player(state, 'anna'))).toBe(false)
  })

  it('ranks players still in by hits', () => {
    const { state } = play(
      { mode: 'hits' },
      ['T20', 'M', 'M', 'S19', 'M', 'M', 'S18', 'M', 'M'],
      trio,
    )
    expect(killer.standings(state)).toEqual(['anna', 'oli', 'dagny'])
  })
})

describe('Killer self-hits', () => {
  it('ignores a killer hitting their own number by default', () => {
    const { state } = play({}, ['T20', 'S20'])

    expect(player(state, 'anna').lives).toBe(3)
    expect(state.turn?.effects).toEqual([3, 0])
  })

  it('costs a life with self-hit on', () => {
    const { state } = play({ selfHit: true }, ['T20', 'D20'])

    expect(player(state, 'anna').lives).toBe(1)
    expect(state.turn?.effects).toEqual([3, -2])
  })

  it('costs hits in hits mode', () => {
    const { state } = play({ selfHit: true, mode: 'hits' }, ['T20', 'S20'])

    expect(player(state, 'anna').hits).toBe(2)
  })

  it('ends the turn when you put yourself out', () => {
    const { state } = play(
      { selfHit: true },
      ['T20', 'M', 'M', ...miss3, ...miss3, 'T20'],
      trio,
    )

    expect(state.turns.eliminated).toEqual(['anna'])
    expect(currentThrower(state.turns)).toBe('oli')
    expect(state.turn).toBeNull()
    expect(state.lastTurn?.knockouts).toEqual(['anna'])
  })

  it('hands the win to the other player', () => {
    const { record } = play({ selfHit: true }, ['T20', 'D20', 'S20'])

    expect(record.result?.standings).toEqual(['oli', 'anna'])
  })
})

describe('Killer solo', () => {
  it('ends when the player becomes a killer', () => {
    const solo = [{ playerId: 'anna' }]
    expect(killer.isOver(play({}, ['D20'], solo).state)).toBe(false)
    expect(killer.isOver(play({}, ['D20', 'S20'], solo).state)).toBe(true)
  })
})

const names: Record<string, string> = {
  anna: 'Anna',
  oli: 'Óli',
  dagny: 'Dagný',
}
const playerName = (id: string) => names[id]

describe('Killer Scoreboard', () => {
  const { Scoreboard } = killer
  const show = (state: KillerState) =>
    render(
      <Scoreboard
        state={state}
        playerName={playerName}
        hint={killer.hint?.(state) ?? null}
      />,
    )

  it("shows the thrower's number, the turn and every player", () => {
    const { state } = play({}, ['T20', 'D19'])

    show(state)

    expect(
      screen.getByRole('region', { name: 'Kastar: Anna' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('20')
    expect(screen.getByText('Skotmörk').parentElement).toHaveTextContent(
      'Skotmörk19',
    )
    const slots = within(
      screen.getByRole('list', { name: 'Pílur í umferðinni' }),
    ).getAllByRole('listitem')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'T20+3',
      'D19−2',
      'Píla 3',
    ])
    const sides = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(sides[0]).toHaveTextContent('Killer')
    expect(sides[0]).toHaveTextContent('3 líf')
    expect(sides[0]).toHaveTextContent('hitt 3/3 · 2 pílurKiller 20')
    expect(sides[1]).toHaveTextContent('♥1')
    expect(sides[1]).not.toHaveTextContent('Killer')
  })

  it('reports how the last turn went', () => {
    const killerTurn = play({}, ['T20', 'D19', 'M']).state
    const { unmount } = show(killerTurn)
    expect(screen.getByRole('status')).toHaveTextContent('Anna er killer!')
    expect(screen.getByRole('status')).toHaveTextContent('T20 D19 Framhjá')
    unmount()

    const knockout = play({}, ['T20', 'T19', 'M'], trio).state
    show(knockout)
    expect(screen.getByRole('status')).toHaveTextContent('Úr leik: Óli')
    const sides = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(sides[1]).toHaveTextContent('Úti')
  })

  it('shows hits instead of lives in hits mode', () => {
    const { state } = play({ mode: 'hits' }, ['D20'])

    show(state)

    expect(screen.queryByText('Líf')).not.toBeInTheDocument()
    expect(screen.getByText('Hittu')).toBeInTheDocument()
    const sides = within(
      screen.getByRole('list', { name: 'Staðan' }),
    ).getAllByRole('listitem')
    expect(sides[0]).toHaveTextContent('2/3')
  })

  it('asks each player for a number before the game', () => {
    const choose = play({ assign: 'choose', numbers: null }, []).state
    const { unmount } = show(choose)
    expect(
      screen.getByRole('region', { name: 'Anna velur tölu' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('remaining')).toHaveTextContent('?')
    expect(screen.getByText('Ýttu á lausa tölu')).toBeInTheDocument()
    unmount()

    const thrown = play({ assign: 'throw', numbers: null }, ['S7', 'D7']).state
    show(thrown)
    expect(
      screen.getByRole('region', { name: 'Óli kastar um tölu' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Kastaðu með veikari hendi')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '7 er frátekin – aftur',
    )
  })
})

describe('Killer Status and PlayerSummary', () => {
  const { Status, PlayerSummary } = killer
  if (!Status || !PlayerSummary) throw new Error('Killer has both')

  it('names the rules and round', () => {
    const { container, unmount } = render(
      <Status state={play({}, miss3).state} playerName={playerName} />,
    )
    expect(container).toHaveTextContent('3 líf · 3 hitt í killer · Umferð 1')
    unmount()

    const hits = play(
      { mode: 'hits', selfHit: true, assign: 'choose', numbers: null },
      [],
    )
    const { container: claiming } = render(
      <Status state={hits.state} playerName={playerName} />,
    )
    expect(claiming).toHaveTextContent(
      'Killer tekur hitt · 3 hitt í killer · eigin tala kostar · Leikmenn velja tölur',
    )
  })

  it('lists darts, what was taken and knockouts', () => {
    const { state } = play({}, ['T20', 'T19', 'M'], trio)

    const { container } = render(
      <PlayerSummary state={state} playerId="anna" />,
    )

    expect(container).toHaveTextContent('Pílur3Tekið af öðrum3Felldir1')
  })
})
