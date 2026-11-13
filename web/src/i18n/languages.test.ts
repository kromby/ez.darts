import { describe, expect, it } from 'vitest'
import {
  defaultLanguage,
  getStoredLanguage,
  languageStorageKey,
  localize,
} from './languages'

describe('getStoredLanguage', () => {
  it('defaults to Icelandic when nothing is stored', () => {
    expect(defaultLanguage).toBe('is')
    expect(getStoredLanguage()).toBe('is')
  })

  it('returns the language remembered on this device', () => {
    localStorage.setItem(languageStorageKey, 'en')

    expect(getStoredLanguage()).toBe('en')
  })

  it('ignores an unsupported stored language', () => {
    localStorage.setItem(languageStorageKey, 'de')

    expect(getStoredLanguage()).toBe('is')
  })
})

describe('localize', () => {
  const label = { is: 'Kast', en: 'Throw' }

  it('picks the label for the given language', () => {
    expect(localize(label, 'en')).toBe('Throw')
    expect(localize(label, 'is')).toBe('Kast')
  })

  it('falls back to Icelandic for an unsupported language', () => {
    expect(localize(label, 'de')).toBe('Kast')
  })
})
