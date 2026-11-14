/** A number with one decimal in the language's style: 62,7 in Icelandic. */
export function formatDecimal(value: number, language: string): string {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}
