import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GameRecord } from '../../engine/game'
import type { Player } from '../../players/player'
import games from '../../stats/fixtures/games.json'
import rows from '../../stats/fixtures/rows.json'
import { createApiStore } from '../../storage/apiStore'
import { createMemoryStore } from '../../storage/memoryStore'
import type { DataStore } from '../../storage/store'
import StatsScreen from './StatsScreen'

const players: Player[] = [
  { id: 'anna', name: 'Anna', color: 'pink' },
  { id: 'bjorn', name: 'Björn', color: 'sky' },
  { id: 'oli', name: 'Óli', color: 'lime' },
]
// Saturday of 2026-W46; the last 12 weeks start in W35.
const now = () => new Date('2026-11-14T12:00:00Z')

/** A guest: the fixture games on the device. */
async function guestStore(): Promise<DataStore> {
  const store = createMemoryStore()
  for (const game of games as GameRecord<unknown>[]) await store.games.put(game)
  return store
}

/** A household: the API's rows for the same games (see SharedStatsFixtureTests). */
function householdStore(): Promise<DataStore> {
  const fetch = vi.fn<typeof globalThis.fetch>((input) =>
    Promise.resolve(
      Response.json(String(input).endsWith('/stats') ? rows : games),
    ),
  )
  return Promise.resolve(
    createApiStore({ settings: createMemoryStore().settings, fetch }),
  )
}

function setup(store: DataStore, list = players) {
  const onBack = vi.fn<() => void>()
  render(<StatsScreen store={store} players={list} onBack={onBack} now={now} />)
  return { onBack, user: userEvent.setup() }
}

const card = (name: string) => screen.getByRole('region', { name })
const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)

