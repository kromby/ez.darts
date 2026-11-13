import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import is from './locales/is'
import {
  defaultLanguage,
  getStoredLanguage,
  isLanguage,
  storeLanguage,
  supportedLanguages,
} from './languages'

export const resources = {
  is: { translation: is },
  en: { translation: en },
} as const

i18n.on('languageChanged', (language) => {
  if (!isLanguage(language)) return
  document.documentElement.lang = language
  storeLanguage(language)
})

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: defaultLanguage,
  supportedLngs: supportedLanguages,
  initAsync: false,
  interpolation: {
    // React already escapes rendered values.
    escapeValue: false,
  },
})

export default i18n
