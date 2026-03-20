export function formatSignedPercentChange(
  rawPercent: string | null | undefined,
  rawPriceChange?: string | null,
  rawPrice?: string | null,
): string {
  const pct = Number.parseFloat(rawPercent ?? '')
  if (Number.isFinite(pct)) {
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  }

  // Fallback: derive % from absolute 1D change and current price when backend misses percent.
  const change = Number.parseFloat(rawPriceChange ?? '')
  const price = Number.parseFloat(rawPrice ?? '')
  const base = price - change
  if (!Number.isFinite(change) || !Number.isFinite(price) || base === 0) {
    return '-'
  }

  const derived = (change / base) * 100
  return Number.isFinite(derived) ? `${derived >= 0 ? '+' : ''}${derived.toFixed(2)}%` : '-'
}

export function formatSignedAbsoluteChange(rawChange: string | null | undefined): string {
  const change = Number.parseFloat(rawChange ?? '')
  if (!Number.isFinite(change)) {
    return '-'
  }
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}`
}