describe.each([
  ['a guest', guestStore],
  ['a household', householdStore],
])('StatsScreen for %s', (_, open) => {
  it("shows the first player's last 12 weeks", async () => {
    setup(await open())

    const hero = await screen.findByRole('region', { name: 'Vinningshlutfall' })
    expect(screen.getByRole('button', { name: 'Anna' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '12 vikur' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // W40, W45 and W46: four games, three of them against others.
    expect(within(hero).getByText('67%')).toBeVisible()
    expect(within(hero).getByText('2 sigrar í 3 leikjum')).toBeVisible()
    expect(within(hero).getByText('Leikir').nextSibling).toHaveTextContent('4')
    expect(within(hero).getAllByText('áður 0')).toHaveLength(2)
    expect(within(hero).getByText('Pílur').nextSibling).toHaveTextContent('15')

    const mix = card('Hvar pílurnar lenda')
    expect(within(mix).getByText('Þrefalt · 9 pílur')).toBeVisible()
    expect(within(mix).getByText('60,0%')).toBeVisible()

    const rivals = card('Innbyrðis')
    expect(within(rivals).getByText('á móti Óli')).toBeVisible()
    expect(
      within(rivals).getByText('2 af 3 sameiginlegum leikjum'),
    ).toBeVisible()

    const byGame = within(card('Eftir leikjum')).getAllByRole('row')
    expect(within(byGame[1]).getByRole('rowheader')).toHaveTextContent('x01')
    expect(cells(byGame[1])).toEqual(['3', '1', '50%', 'meðalt. 69,0'])
    expect(cells(byGame[2])).toEqual(['1', '1', '100%', '8 pílur'])

    const recent = within(card('Nýjustu leikir')).getAllByRole('listitem')
    expect(recent).toHaveLength(4)
    expect(recent[0]).toHaveTextContent('x01 · 60')
    expect(recent[0]).toHaveTextContent('Æfing')
    expect(recent[1]).toHaveTextContent('3.')
    expect(recent[1]).toHaveTextContent('á móti Óli, Björn')
  })

  it('follows the player, period and game picked', async () => {
    const { user } = setup(await open())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    await user.click(screen.getByRole('button', { name: 'Óli' }))
    await user.click(screen.getByRole('button', { name: 'Allt' }))
    await user.selectOptions(screen.getByLabelText('Leikur'), 'x01')

    const hero = card('Vinningshlutfall')
    // x01 in all time: 3 games, won fixture-2.
    expect(within(hero).getByText('1 sigrar í 3 leikjum')).toBeVisible()
    expect(within(hero).queryByText(/áður/)).not.toBeInTheDocument()
    expect(within(card('Eftir leikjum')).getAllByRole('row')).toHaveLength(2)
    expect(
      within(card('Innbyrðis')).getByText('1 af 3 sameiginlegum leikjum'),
    ).toBeVisible()
  })

  it('compares everyone on the household view', async () => {
    const { user } = setup(await open())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    await user.click(screen.getByRole('button', { name: 'Heimilið' }))

    expect(screen.getByRole('button', { name: 'Heimilið' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Anna' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const ratios = within(card('Vinningshlutfall')).getAllByRole('listitem')
    expect(ratios.map((line) => line.textContent)).toEqual([
      'AAnna 2 sigrar í 3 leikjum67%',
      'ÓÓli 1 sigrar í 3 leikjum33%',
      'BBjörn 0 sigrar í 1 leik0%',
    ])

    // Row player against column player: Anna, Óli, Björn.
    const grid = within(card('Innbyrðis'))
    const anna = grid.getByRole('rowheader', { name: 'Anna' })
    expect(cells(anna.closest('tr') as HTMLElement)).toEqual([
      '—',
      '67%2/3',
      '0%0/1',
    ])
    expect(
      grid.getByTitle('Anna endaði ofar en Óli í 2 af 3 sameiginlegum leikjum'),
    ).toHaveTextContent('67%')
    expect(
      grid.getByTitle('Björn endaði ofar en Anna í 1 af 1 sameiginlegum leik'),
    ).toHaveTextContent('100%')
    expect(
      grid.getAllByRole('columnheader').map((th) => th.textContent),
    ).toEqual(['AAnna', 'ÓÓli', 'BBjörn'])

    // 161 points in 7 darts, 103 in 5, 41 in 2.
    const averages = within(card('x01 meðaltal (3 pílur)')).getAllByRole(
      'listitem',
    )
    expect(averages.map((line) => line.textContent)).toEqual([
      'AAnna69,0',
      'ÓÓli61,8',
      'BBjörn61,5',
    ])

    const mix = within(card('Tvöföld og þreföld')).getAllByRole('row')
    expect(mix.slice(1).map((row) => row.textContent)).toEqual([
      'Björn50,0%50,0%0,0%',
      'Óli9,1%9,1%63,6%',
      'Anna6,7%60,0%0,0%',
    ])
  })

  it('leaves the x01 average off the household view for other games', async () => {
    const { user } = setup(await open())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    await user.click(screen.getByRole('button', { name: 'Heimilið' }))
    await user.selectOptions(
      screen.getByLabelText('Leikur'),
      'around-the-world',
    )

    expect(
      screen.queryByRole('region', { name: 'x01 meðaltal (3 pílur)' }),
    ).not.toBeInTheDocument()
    expect(
      within(card('Vinningshlutfall')).getAllByRole('listitem'),
    ).toHaveLength(2)
  })
})

describe('StatsScreen', () => {
  it('says when a player has no games in the period', async () => {
    const store = await guestStore()
    const { user } = setup(store, [...players, { id: 'kari', name: 'Kári' }])
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    await user.click(screen.getByRole('button', { name: 'Kári' }))

    expect(
      screen.getByText('Engir kláraðir leikir á þessu tímabili.'),
    ).toBeVisible()
  })

  it('leaves out removed players without stats', async () => {
    setup(await guestStore(), [
      ...players,
      { id: 'gone', name: 'Gunna', archivedAt: '2026-11-01T00:00:00.000Z' },
      {
        id: 'oli',
        name: 'Óli',
        archivedAt: '2026-11-01T00:00:00.000Z',
      },
    ])
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    const chips = within(screen.getByRole('group', { name: 'Leikmaður' }))
    expect(
      chips.queryByRole('button', { name: 'Gunna' }),
    ).not.toBeInTheDocument()
    expect(chips.getAllByRole('button', { name: 'Óli' })).toHaveLength(2)
  })

  it('asks for players when there are none', async () => {
    setup(createMemoryStore(), [])

    expect(
      await screen.findByText(
        'Engir leikmenn enn. Bættu við leikmönnum og spilaðu leik.',
      ),
    ).toBeVisible()
  })

  it('offers to try again when the stats fail to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = await guestStore()
    const rowsOnce = vi
      .spyOn(store.stats, 'rows')
      .mockRejectedValueOnce(new Error('offline'))
    const { user } = setup(store)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ekki tókst að sækja tölfræðina.',
    )
    await user.click(screen.getByRole('button', { name: 'Reyna aftur' }))

    expect(
      await screen.findByRole('region', { name: 'Vinningshlutfall' }),
    ).toBeVisible()
    expect(rowsOnce).toHaveBeenCalledTimes(2)
  })

  it('reads a week off a trend chart with the arrow keys', async () => {
    const { user } = setup(await guestStore())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })
    const chart = screen.getByRole('img', { name: /^Tvöföld, % af pílum/ })

    act(() => chart.focus())
    expect(chart).toHaveAccessibleDescription(/^0,0% Vikan frá/)
    await user.keyboard('{ArrowLeft}')

    expect(chart).toHaveAccessibleDescription(/^25,0% Vikan frá/)
  })

  it('goes from the household view back to a player', async () => {
    const { user } = setup(await guestStore())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })
    await user.click(screen.getByRole('button', { name: 'Heimilið' }))

    await user.click(screen.getByRole('button', { name: 'Óli' }))

    expect(screen.getByRole('button', { name: 'Heimilið' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(
      within(card('Vinningshlutfall')).getByText('1 sigrar í 3 leikjum'),
    ).toBeVisible()
    expect(card('Hvar pílurnar lenda')).toBeVisible()
  })

  it('says when no one played in the period on the household view', async () => {
    const { user } = setup(await guestStore(), players)
    await screen.findByRole('region', { name: 'Vinningshlutfall' })
    await user.click(screen.getByRole('button', { name: 'Heimilið' }))

    await user.click(screen.getByRole('button', { name: '4 vikur' }))
    await user.selectOptions(
      screen.getByLabelText('Leikur'),
      'around-the-world',
    )

    expect(
      screen.getByText('Engir kláraðir leikir á þessu tímabili.'),
    ).toBeVisible()
  })

  it('goes back', async () => {
    const { onBack, user } = setup(await guestStore())

    await user.click(screen.getByRole('button', { name: 'Til baka' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})
