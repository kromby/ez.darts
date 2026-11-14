import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Player } from '../../players/player'
import ManagePlayers from './ManagePlayers'

const anna: Player = { id: 'anna', name: 'Anna', color: 'sky' }
const oli: Player = { id: 'oli', name: 'Óli', color: 'pink' }
const bjarni: Player = {
  id: 'bjarni',
  name: 'Bjarni',
  color: 'lime',
  archivedAt: '2026-11-01T20:00:00.000Z',
}
const removedAt = new Date('2026-11-14T20:00:00.000Z')

function setup(players: Player[] = [oli, anna, bjarni]) {
  const onSave = vi.fn<(player: Player) => void>()
  const onDone = vi.fn<() => void>()
  render(
    <ManagePlayers
      players={players}
      onSave={onSave}
      onDone={onDone}
      now={() => removedAt}
    />,
  )
  return { user: userEvent.setup(), onSave, onDone }
}

const list = () => screen.getByRole('list', { name: 'Breyta leikmönnum' })

describe('ManagePlayers', () => {
  it('lists players by name, with removed ones apart', () => {
    setup()

    expect(
      within(list())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['AAnna×', 'ÓÓli×'])
    const removed = screen.getByRole('region', { name: 'Fjarlægðir leikmenn' })
    expect(removed).toHaveTextContent('Bjarni')
  })

  it('says when there are no players', () => {
    setup([])

    expect(screen.getByText('Engir leikmenn enn.')).toBeInTheDocument()
  })

  it('adds a player with a colour', async () => {
    const { user, onSave } = setup()

    await user.click(screen.getByRole('button', { name: '+ Nýr leikmaður' }))
    const form = screen.getByRole('form', { name: 'Nýr leikmaður' })
    // The first colour nobody in play has; Bjarni's is free again.
    expect(within(form).getByRole('radio', { name: 'Ljósgrænn' })).toBeChecked()
    await user.type(within(form).getByLabelText('Nafn'), '  Dagný ')
    await user.click(within(form).getByRole('radio', { name: 'Fjólublár' }))
    await user.click(within(form).getByRole('button', { name: 'Vista' }))

    expect(onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'Dagný',
      color: 'violet',
    })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('renames and recolours a player', async () => {
    const { user, onSave } = setup()

    await user.click(screen.getByRole('button', { name: 'Breyta Anna' }))
    const form = screen.getByRole('form', { name: 'Breyta Anna' })
    expect(within(form).getByLabelText('Nafn')).toHaveValue('Anna')
    expect(within(form).getByRole('radio', { name: 'Himinblár' })).toBeChecked()
    await user.clear(within(form).getByLabelText('Nafn'))
    await user.type(within(form).getByLabelText('Nafn'), 'Anna Jóns')
    await user.click(within(form).getByRole('radio', { name: 'Rauður' }))
    await user.click(within(form).getByRole('button', { name: 'Vista' }))

    expect(onSave).toHaveBeenCalledWith({
      id: 'anna',
      name: 'Anna Jóns',
      color: 'red',
    })
  })

  it('keeps names unique, removed players included', async () => {
    const { user, onSave } = setup()

    await user.click(screen.getByRole('button', { name: 'Breyta Anna' }))
    const name = screen.getByLabelText('Nafn')
    const save = screen.getByRole('button', { name: 'Vista' })

    // Its own name is fine.
    await user.type(name, ' ')
    expect(save).toBeEnabled()

    await user.clear(name)
    await user.type(name, 'óli')
    expect(screen.getByText('Þetta nafn er þegar til')).toBeInTheDocument()
    expect(save).toBeDisabled()

    await user.clear(name)
    await user.type(name, 'Bjarni')
    expect(screen.getByText(/Fjarlægður leikmaður heitir þetta/)).toBeVisible()
    expect(save).toBeDisabled()

    await user.clear(name)
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Hætta við' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('removes a player after asking, keeping them as archived', async () => {
    const { user, onSave } = setup()

    await user.click(screen.getByRole('button', { name: 'Fjarlægja Óli' }))
    const confirm = screen.getByRole('group', { name: 'Óli' })
    expect(confirm).toHaveTextContent(
      'Fjarlægja Óli? Eldri leikir halda nafninu.',
    )
    await user.click(within(confirm).getByRole('button', { name: 'Hætta við' }))
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Fjarlægja Óli' }))
    await user.click(screen.getByRole('button', { name: 'Já, fjarlægja' }))
    expect(onSave).toHaveBeenCalledWith({
      ...oli,
      archivedAt: '2026-11-14T20:00:00.000Z',
    })
  })

  it('restores a removed player', async () => {
    const { user, onSave } = setup()

    await user.click(screen.getByRole('button', { name: 'Endurheimta Bjarni' }))

    expect(onSave).toHaveBeenCalledWith({
      id: 'bjarni',
      name: 'Bjarni',
      color: 'lime',
    })
  })

  it('goes back when done', async () => {
    const { user, onDone } = setup()

    await user.click(screen.getByRole('button', { name: 'Lokið' }))

    expect(onDone).toHaveBeenCalledOnce()
  })
})
