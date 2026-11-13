export const supportedLanguages = ['is', 'en'] as const

export type Language = (typeof supportedLanguages)[number]

export const defaultLanguage: Language = 'is'

/** Each language's name in that language, so people can find their own. */
export const languageNames: Record<Language, string> = {
  is: 'Íslenska',
  en: 'English',
}

/** A label that game configs and other data carry in every language. */
export type LocalizedLabel = Record<Language, string>

export function isLanguage(value: unknown): value is Language {
  return supportedLanguages.includes(value as Language)
}

/** Picks the label for `language`, falling back to the default language. */
export function localize(label: LocalizedLabel, language: string): string {
  return isLanguage(language) ? label[language] : label[defaultLanguage]
}

export const languageStorageKey = 'ez.darts.language'

/** The language remembered on this device, or the default. */
export function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(languageStorageKey)
    return isLanguage(stored) ? stored : defaultLanguage
  } catch {
    return defaultLanguage
  }
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(languageStorageKey, language)
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}
