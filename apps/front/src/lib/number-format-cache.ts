const formatterCache = new Map<string, Intl.NumberFormat>()

function stableOptionsKey(options: Intl.NumberFormatOptions): string {
  return JSON.stringify(
    Object.keys(options)
      .sort()
      .map(key => [key, options[key as keyof Intl.NumberFormatOptions]]),
  )
}

export function getCachedNumberFormatter(
  locale: string | string[],
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
  const localeKey = Array.isArray(locale) ? locale.join('\u0000') : locale
  const cacheKey = `${localeKey}:${stableOptionsKey(options)}`
  const cached = formatterCache.get(cacheKey)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, options)
  formatterCache.set(cacheKey, formatter)
  return formatter
}

export function formatWithCachedNumberFormatter(
  value: number,
  locale: string | string[],
  options: Intl.NumberFormatOptions = {},
): string {
  return getCachedNumberFormatter(locale, options).format(value)
}
