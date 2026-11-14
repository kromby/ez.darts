import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { openLocalStore } from './storage/localStore'

// Guests keep their data on this device; signing in (#18) will swap in
// the API's store.
const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

openLocalStore().then((store) => {
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  )
})
