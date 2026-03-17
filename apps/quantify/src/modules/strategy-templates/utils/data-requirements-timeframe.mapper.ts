import type { MarketTimeframe } from '@ai/shared'
import type { StrategyDataRequirements } from '../types/strategy-template.types'
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import { ErrorCode } from '@ai/shared'
import { mapTimeframe, SUPPORTED_MARKET_TIMEFRAMES } from '@/common/utils/prisma-enum-mappers'

export interface LegDataRequirementTimeframe {
  appTimeframe: MarketTimeframe
  prismaTimeframe: PrismaMarketTimeframe
}

const SUPPORTED_TIMEFRAMES = new Set<string>(SUPPORTED_MARKET_TIMEFRAMES)

function isMarketTimeframe(value: unknown): value is MarketTimeframe {
  return typeof value === 'string' && SUPPORTED_TIMEFRAMES.has(value)
}

export function parseDataRequirements(raw: unknown): StrategyDataRequirements | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const parsed: StrategyDataRequirements = {}
  for (const [legId, maybeTimeframes] of Object.entries(raw)) {
    if (!Array.isArray(maybeTimeframes) || maybeTimeframes.length === 0) {
      return null
    }

    const timeframes: MarketTimeframe[] = []
    for (const timeframe of maybeTimeframes) {
      if (!isMarketTimeframe(timeframe)) {
        return null
      }
      timeframes.push(timeframe)
    }

    parsed[legId] = timeframes
  }

  return parsed
}

export function mapLegDataRequirementTimeframes(
  dataRequirements: StrategyDataRequirements,
  legId: string,
): LegDataRequirementTimeframe[] {
  const timeframes = dataRequirements[legId] ?? []
  return timeframes.map(timeframe => ({
    appTimeframe: timeframe,
    prismaTimeframe: mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME),
  }))
}
