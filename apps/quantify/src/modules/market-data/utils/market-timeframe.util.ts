import type { MarketTimeframe } from '@ai/shared'

export const MARKET_TIMEFRAME_MS: Record<MarketTimeframe, number> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
}

export function getMarketTimeframeMs(timeframe: string): number {
  const ms = MARKET_TIMEFRAME_MS[timeframe as MarketTimeframe]
  if (ms == null) {
    throw new Error(`Unsupported market timeframe: ${timeframe}`)
  }
  return ms
}
