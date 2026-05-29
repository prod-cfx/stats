import type { MarketTimeframe } from '@ai/shared'
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { getMarketTimeframeMs } from './market-timeframe.util'

const LEGACY_OPEN_TIME_BAR_SOURCES = new Set([
  'BINANCE_REST',
  'OKX_REST',
  'OKX_WS',
  'HYPERLIQUID_REST',
  'HYPERLIQUID_WS',
])

export function isLegacyOpenTimeBarSource(source: string | null | undefined): boolean {
  return source != null && LEGACY_OPEN_TIME_BAR_SOURCES.has(source)
}

export function normalizeMarketBarCloseTimestamp(input: {
  timestamp: number
  timeframe: MarketTimeframe | PrismaMarketTimeframe
  source?: string | null
}): number {
  if (!isLegacyOpenTimeBarSource(input.source)) return input.timestamp

  const timeframe = normalizeTimeframe(input.timeframe)
  return input.timestamp + getMarketTimeframeMs(timeframe)
}

function normalizeTimeframe(timeframe: MarketTimeframe | PrismaMarketTimeframe): MarketTimeframe {
  if (/^[mhdw]\d+$/u.test(String(timeframe))) {
    return reverseMapTimeframe(timeframe as PrismaMarketTimeframe)
  }
  return timeframe as MarketTimeframe
}
