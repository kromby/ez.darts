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

async function setup(store: DataStore, list = players) {
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
    await setup(await open())

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
    const { user } = await setup(await open())
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
})

describe('StatsScreen', () => {
  it('says when a player has no games in the period', async () => {
    const store = await guestStore()
    const { user } = await setup(store, [
      ...players,
      { id: 'kari', name: 'Kári' },
    ])
    await screen.findByRole('region', { name: 'Vinningshlutfall' })

    await user.click(screen.getByRole('button', { name: 'Kári' }))

    expect(
      screen.getByText('Engir kláraðir leikir á þessu tímabili.'),
    ).toBeVisible()
  })

  it('leaves out removed players without stats', async () => {
    await setup(await guestStore(), [
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
    await setup(createMemoryStore(), [])

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
    const { user } = await setup(store)

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
    const { user } = await setup(await guestStore())
    await screen.findByRole('region', { name: 'Vinningshlutfall' })
    const chart = screen.getByRole('img', { name: /^Tvöföld, % af pílum/ })

    act(() => chart.focus())
    expect(chart).toHaveAccessibleDescription(/^0,0% Vikan frá/)
    await user.keyboard('{ArrowLeft}')

    expect(chart).toHaveAccessibleDescription(/^25,0% Vikan frá/)
  })

  it('goes back', async () => {
    const { onBack, user } = await setup(await guestStore())

    await user.click(screen.getByRole('button', { name: 'Til baka' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})
