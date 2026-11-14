import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountApi, AccountErrorCode } from '../../auth/accountApi'
import { guest, type AuthSource } from '../../auth/auth'
import styles from './AccountMenu.module.css'

type Props = {
  auth: AuthSource
  api: AccountApi
}

type Mode = 'signIn' | 'signUp'

function ErrorText({ error }: { error: AccountErrorCode | null }) {
  const { t } = useTranslation()
  if (!error) return null
  return (
    <p className={styles.error} role="alert">
      {t(`account.errors.${error}`)}
    </p>
  )
}

/** Sign in or create the household's account. */
function SignInForm({ auth, api, onDone }: Props & { onDone(): void }) {
  const { t } = useTranslation()
  const id = useId()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AccountErrorCode | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const result =
      mode === 'signIn'
        ? await api.login(email, password)
        : await api.register(email, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onDone()
    auth.set({
      status: 'signedIn',
      householdId: result.value.householdId,
      email: result.value.email,
    })
  }

  return (
    <form
      className={styles.form}
      aria-label={
        mode === 'signIn' ? t('account.signInTitle') : t('account.signUpTitle')
      }
      onSubmit={(event) => {
        event.preventDefault()
        submit().catch(() => {
          setBusy(false)
          setError('network')
        })
      }}
    >
      <p className={styles.intro}>{t('account.intro')}</p>
      <div className={styles.modes} role="group" aria-label={t('account.mode')}>
        {(['signIn', 'signUp'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={styles.mode}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value)
              setError(null)
            }}
          >
            {value === 'signIn'
              ? t('account.signInTitle')
              : t('account.signUpTitle')}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-email`} className={styles.label}>
        {t('account.email')}
      </label>
      <input
        id={`${id}-email`}
        className={styles.input}
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor={`${id}-password`} className={styles.label}>
        {t('account.password')}
      </label>
      <input
        id={`${id}-password`}
        className={styles.input}
        type="password"
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        required
        minLength={mode === 'signUp' ? 8 : undefined}
        maxLength={128}
        aria-describedby={mode === 'signUp' ? `${id}-hint` : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {mode === 'signUp' && (
        <p id={`${id}-hint`} className={styles.hint}>
          {t('account.passwordHint')}
        </p>
      )}
      <ErrorText error={error} />
      <button type="submit" className={styles.primary} disabled={busy}>
        {mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
      </button>
    </form>
  )
}

/** The signed-in account: sign out here or everywhere, change password. */
function AccountPanel({
  auth,
  api,
  email,
  onDone,
}: Props & { email?: string; onDone(): void }) {
  const { t } = useTranslation()
  const id = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AccountErrorCode | null>(null)
  const [changed, setChanged] = useState(false)

  async function signOut(everywhere: boolean) {
    setBusy(true)
    await (everywhere ? api.logoutEverywhere() : api.logout())
    onDone()
    auth.set(guest)
  }

  async function changePassword() {
    setBusy(true)
    setError(null)
    setChanged(false)
    const result = await api.changePassword(current, next)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCurrent('')
    setNext('')
    setChanged(true)
  }

  return (
    <div className={styles.form}>
      {email && (
        <p className={styles.intro}>{t('account.signedInAs', { email })}</p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => void signOut(false)}
        >
          {t('account.signOut')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => void signOut(true)}
        >
          {t('account.signOutEverywhere')}
        </button>
      </div>
      <form
        className={styles.form}
        aria-label={t('account.changePassword')}
        onSubmit={(event) => {
          event.preventDefault()
          changePassword().catch(() => {
            setBusy(false)
            setError('network')
          })
        }}
      >
        <h3 className={styles.heading}>{t('account.changePassword')}</h3>
        <label htmlFor={`${id}-current`} className={styles.label}>
          {t('account.currentPassword')}
        </label>
        <input
          id={`${id}-current`}
          className={styles.input}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <label htmlFor={`${id}-new`} className={styles.label}>
          {t('account.newPassword')}
        </label>
        <input
          id={`${id}-new`}
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <ErrorText error={error} />
        {changed && (
          <p className={styles.done} role="status">
            {t('account.passwordChanged')}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={busy}>
          {t('account.save')}
        </button>
      </form>
    </div>
  )
}

/**
 * Header button for signing in and out. Signing in switches the app to the
 * household's data (and offers to import this device's); signing out goes
 * back to the device's own.
 */
function AccountMenu({ auth, api }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const state = useSyncExternalStore(auth.subscribe, auth.get)
  const [open, setOpen] = useState(false)
  const signedIn = state.status === 'signedIn'

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {signedIn ? t('account.account') : t('account.signIn')}
      </button>
      {open && (
        <section
          id={id}
          className={styles.panel}
          aria-label={signedIn ? t('account.account') : t('account.signIn')}
        >
          {signedIn ? (
            <AccountPanel
              auth={auth}
              api={api}
              email={state.email}
              onDone={() => setOpen(false)}
            />
          ) : (
            <SignInForm auth={auth} api={api} onDone={() => setOpen(false)} />
          )}
        </section>
      )}
    </div>
  )
}

export default AccountMenu
