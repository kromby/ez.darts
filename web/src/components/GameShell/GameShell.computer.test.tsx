import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRecord, PlayerSlot, ThrownDart } from '../../engine/game'
import { createGameRecord } from '../../engine/runner'
import { x01, type X01Options } from '../../games/x01/x01'
import { d } from '../../test/play'
import { seededRandom } from '../../test/seededRandom'
import GameShell from './GameShell'

const cpu = 'computer-hard-1'
const names: Record<string, string> = { anna: 'Anna', [cpu]: 'Tölva (erfið)' }
const DELAY = 900
const options: X01Options = {
  startScore: 501,
  in: 'single',
  out: 'double',
  playOn: false,
}

function renderGame(
  slots: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: cpu }],
  darts: ThrownDart[] = [],
) {
  const record = {
    ...createGameRecord(x01, {
      options,
      slots,
      configVersion: 1,
    }),
    darts,
  }
  const records: GameRecord<X01Options>[] = []
  render(
    <GameShell
      module={x01}
      record={record}
      playerName={(id) => names[id]}
      onPlayAgain={() => {}}
      onExit={() => {}}
      onRecord={(next) => records.push(next)}
      random={seededRandom(51)}
      computerDelay={DELAY}
    />,
  )
  return { last: () => records[records.length - 1] }
}

const pad = (name: string) => screen.getByRole('button', { name })
// fireEvent rather than userEvent, which waits on the fake clock.
const click = (button: HTMLElement) => fireEvent.click(button)
const remaining = () => screen.getByTestId('remaining').textContent
/** Lets the computer throw `darts` darts, one per delay. */
async function computerThrows(darts: number) {
  for (let i = 0; i < darts; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY)
    })
  }
}

describe('GameShell with a computer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays the computer’s turn one dart at a time', async () => {
    const { last } = renderGame()
    for (let i = 0; i < 3; i++) click(pad('Einfalt 20'))

    expect(screen.getByText('Kastar: Tölva (erfið)')).toBeInTheDocument()
    expect(screen.getByText('Tölva (erfið) kastar…')).toBeInTheDocument()
    expect(pad('Einfalt 20')).toBeDisabled()
    expect(pad('Framhjá')).toBeDisabled()
    expect(pad('Afturkalla')).toBeEnabled()

    await computerThrows(1)
    expect(last().darts).toHaveLength(4)
    expect(last().darts[3].playerId).toBe(cpu)
    await computerThrows(2)

    expect(last().darts).toHaveLength(6)
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
    expect(screen.queryByText('Tölva (erfið) kastar…')).not.toBeInTheDocument()
    expect(pad('Einfalt 20')).toBeEnabled()
  })

  it('takes back the computer’s darts with the last person’s dart', async () => {
    const { last } = renderGame()
    for (let i = 0; i < 3; i++) click(pad('Einfalt 20'))
    await computerThrows(3)

    click(pad('Afturkalla'))

    expect(last().darts).toHaveLength(2)
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
    expect(remaining()).toBe('461')
  })

  it('takes back a turn the computer is still throwing', async () => {
    const { last } = renderGame()
    for (let i = 0; i < 3; i++) click(pad('Einfalt 20'))
    await computerThrows(1)

    click(pad('Afturkalla'))
    await computerThrows(3)

    expect(last().darts).toHaveLength(2)
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
  })

  it('carries on the computer’s turn when a game is resumed', async () => {
    const thrown = (playerId: string, notation: string) => ({
      playerId,
      dart: d(notation),
    })
    const { last } = renderGame(undefined, [
      thrown('anna', 'S20'),
      thrown('anna', 'S20'),
      thrown('anna', 'S20'),
      thrown(cpu, 'T20'),
    ])
    await computerThrows(2)

    expect(last().darts).toHaveLength(6)
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
  })

  it('starts by itself when the computer throws first', async () => {
    const { last } = renderGame([{ playerId: cpu }, { playerId: 'anna' }])
    expect(pad('Afturkalla')).toBeDisabled()

    await computerThrows(3)

    expect(last().darts).toHaveLength(3)
    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
  })
})
