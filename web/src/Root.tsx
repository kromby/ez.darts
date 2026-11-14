import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import App from './App'
import type { AccountApi } from './auth/accountApi'
import { guest, type AuthSource } from './auth/auth'
import AccountMenu from './components/AccountMenu/AccountMenu'
import ImportOffer, {
  type ImportOfferState,
} from './components/ImportOffer/ImportOffer'
import { withSummary } from './games'
import { backfillSummaries } from './stats/backfill'
import { createApiStore } from './storage/apiStore'
import {
  guestData,
  importGuestData,
  type GuestData,
} from './storage/importGuest'
import type { DataStore } from './storage/store'

type Props = {
  /** The guest's store on this device. */
  local: DataStore
  auth: AuthSource
  accountApi: AccountApi
  /** For tests: the API store to use when signed in. */
  createHouseholdStore?: (householdId: string, devHeader: boolean) => DataStore
}

/**
 * Picks the store for whoever is using the app: the device's own for a
 * guest, the API's for a signed-in household. Signing in or out starts the
 * app afresh on the other store. The first time a household signs in on a
 * device with guest data, it offers to import it.
 */
function Root({ local, auth, accountApi, createHouseholdStore }: Props) {
  const state = useSyncExternalStore(auth.subscribe, auth.get)
  const householdId = state.status === 'signedIn' ? state.householdId : null
  const devHeader = state.status === 'signedIn' && state.devHeader === true
  const store = useMemo(() => {
    if (householdId === null) return local
    return createHouseholdStore
      ? createHouseholdStore(householdId, devHeader)
      : createApiStore({
          settings: local.settings,
          devHousehold: devHeader ? householdId : undefined,
          // The session ended elsewhere (signed out everywhere, expired).
          onUnauthorized: () => auth.set(guest),
        })
  }, [local, auth, householdId, devHeader, createHouseholdStore])

  // Kept with its household, so signing in as another hides it.
  const [shown, setShown] = useState<{
    householdId: string
    state: ImportOfferState
    guest: GuestData
  } | null>(null)
  const offer = shown?.householdId === householdId ? shown.state : null
  const setOffer = (state: ImportOfferState | null) =>
    setShown((current) => (current && state ? { ...current, state } : null))
  // Bumped after an import so the app reloads the household's data.
  const [loads, setLoads] = useState(0)

  // Games finished before summaries were kept count in the stats too.
  useEffect(() => {
    backfillSummaries(store).catch((error: unknown) =>
      console.error('Could not add summaries to older games', error),
    )
  }, [store])

  useEffect(() => {
    if (householdId === null) return undefined
    let cancelled = false
    Promise.all([local.settings.get('importOffered'), guestData(local)])
      .then(([offered, data]) => {
        if (cancelled || offered?.includes(householdId)) return
        if (data.players.length === 0 && data.games.length === 0) return
        setShown({
          householdId,
          guest: data,
          state: {
            step: 'offer',
            players: data.players.length,
            games: data.games.length,
          },
        })
      })
      .catch((error: unknown) =>
        console.error('Could not check for guest data', error),
      )
    return () => {
      cancelled = true
    }
  }, [local, householdId])

  async function markOffered() {
    if (householdId === null) return
    const offered = (await local.settings.get('importOffered')) ?? []
    if (!offered.includes(householdId)) {
      await local.settings.put('importOffered', [...offered, householdId])
    }
  }

  async function runImport() {
    if (!shown || !offer || offer.step === 'done') return
    const counts = { players: offer.players, games: offer.games }
    setOffer({ step: 'importing', ...counts })
    try {
      const { guest: data } = shown
      const result = await importGuestData(
        { ...data, games: data.games.map(withSummary) },
        store,
      )
      await markOffered()
      setOffer({ step: 'done', result })
      setLoads((n) => n + 1)
    } catch (error) {
      console.error('Could not import guest data', error)
      setOffer({ step: 'failed', ...counts })
    }
  }

  return (
    <App
      key={`${householdId ?? 'guest'}:${loads}`}
      store={store}
      account={<AccountMenu auth={auth} api={accountApi} />}
      notice={
        offer && (
          <ImportOffer
            state={offer}
            onImport={() => {
              runImport().catch((error: unknown) =>
                console.error('Could not import guest data', error),
              )
            }}
            onClose={() => {
              if (offer.step !== 'done') {
                markOffered().catch((error: unknown) =>
                  console.error('Could not save the skip', error),
                )
              }
              setOffer(null)
            }}
          />
        )
      }
    />
  )
}

export default Root
