import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { dart } from '../../engine/dart'
import type { GameRecord } from '../../engine/game'
import { x01 } from '../../games/x01/x01'
import { gameStarter } from './startGame'

const starter = gameStarter(x01)
const setup = {
  options: { startScore: 301, in: 'single', out: 'double', playOn: false },
  slots: [{ playerId: 'anna' }],
  configVersion: 1,
}
const callbacks = {
  playerName: (id: string) => id,
  onPlayAgain: () => {},
  onExit: () => {},
}

describe('gameStarter', () => {
  it('saves the record at the start and after every dart', async () => {
    const user = userEvent.setup()
    const onRecord = vi.fn<(record: GameRecord<unknown>) => void>()
    const game = starter.start(setup)

    render(game.render({ ...callbacks, onRecord }))
    expect(onRecord).toHaveBeenLastCalledWith(game.record)

    await user.click(screen.getByRole('button', { name: 'Einfalt 20' }))
    expect(onRecord.mock.lastCall?.[0].darts).toEqual([
      { playerId: 'anna', dart: dart(20, 1) },
    ])
  })

  it('resumes a saved game where it was', () => {
    const saved: GameRecord<unknown> = {
      ...starter.start(setup).record,
      darts: [{ playerId: 'anna', dart: dart(20, 3) }],
    }

    render(starter.resume(saved).render(callbacks))

    expect(screen.getByTestId('remaining')).toHaveTextContent('241')
  })

  it("refuses another game's record or one that can't be replayed", () => {
    const record = starter.start(setup).record

    expect(() => starter.resume({ ...record, game: 'killer' })).toThrow(
      'A killer game is not x01',
    )
    expect(() =>
      starter.resume({
        ...record,
        darts: [{ playerId: 'anna', dart: { segment: 30, multiplier: 1 } }],
      }),
    ).toThrow('Invalid dart')
  })
})
