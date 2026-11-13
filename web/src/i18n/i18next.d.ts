import 'i18next'
import type is from './locales/is'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof is
    }
  }
}
