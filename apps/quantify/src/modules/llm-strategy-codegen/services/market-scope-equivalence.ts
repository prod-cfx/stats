export type MarketScopeField = 'exchange' | 'marketType' | 'symbol' | 'timeframe'

export function normalizeMarketScopeValue(
  field: MarketScopeField,
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (field === 'symbol') return trimmed.toUpperCase()
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
