import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../../players/player'
import type { HeadToHeadGrid, Meeting } from '../../stats/aggregate'
import type { HouseholdView } from '../../stats/householdView'
import { noCounts } from '../../stats/rows'
import { HeadToHeadCard } from './household'

const names = ['Anna', 'Björn', 'Dísa', 'Eva', 'Fríða', 'Gói', 'Hildur']

/** Everyone played everyone once; earlier in the list finished ahead. */
function viewOf(count: number): HouseholdView {
  const ids = names.slice(0, count).map((name) => name.toLowerCase())
  const headToHead: HeadToHeadGrid = new Map(
    ids.map((row, index) => [
      row,
      new Map<string, Meeting>(
        ids
          .filter((column) => column !== row)
          .map((column) => [
            column,
            { games: 1, ahead: index < ids.indexOf(column) ? 1 : 0 },
          ]),
      ),
    ]),
  )
  return {
    players: ids.map((playerId) => ({
      playerId,
      counts: { ...noCounts, games: 1 },
      average: null,
    })),
    headToHead,
  }
}

const playerOf = (id: string): Player => ({
  id,
  name: names.find((name) => name.toLowerCase() === id) ?? id,
})

describe('HeadToHeadCard', () => {
  it('is a grid for up to six players', () => {
    render(<HeadToHeadCard view={viewOf(6)} playerOf={playerOf} />)

    const card = screen.getByRole('region', { name: 'Innbyrðis' })
    expect(within(card).getAllByRole('row')).toHaveLength(7)
    expect(within(card).getByText('Oftar ofar')).toBeInTheDocument()
  })

  it('is a list per player above six', () => {
    render(<HeadToHeadCard view={viewOf(7)} playerOf={playerOf} />)

    const card = screen.getByRole('region', { name: 'Innbyrðis' })
    expect(within(card).queryByRole('table')).not.toBeInTheDocument()
    const anna = within(card).getAllByRole('listitem')[0]
    expect(within(anna).getAllByRole('listitem')).toHaveLength(6)
    expect(within(anna).getByText('ofar en Hildur')).toBeVisible()
    expect(anna).toHaveTextContent('ofar en Björn1/1100%')
  })

  it('puts the computers played after the people', () => {
    const view = viewOf(2)
    const hard = 'computer-hard'
    view.headToHead.get('anna')?.set(hard, { games: 3, ahead: 1 })
    view.headToHead.set(hard, new Map([['anna', { games: 3, ahead: 2 }]]))
    const withComputer = (id: string): Player =>
      id === hard ? { id, name: 'Tölva (erfið)' } : playerOf(id)
    render(<HeadToHeadCard view={view} playerOf={withComputer} />)

    const card = screen.getByRole('region', { name: 'Innbyrðis' })
    const rows = within(card).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('Tölva (erfið)')
    expect(
      within(rows[1]).getByTitle(
        'Anna endaði ofar en Tölva (erfið) í 1 af 3 sameiginlegum leikjum',
      ),
    ).toBeInTheDocument()
  })

  it('says when no two players met', () => {
    const view = viewOf(1)
    render(<HeadToHeadCard view={view} playerOf={playerOf} />)

    expect(
      screen.getByText('Enginn leikur við aðra á tímabilinu.'),
    ).toBeVisible()
  })
})
