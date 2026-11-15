import { describe, expect, it } from 'vitest'
import { dart } from '../engine/dart'
import { guestData, importGuestData } from './importGuest'
import { createMemoryStore } from './memoryStore'
import type { StoredGame } from './store'

const finished: StoredGame = {
  id: 'game-1',
  game: 'x01',
  configVersion: 1,
  options: { startScore: 501 },
  slots: [{ playerId: 'phone-anna' }, { playerId: 'phone-dagny' }],
  darts: [
    { playerId: 'phone-anna', dart: dart(20, 3) },
    { playerId: 'phone-dagny', dart: dart(1, 1) },
  ],
  startedAt: '2026-11-13T20:00:00.000Z',
  result: {
    standings: ['phone-anna', 'phone-dagny'],
    finishedAt: '2026-11-13T20:10:00.000Z',
  },
}
const inPlay: StoredGame = {
  ...finished,
  id: 'game-2',
  startedAt: '2026-11-14T20:00:00.000Z',
  result: null,
}

async function setup() {
  const local = createMemoryStore()
  await local.players.put({ id: 'phone-anna', name: 'anna', color: 'sky' })
  await local.players.put({ id: 'phone-dagny', name: 'Dagný', color: 'pink' })
  await local.games.put(finished)
  await local.games.put(inPlay)
  const household = createMemoryStore()
  await household.players.put({ id: 'home-anna', name: 'Anna', color: 'red' })
  return { local, household }
}

describe('importGuestData', () => {
  it('adds new players and matches existing ones by name', async () => {
    const { local, household } = await setup()

    const result = await importGuestData(await guestData(local), household)

    expect(result).toEqual({ added: 1, merged: 1, games: 2 })
    expect(await household.players.list()).toEqual([
      { id: 'home-anna', name: 'Anna', color: 'red' },
      { id: 'phone-dagny', name: 'Dagný', color: 'pink' },
    ])
  })

  it("moves the games over with matched players' ids", async () => {
    const { local, household } = await setup()

    await importGuestData(await guestData(local), household)

    const imported = await household.games.get('game-1')
    expect(imported?.slots.map((s) => s.playerId)).toEqual([
      'home-anna',
      'phone-dagny',
    ])
    expect(imported?.darts.map((d) => d.playerId)).toEqual([
      'home-anna',
      'phone-dagny',
    ])
    expect(imported?.result?.standings).toEqual(['home-anna', 'phone-dagny'])
    // A game still in play comes too, to carry on with.
    expect((await household.games.unfinished())?.id).toBe('game-2')
  })

  it("puts matched players' ids in the summary, so their stats follow", async () => {
    const { household } = await setup()
    const summary = (playerId: string, place: number) => ({
      playerId,
      darts: 1,
      singles: 0,
      doubles: 0,
      triples: 0,
      misses: 1,
      place,
      points: 0,
    })

    await importGuestData(
      {
        players: [{ id: 'phone-anna', name: 'anna' }],
        games: [
          {
            ...finished,
            summary: [summary('phone-anna', 1), summary('phone-dagny', 2)],
          },
        ],
      },
      household,
    )

    expect(
      (await household.games.get('game-1'))?.summary?.map((s) => s.playerId),
    ).toEqual(['home-anna', 'phone-dagny'])
    expect((await household.stats.rows()).map((row) => row.playerId)).toEqual([
      'home-anna',
      'phone-dagny',
    ])
  })

  it('changes nothing when run again, and leaves the guest data', async () => {
    const { local, household } = await setup()
    const guest = await guestData(local)
    await importGuestData(guest, household)

    const again = await importGuestData(guest, household)

    expect(again).toEqual({ added: 0, merged: 1, games: 2 })
    expect(await household.players.list()).toHaveLength(2)
    expect(await household.games.list()).toHaveLength(2)
    expect(await local.players.list()).toHaveLength(2)
    expect(await local.games.list()).toHaveLength(2)
  })
})
