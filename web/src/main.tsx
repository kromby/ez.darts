import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { createAuthSource, devAuthState, guest } from './auth/auth'
import Root from './Root'
import { openLocalStore } from './storage/localStore'

// Guests keep their data on this device; a signed-in household's comes from
// the API. Until sign-in (#19), only development builds can sign in, with
// `?household=test` and the API's dev header.
const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

const auth = createAuthSource(import.meta.env.DEV ? devAuthState() : guest)

openLocalStore().then((local) => {
  createRoot(root).render(
    <StrictMode>
      <Root local={local} auth={auth} />
    </StrictMode>,
  )
})
