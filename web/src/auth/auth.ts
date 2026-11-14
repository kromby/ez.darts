/**
 * Who is using the app: a guest, whose data stays on this device, or a
 * signed-in household, whose data lives with the API.
 */
export type AuthState =
  | { status: 'guest' }
  | {
      status: 'signedIn'
      householdId: string
      /** The account's email; not known for a dev-header household. */
      email?: string
      /**
       * Development only: signed in through the API's `X-Household-Id`
       * header under `func start`, without an account.
       */
      devHeader?: boolean
    }

export const guest: AuthState = Object.freeze({ status: 'guest' })

/**
 * Who is signed in, for the app to follow: the account menu sets it after
 * signing in or out, `restoreSession` on start-up, and the API store on a
 * 401 when the session has ended elsewhere. The app switches stores on every
 * change.
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
 * API's dev header, to try the API without an account.
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

/**
 * On start-up: signed in when the session cookie still holds, otherwise a
 * guest (or, in development, a `?household=` dev household).
 */
export async function restoreSession(
  auth: AuthSource,
  me: () => Promise<{ email: string; householdId: string } | null>,
  fallback: AuthState = guest,
): Promise<void> {
  const account = await me()
  auth.set(
    account
      ? {
          status: 'signedIn',
          householdId: account.householdId,
          email: account.email,
        }
      : fallback,
  )
}
