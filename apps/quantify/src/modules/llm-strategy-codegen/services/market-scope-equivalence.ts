export type MarketScopeField = 'exchange' | 'marketType' | 'symbol' | 'timeframe'

const KNOWN_QUOTES = [
  'FDUSD',
  'USDT',
  'USDC',
  'BUSD',
  'TUSD',
  'USD',
] as const

export function canonicalizeStrategySymbolInput(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const upper = trimmed
    .toUpperCase()
    .replace(/:SPOT$/u, '')
    .replace(/:PERP$/u, '')
    .replace(/-SWAP$/u, '')
    .replace(/[/-]/gu, '')

  for (const quote of KNOWN_QUOTES) {
    if (!upper.endsWith(quote) || upper.length <= quote.length) {
      continue
    }
    const base = upper.slice(0, -quote.length)
    if (!/^[A-Z0-9]{2,20}$/u.test(base)) {
      continue
    }
    if (!/[A-Z]/u.test(base)) {
      continue
    }
    return `${base}${quote}`
  }

  return null
}

export function normalizeMarketScopeValue(
  field: MarketScopeField,
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (field === 'symbol') return canonicalizeStrategySymbolInput(trimmed)
  return trimmed.toLowerCase()
}

export function isEquivalentMarketScopeValue(
  field: MarketScopeField,
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeMarketScopeValue(field, left)
  const normalizedRight = normalizeMarketScopeValue(field, right)

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}
