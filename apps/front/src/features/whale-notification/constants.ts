export const MONITOR_SYMBOL_OPTIONS = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'DOGE',
  'BNB',
  'HYPE',
  'LINK',
  'AVAX',
  'ADA',
] as const

export const DEFAULT_MONITOR_SYMBOL = MONITOR_SYMBOL_OPTIONS[0]

export function buildMonitorSymbolOptions(dynamicSymbols: string[]): string[] {
  const merged = new Set<string>(MONITOR_SYMBOL_OPTIONS)

  dynamicSymbols.forEach(symbol => {
    const normalized = symbol.trim().toUpperCase()
    if (normalized) merged.add(normalized)
  })

  return Array.from(merged)
}
