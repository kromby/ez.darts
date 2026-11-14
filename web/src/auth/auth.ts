/**
 * Who is using the app: a guest, whose data stays on this device, or a
 * signed-in household, whose data lives with the API.
 */
export type AuthState =
  | { status: 'guest' }
  | {
      status: 'signedIn'
      householdId: string
      /**
       * Development only: lets the API trust an `X-Household-Id` header
       * under `func start` until real sessions exist (#19).
       */
      devHeader?: boolean
    }

export const guest: AuthState = Object.freeze({ status: 'guest' })

/**
 * The seam sign-in plugs into. Today nothing signs in, so the app stays a
 * guest. Sign-in (#19) calls `set` after logging in or out (and on start-up
 * with the session it finds), and the app switches stores.
 */
export type AuthSource = {
  get(): AuthState
  set(state: AuthState): void
  /** Calls `listener` after every change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export function createAuthSource(initial: AuthState = guest): AuthSource {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const devHouseholdKey = 'ez-darts.devHousehold'
const householdId = /^[A-Za-z0-9-]{1,64}$/

/**
 * Development builds only: `?household=test` (remembered on this device) or
 * `?household=` (back to guest) signs in as that household through the
 * API's dev header, to try the API store before sign-in exists.
 */
export function devAuthState(
  search: string = location.search,
  storage: Storage = localStorage,
): AuthState {
  try {
    const param = new URLSearchParams(search).get('household')
    if (param !== null) {
      if (householdId.test(param)) storage.setItem(devHouseholdKey, param)
      else storage.removeItem(devHouseholdKey)
    }
    const stored = storage.getItem(devHouseholdKey)
    return stored && householdId.test(stored)
      ? { status: 'signedIn', householdId: stored, devHeader: true }
      : guest
  } catch {
    return guest
  }
}
