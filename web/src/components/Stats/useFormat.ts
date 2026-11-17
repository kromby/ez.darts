import { useTranslation } from 'react-i18next'
import { findGameConfig } from '../../games'
import { formatDecimal, formatNumber, formatPercent } from '../../i18n/format'
import { localize } from '../../i18n/languages'
import { weekStart } from '../../stats/aggregate'

/** Numbers, dates and game names in the current language. */
export function useFormat() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'is'
  return {
    number: (value: number) => formatNumber(value, language),
    decimal: (value: number) => formatDecimal(value, language),
    percent: (value: number, digits = 1) =>
      formatPercent(value, language, digits),
    points: (value: number) =>
      t('stats.points', { value: formatDecimal(value, language) }),
    week: (week: string) =>
      new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(weekStart(week)),
    date: (iso: string) =>
      new Intl.DateTimeFormat(language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(iso)),
    gameName: (game: string) => {
      const config = findGameConfig(game)
      return config ? localize(config.name, language) : game
    },
  }
}

export type Format = ReturnType<typeof useFormat>
