import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import i18n from '../i18n'
import { defaultLanguage } from '../i18n/languages'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage(defaultLanguage)
  localStorage.clear()
})
