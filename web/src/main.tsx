import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { createAccountApi } from './auth/accountApi'
import {
  createAuthSource,
  devAuthState,
  guest,
  restoreSession,
} from './auth/auth'
import Root from './Root'
import { openLocalStore } from './storage/localStore'

// Guests keep their data on this device; a signed-in household's comes from
// the API. Development builds can also use `?household=test` and the API's
// dev header without an account.
const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

const auth = createAuthSource()
const accountApi = createAccountApi()

// Signed in if the session cookie still holds; the app starts on the
// device's data meanwhile and switches when the answer comes.
restoreSession(
  auth,
  () => accountApi.me(),
  import.meta.env.DEV ? devAuthState() : guest,
).catch(() => undefined)

openLocalStore().then((local) => {
  createRoot(root).render(
    <StrictMode>
      <Root local={local} auth={auth} accountApi={accountApi} />
    </StrictMode>,
  )
})
