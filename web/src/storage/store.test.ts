import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { dart, MISS } from '../engine/dart'
import type { PlayerSlot } from '../engine/game'
import { openIndexedDbStore } from './indexedDbStore'
import { openLocalStore } from './localStore'
import { createMemoryStore } from './memoryStore'
import type { DataStore, StoredGame } from './store'

function game(id: string, startedAt: string, finished: boolean): StoredGame {
  return {
    id,
    game: 'x01',
    configVersion: 1,
    options: { startScore: 501, in: 'single', out: 'double' },
    slots: [{ playerId: 'anna' }, { playerId: 'oli' }],
    darts: [
      { playerId: 'anna', dart: dart(20, 3) },
      { playerId: 'anna', dart: MISS },
    ],
    startedAt,
    result: finished
      ? { standings: ['anna', 'oli'], finishedAt: '2026-11-14T21:00:00.000Z' }
      : null,
  }
}

const implementations: [string, () => Promise<DataStore>][] = [
  ['memory', () => Promise.resolve(createMemoryStore())],
  // A new factory is an empty browser profile.
  ['IndexedDB', () => openIndexedDbStore(new IDBFactory())],
]

describe.each(implementations)('%s store', (_, open) => {
  it('starts empty', async () => {
    const store = await open()

    expect(await store.players.list()).toEqual([])
    expect(await store.games.list()).toEqual([])
    expect(await store.games.unfinished()).toBeUndefined()
    expect(await store.games.get('none')).toBeUndefined()
    expect(await store.settings.get('slots')).toBeUndefined()
  })

  it('keeps players, sorted by name, and updates them in place', async () => {
    const store = await open()

    await store.players.put({ id: 'oli', name: 'Óli' })
    await store.players.put({ id: 'anna', name: 'Anna' })
    await store.players.put({ id: 'bjarni', name: 'Bjarni' })
    await store.players.put({ id: 'anna', name: 'Anna Jóns' })

    expect(await store.players.list()).toEqual([
      { id: 'anna', name: 'Anna Jóns' },
      { id: 'bjarni', name: 'Bjarni' },
      { id: 'oli', name: 'Óli' },
    ])
  })

  it('keeps games with their dart log, newest first', async () => {
    const store = await open()
    const older = game('older', '2026-11-13T20:00:00.000Z', true)
    const newer = game('newer', '2026-11-14T20:00:00.000Z', true)

    await store.games.put(older)
    await store.games.put(newer)

    expect(await store.games.list()).toEqual([newer, older])
    expect(await store.games.get('older')).toEqual(older)
  })

  it('finds the newest unfinished game, and updates it after each dart', async () => {
    const store = await open()
    await store.games.put(game('done', '2026-11-14T22:00:00.000Z', true))
    await store.games.put(game('old', '2026-11-12T20:00:00.000Z', false))
    const playing = game('playing', '2026-11-14T20:00:00.000Z', false)
    await store.games.put(playing)

    const next = {
      ...playing,
      darts: [...playing.darts, { playerId: 'anna', dart: dart(1, 1) }],
    }
    await store.games.put(next)

    expect(await store.games.unfinished()).toEqual(next)
    await store.games.remove('playing')
    expect((await store.games.unfinished())?.id).toBe('old')
    expect(await store.games.list()).toHaveLength(2)
  })

  it('keeps settings', async () => {
    const store = await open()
    const slots: PlayerSlot[] = [
      { playerId: 'anna', teamId: 'A' },
      { playerId: 'oli', teamId: 'B' },
    ]

    await store.settings.put('slots', slots)
    await store.settings.put('gameId', 'killer')
    await store.settings.put('setups', {
      x01: { options: { startScore: 301 }, playerOptions: {} },
    })

    expect(await store.settings.get('slots')).toEqual(slots)
    expect(await store.settings.get('gameId')).toBe('killer')
    expect(await store.settings.get('setups')).toEqual({
      x01: { options: { startScore: 301 }, playerOptions: {} },
    })
  })

  it('hands out copies, so changing one changes nothing stored', async () => {
    const store = await open()
    const player = { id: 'anna', name: 'Anna' }
    await store.players.put(player)
    player.name = 'Changed'

    const [listed] = await store.players.list()
    listed.name = 'Changed too'

    expect(await store.players.list()).toEqual([{ id: 'anna', name: 'Anna' }])
  })
})

describe('IndexedDB store', () => {
  it('keeps everything across visits', async () => {
    const factory = new IDBFactory()
    const first = await openIndexedDbStore(factory)
    await first.players.put({ id: 'anna', name: 'Anna' })
    await first.games.put(game('playing', '2026-11-14T20:00:00.000Z', false))
    await first.settings.put('gameId', 'around-the-world')

    const again = await openIndexedDbStore(factory)

    expect(await again.players.list()).toEqual([{ id: 'anna', name: 'Anna' }])
    expect((await again.games.unfinished())?.darts).toHaveLength(2)
    expect(await again.settings.get('gameId')).toBe('around-the-world')
  })
})

describe('openLocalStore', () => {
  it('uses IndexedDB when the browser has it', async () => {
    const factory = new IDBFactory()
    const store = await openLocalStore(factory)
    await store.players.put({ id: 'anna', name: 'Anna' })

    const again = await openLocalStore(factory)
    expect(await again.players.list()).toHaveLength(1)
  })

  it('falls back to memory without IndexedDB', async () => {
    const store = await openLocalStore(null)
    await store.players.put({ id: 'anna', name: 'Anna' })

    expect(await store.players.list()).toHaveLength(1)
  })

  it('falls back to memory when IndexedDB refuses to open', async () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue()
    const factory = new IDBFactory()
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    const store = await openLocalStore(factory)

    expect(await store.players.list()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })
})
