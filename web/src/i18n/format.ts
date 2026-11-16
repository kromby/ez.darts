/** A number with one decimal in the language's style: 62,7 in Icelandic. */
export function formatDecimal(value: number, language: string): string {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

/** A whole number in the language's style: 2.184 in Icelandic. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(
    value,
  )
}

/** A fraction as a percentage, e.g. 0.091 → 9,1% (or 9% with 0 digits). */
export function formatPercent(
  fraction: number,
  language: string,
  digits = 1,
): string {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction)
}
