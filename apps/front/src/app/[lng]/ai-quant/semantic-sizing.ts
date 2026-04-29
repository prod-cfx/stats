export type QuantSizingMode = 'RATIO' | 'QUOTE' | 'QTY'

export type QuantSizing =
  | { mode: 'RATIO', value: number }
  | { mode: 'QUOTE', value: number, asset?: 'USDT' | 'USDC' | 'USD' }
  | { mode: 'QTY', value: number, asset?: string }

type RawSizing = {
  mode?: unknown
  value?: unknown
  asset?: unknown
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeMode(value: unknown): QuantSizingMode | null {
  const mode = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return mode === 'RATIO' || mode === 'QUOTE' || mode === 'QTY' ? mode : null
}

function normalizeQuoteAsset(value: unknown): 'USDT' | 'USDC' | 'USD' | undefined {
  const asset = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') return asset
  return undefined
}

function normalizeQtyAsset(value: unknown, fallbackSymbol?: string): string | undefined {
  const asset = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (asset) return asset
  const symbol = typeof fallbackSymbol === 'string' ? fallbackSymbol.trim().toUpperCase() : ''
  if (symbol.endsWith('USDT')) return symbol.slice(0, -4)
  if (symbol.endsWith('USDC')) return symbol.slice(0, -4)
  if (symbol.endsWith('USD')) return symbol.slice(0, -3)
  return undefined
}

function normalizeRatioValue(value: number): number {
  return value > 0 && value <= 1 ? Number((value * 100).toFixed(4)) : Number(value.toFixed(4))
}

function normalizeDisplayNumber(value: number): string {
  return Number(value.toFixed(8)).toString()
}

export function normalizeSizing(value: unknown, fallbackPositionPct: number, fallbackSymbol?: string): QuantSizing {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as RawSizing : null
  const mode = normalizeMode(raw?.mode)
  const numericValue = toFiniteNumber(raw?.value)

  if (mode === 'RATIO' && numericValue !== null) return { mode: 'RATIO', value: normalizeRatioValue(numericValue) }
  if (mode === 'QUOTE' && numericValue !== null) {
    return {
      mode: 'QUOTE',
      value: Number(numericValue.toFixed(8)),
      asset: normalizeQuoteAsset(raw?.asset) ?? 'USDT',
    }
  }
  if (mode === 'QTY' && numericValue !== null) {
    return {
      mode: 'QTY',
      value: Number(numericValue.toFixed(8)),
      asset: normalizeQtyAsset(raw?.asset, fallbackSymbol),
    }
  }

  const fallback = Number.isFinite(fallbackPositionPct) && fallbackPositionPct > 0 ? fallbackPositionPct : 10
  return { mode: 'RATIO', value: normalizeRatioValue(fallback) }
}

export function normalizeSizingFromCanonicalValue(
  value: unknown,
  fallbackSymbol: string,
  fallbackPositionPct: number,
): QuantSizing {
  return normalizeSizing(value, fallbackPositionPct, fallbackSymbol)
}

export function derivePositionPctFromSizing(sizing: QuantSizing): number | null {
  return sizing.mode === 'RATIO' ? sizing.value : null
}

export function formatSizing(sizing: QuantSizing, fallbackSymbol?: string): string {
  if (sizing.mode === 'RATIO') return `${normalizeDisplayNumber(sizing.value)}%`
  if (sizing.mode === 'QUOTE') return `${normalizeDisplayNumber(sizing.value)} ${sizing.asset ?? 'USDT'}`
  const asset = sizing.asset ?? normalizeQtyAsset(undefined, fallbackSymbol)
  return asset ? `${normalizeDisplayNumber(sizing.value)} ${asset}` : normalizeDisplayNumber(sizing.value)
}

export function buildSizingRequestContext(sizing: QuantSizing): string[] {
  const lines = [`sizing.mode=${sizing.mode}`, `sizing.value=${normalizeDisplayNumber(sizing.value)}`]
  if (sizing.mode === 'QUOTE') lines.push(`sizing.asset=${sizing.asset ?? 'USDT'}`)
  if (sizing.mode === 'QTY' && sizing.asset) lines.push(`sizing.asset=${sizing.asset}`)
  if (sizing.mode === 'RATIO') lines.push(`positionPct=${normalizeDisplayNumber(sizing.value)}`)
  return lines
}
