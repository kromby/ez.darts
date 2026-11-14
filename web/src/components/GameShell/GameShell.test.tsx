import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSlot } from '../../engine/game'
import { createGameRecord } from '../../engine/runner'
import { x01, type X01Options } from '../../games/x01/x01'
import GameShell from './GameShell'

const names: Record<string, string> = {
  anna: 'Anna',
  oli: 'Óli',
  dagny: 'Dagný',
}

function renderGame(
  options: Partial<X01Options> = {},
  slots: PlayerSlot[] = [{ playerId: 'anna' }, { playerId: 'oli' }],
) {
  const record = createGameRecord(x01, {
    options: {
      startScore: 40,
      in: 'single',
      out: 'double',
      playOn: false,
      ...options,
    },
    slots,
    configVersion: 1,
  })
  const onPlayAgain = vi.fn<() => void>()
  const onExit = vi.fn<() => void>()
  render(
    <GameShell
      module={x01}
      record={record}
      playerName={(id) => names[id]}
      onPlayAgain={onPlayAgain}
      onExit={onExit}
    />,
  )
  return { user: userEvent.setup(), onPlayAgain, onExit }
}

const pad = (name: string) => screen.getByRole('button', { name })
const remaining = () => screen.getByTestId('remaining').textContent

describe('GameShell', () => {
  it('scores darts from the pad and passes the turn', async () => {
    const { user } = renderGame({ startScore: 501 })

    expect(
      screen.getByRole('heading', { name: '501 · Tvöfalt út · Umferð 1' }),
    ).toBeInTheDocument()
    expect(pad('Afturkalla')).toBeDisabled()

    await user.click(pad('Þrefalt'))
    await user.click(pad('Þrefalt 20'))
    expect(remaining()).toBe('441')

    await user.click(pad('Einfalt 1'))
    await user.click(pad('Framhjá'))

    expect(screen.getByText('Kastar: Óli')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Anna: 61')
    expect(remaining()).toBe('501')
  })

  it('undoes the last dart', async () => {
    const { user } = renderGame({ startScore: 501 })

    await user.click(pad('Einfalt 20'))
    await user.click(pad('Afturkalla'))

    expect(remaining()).toBe('501')
    expect(pad('Afturkalla')).toBeDisabled()
  })

  it('shows a bust and puts the score back', async () => {
    const { user } = renderGame()

    const hint = () => screen.getByText('Útskot').parentElement
    expect(hint()).toHaveTextContent('ÚtskotD20')
    await user.click(pad('Einfalt 20'))
    expect(hint()).toHaveTextContent('ÚtskotD10')
    await user.click(pad('Einfalt 19'))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Anna sprakk – aftur á 40',
    )
    expect(screen.getByText('Kastar: Óli')).toBeInTheDocument()
  })

  it('shows the results once the game is over', async () => {
    const { user, onPlayAgain, onExit } = renderGame()

    await user.click(pad('Tvöfalt'))
    await user.click(pad('Tvöfalt 20'))

    const winner = screen.getByRole('heading', { name: 'Anna vann!' })
    expect(winner).toHaveFocus()
    expect(screen.getByText(/1 píla ·/)).toBeInTheDocument()
    const places = within(
      screen.getByRole('list', { name: 'Úrslit' }),
    ).getAllByRole('listitem')
    expect(places[0]).toHaveTextContent('1.Anna')
    expect(places[0]).toHaveTextContent('Útskot40')
    expect(places[1]).toHaveTextContent('2.Óli')
    expect(
      screen.queryByRole('button', { name: 'Afturkalla' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Spila aftur' }))
    expect(onPlayAgain).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Nýr leikur' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('goes back into the game when the last dart is undone', async () => {
    const { user } = renderGame()

    await user.click(pad('Tvöfalt'))
    await user.click(pad('Tvöfalt 20'))
    await user.click(
      screen.getByRole('button', { name: 'Afturkalla síðustu pílu' }),
    )

    expect(screen.getByText('Kastar: Anna')).toBeInTheDocument()
    expect(remaining()).toBe('40')
  })

  it('plays on for places when asked to', async () => {
    const { user } = renderGame({ playOn: true }, [
      { playerId: 'anna' },
      { playerId: 'oli' },
      { playerId: 'dagny' },
    ])

    await user.click(pad('Tvöfalt'))
    await user.click(pad('Tvöfalt 20'))

    expect(screen.getByRole('status')).toHaveTextContent('Anna kláraði 40!')
    expect(screen.getByText('Kastar: Óli')).toBeInTheDocument()
  })

  it('asks before quitting from the menu', async () => {
    const { user, onExit } = renderGame()

    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    expect(
      screen.getByText('Hætta í þessum leik? Hann verður ekki vistaður.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Halda áfram' }))
    expect(
      screen.queryByRole('group', { name: 'Valmynd' }),
    ).not.toBeInTheDocument()
    expect(onExit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('group', { name: 'Valmynd' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.click(screen.getByRole('button', { name: 'Hætta leik' }))
    await user.click(screen.getByRole('button', { name: 'Já, hætta' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('switches language from the menu', async () => {
    const { user } = renderGame()

    await user.click(screen.getByRole('button', { name: 'Valmynd' }))
    await user.selectOptions(screen.getByLabelText('Tungumál'), 'English')

    expect(screen.getByText('Throwing: Anna')).toBeInTheDocument()
  })
})
