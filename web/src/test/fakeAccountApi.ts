import { vi } from 'vitest'
import type { Account, AccountApi } from '../auth/accountApi'

/**
 * An account API in memory: one account per email, the password checked as
 * the real one would.
 */
export function fakeAccountApi(signedIn: Account | null = null) {
  const accounts = new Map<string, { password: string; account: Account }>()
  let current = signedIn
  const api: AccountApi = {
    me: vi.fn<AccountApi['me']>(() => Promise.resolve(current)),
    register: vi.fn<AccountApi['register']>(
      (email: string, password: string) => {
        if (accounts.has(email)) {
          return Promise.resolve({
            ok: false as const,
            error: 'email-taken' as const,
          })
        }
        if (password.length < 8) {
          return Promise.resolve({
            ok: false as const,
            error: 'weak-password' as const,
          })
        }
        const account = { email, householdId: `home-${accounts.size + 1}` }
        accounts.set(email, { password, account })
        current = account
        return Promise.resolve({ ok: true as const, value: account })
      },
    ),
    login: vi.fn<AccountApi['login']>((email: string, password: string) => {
      const found = accounts.get(email)
      if (!found || found.password !== password) {
        return Promise.resolve({
          ok: false as const,
          error: 'invalid-credentials' as const,
        })
      }
      current = found.account
      return Promise.resolve({ ok: true as const, value: found.account })
    }),
    logout: vi.fn<AccountApi['logout']>(() => {
      current = null
      return Promise.resolve()
    }),
    logoutEverywhere: vi.fn<AccountApi['logoutEverywhere']>(() => {
      current = null
      return Promise.resolve()
    }),
    changePassword: vi.fn<AccountApi['changePassword']>(
      (currentPassword: string, next: string) => {
        const found = [...accounts.values()].find(
          (entry) => entry.account.email === current?.email,
        )
        if (!found || found.password !== currentPassword) {
          return Promise.resolve({
            ok: false as const,
            error: 'wrong-password' as const,
          })
        }
        found.password = next
        return Promise.resolve({ ok: true as const, value: null })
      },
    ),
  }
  return { api, accounts }
}
