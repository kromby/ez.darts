import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerSlot } from '../../engine/game'
import { createPlayer, type Player } from '../../players/player'
import PlayerSelection from './PlayerSelection'

const household: Player[] = [
  { id: 'anna', name: 'Anna' },
  { id: 'bjarni', name: 'Bjarni' },
  { id: 'dagny', name: 'Dagný' },
  { id: 'oli', name: 'Óli' },
]

type Options = {
  players?: Player[]
  teamsSupported?: boolean
  initial?: PlayerSlot[]
  random?: () => number
}

function setup({
  players = household,
  teamsSupported = true,
  initial,
  random,
}: Options = {}) {
  const onContinue = vi.fn<(slots: PlayerSlot[]) => void>()
  const user = userEvent.setup()

  function Harness() {
    const [list, setList] = useState(players)
    return (
      <PlayerSelection
        players={list}
        teamsSupported={teamsSupported}
        initial={initial}
        random={random}
        onAddPlayer={(name) => {
          const player = createPlayer(name)
          setList((current) => [...current, player])
          return player
        }}
        onContinue={onContinue}
      />
    )
  }

  render(<Harness />)
  return { onContinue, user }
}

function order() {
  const list = screen.queryByRole('list', { name: 'Kaströð' })
  if (!list) return []
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[class*="name"]')?.textContent)
}

const continueButton = () => screen.getByRole('button', { name: 'Áfram' })

describe('PlayerSelection', () => {
  it('picks players from the list in the order they are tapped', async () => {
    const { onContinue, user } = setup()
    expect(screen.getByText('Engir leikmenn valdir enn.')).toBeInTheDocument()
    expect(continueButton()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Bæta Óli í leikinn' }))
    await user.click(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    )

    expect(order()).toEqual(['Óli', 'Anna'])
    expect(
      screen.queryByRole('button', { name: 'Bæta Óli í leikinn' }),
    ).not.toBeInTheDocument()

    await user.click(continueButton())
    expect(onContinue).toHaveBeenCalledWith([
      { playerId: 'oli' },
      { playerId: 'anna' },
    ])
  })

  it('takes a player back out of the game', async () => {
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    )
    await user.click(screen.getByRole('button', { name: 'Bæta Óli í leikinn' }))

    await user.click(
      screen.getByRole('button', { name: 'Taka Anna úr leiknum' }),
    )

    expect(order()).toEqual(['Óli'])
    expect(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    ).toBeInTheDocument()
  })

  it('adds a new player inline and puts them in the game', async () => {
    const { onContinue, user } = setup({ players: [] })
    const input = screen.getByLabelText('Nýr leikmaður')
    const add = screen.getByRole('button', { name: 'Bæta við' })
    expect(add).toBeDisabled()

    await user.type(input, '  Jón  Páll {Enter}')

    expect(order()).toEqual(['Jón Páll'])
    expect(input).toHaveValue('')

    await user.type(input, 'jón páll')
    expect(screen.getByText('Þetta nafn er þegar til')).toBeInTheDocument()
    expect(add).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'Gunna')
    await user.click(add)
    await user.click(continueButton())

    expect(order()).toEqual(['Jón Páll', 'Gunna'])
    expect(onContinue.mock.lastCall?.[0]).toHaveLength(2)
  })

  it('shuffles the order', async () => {
    const { user } = setup({ random: () => 0 })
    for (const name of ['Anna', 'Bjarni', 'Dagný']) {
      await user.click(
        screen.getByRole('button', { name: `Bæta ${name} í leikinn` }),
      )
    }

    await user.click(screen.getByRole('button', { name: 'Handahófsröð' }))

    expect(order()).toEqual(['Bjarni', 'Dagný', 'Anna'])
  })

  it('needs two players before shuffling', async () => {
    const { user } = setup()
    const random = screen.getByRole('button', { name: 'Handahófsröð' })
    expect(random).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    )
    expect(random).toBeDisabled()
  })

  it('splits players into teams and lets them be moved', async () => {
    const { onContinue, user } = setup()
    for (const name of ['Anna', 'Bjarni', 'Dagný', 'Óli']) {
      await user.click(
        screen.getByRole('button', { name: `Bæta ${name} í leikinn` }),
      )
    }

    await user.click(screen.getByRole('switch', { name: 'Spila í liðum' }))

    const teamOf = (name: string) =>
      screen.getByRole('radiogroup', { name: `Lið fyrir ${name}` })
    expect(
      within(teamOf('Anna')).getByRole('radio', { name: 'Lið A' }),
    ).toBeChecked()
    expect(
      within(teamOf('Bjarni')).getByRole('radio', { name: 'Lið B' }),
    ).toBeChecked()

    await user.click(
      within(teamOf('Óli')).getByRole('radio', { name: 'Lið C' }),
    )
    await user.click(continueButton())

    expect(onContinue).toHaveBeenCalledWith([
      { playerId: 'anna', teamId: 'A' },
      { playerId: 'bjarni', teamId: 'B' },
      { playerId: 'dagny', teamId: 'A' },
      { playerId: 'oli', teamId: 'C' },
    ])
  })

  it('blocks continuing until players are in two teams', async () => {
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    )
    await user.click(screen.getByRole('button', { name: 'Bæta Óli í leikinn' }))
    await user.click(screen.getByRole('switch', { name: 'Spila í liðum' }))

    await user.click(
      within(
        screen.getByRole('radiogroup', { name: 'Lið fyrir Óli' }),
      ).getByRole('radio', { name: 'Lið A' }),
    )

    expect(
      screen.getByText('Settu leikmenn í að minnsta kosti tvö lið'),
    ).toBeInTheDocument()
    expect(continueButton()).toBeDisabled()
  })

  it('hides teams for games without them', () => {
    setup({ teamsSupported: false })

    expect(
      screen.queryByRole('switch', { name: 'Spila í liðum' }),
    ).not.toBeInTheDocument()
  })

  it('starts from an earlier choice', async () => {
    const { onContinue, user } = setup({
      initial: [
        { playerId: 'oli', teamId: 'B' },
        { playerId: 'anna', teamId: 'A' },
      ],
    })

    expect(order()).toEqual(['Óli', 'Anna'])
    expect(screen.getByRole('switch', { name: 'Spila í liðum' })).toBeChecked()

    await user.click(continueButton())
    expect(onContinue).toHaveBeenCalledWith([
      { playerId: 'oli', teamId: 'B' },
      { playerId: 'anna', teamId: 'A' },
    ])
  })

  it('gives every selected player a drag handle', async () => {
    const { user } = setup()
    await user.click(
      screen.getByRole('button', { name: 'Bæta Anna í leikinn' }),
    )

    expect(
      screen.getByRole('button', { name: 'Færa Anna' }),
    ).toBeInTheDocument()
  })
})
