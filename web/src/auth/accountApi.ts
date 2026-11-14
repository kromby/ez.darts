/** A signed-in household's account. */
export type Account = { email: string; householdId: string }

/** The API's error codes, plus `network` when it couldn't be reached. */
export type AccountErrorCode =
  | 'invalid-email'
  | 'weak-password'
  | 'email-taken'
  | 'invalid-credentials'
  | 'locked-out'
  | 'wrong-password'
  | 'wrong-origin'
  | 'network'

export type AccountResult<T> =
  { ok: true; value: T } | { ok: false; error: AccountErrorCode }

/** Sign-up, sign-in and the rest, against `/api/account` (#19). */
export type AccountApi = {
  /** Who is signed in on this device, from the session cookie. */
  me(): Promise<Account | null>
  register(email: string, password: string): Promise<AccountResult<Account>>
  login(email: string, password: string): Promise<AccountResult<Account>>
  logout(): Promise<void>
  /** Signs the account out on every device, this one included. */
  logoutEverywhere(): Promise<void>
  /** Signs every other device out. */
  changePassword(current: string, next: string): Promise<AccountResult<null>>
}

const codes: readonly AccountErrorCode[] = [
  'invalid-email',
  'weak-password',
  'email-taken',
  'invalid-credentials',
  'locked-out',
  'wrong-password',
  'wrong-origin',
]

async function errorOf(response: Response): Promise<AccountErrorCode> {
  try {
    const body = (await response.json()) as { code?: string }
    const code = codes.find((known) => known === body.code)
    if (code) return code
  } catch {
    // Not JSON; fall through.
  }
  return response.status === 401 ? 'invalid-credentials' : 'network'
}

export function createAccountApi({
  baseUrl = '/api/account',
  fetch: send = (...args) => fetch(...args),
}: { baseUrl?: string; fetch?: typeof fetch } = {}): AccountApi {
  function post(path: string, body?: unknown): Promise<Response> {
    return send(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  async function signIn(
    path: string,
    email: string,
    password: string,
  ): Promise<AccountResult<Account>> {
    try {
      const response = await post(path, { email, password })
      if (!response.ok) return { ok: false, error: await errorOf(response) }
      return { ok: true, value: (await response.json()) as Account }
    } catch {
      return { ok: false, error: 'network' }
    }
  }

  return {
    async me() {
      try {
        const response = await send(`${baseUrl}/me`, {
          credentials: 'same-origin',
        })
        return response.ok ? ((await response.json()) as Account) : null
      } catch {
        return null
      }
    },
    register: (email, password) => signIn('/register', email, password),
    login: (email, password) => signIn('/login', email, password),
    async logout() {
      await post('/logout').catch(() => undefined)
    },
    async logoutEverywhere() {
      await post('/logout-everywhere').catch(() => undefined)
    },
    async changePassword(current, next) {
      try {
        const response = await post('/password', {
          currentPassword: current,
          newPassword: next,
        })
        return response.ok
          ? { ok: true, value: null }
          : { ok: false, error: await errorOf(response) }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
  }
}
