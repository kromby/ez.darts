import { openIndexedDbStore } from './indexedDbStore'
import { createMemoryStore } from './memoryStore'
import type { DataStore } from './store'

/**
 * The guest's store on this device: IndexedDB, or memory when the browser
 * has none or refuses it (e.g. some private modes), so the app still works
 * and only forgets on reload.
 */
export async function openLocalStore(
  factory: IDBFactory | null = globalThis.indexedDB ?? null,
): Promise<DataStore> {
  if (!factory) return createMemoryStore()
  try {
    return await openIndexedDbStore(factory)
  } catch (error) {
    console.warn('IndexedDB is unavailable; nothing will be kept', error)
    return createMemoryStore()
  }
}
