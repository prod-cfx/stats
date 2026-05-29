import type { MarketTimeframe } from '@ai/shared'
import type { Bar } from '@/modules/backtesting/types/backtesting.types'
import { getClosedBarsAsOf, toRuntimeScriptBars } from './runtime-data-portal'

export interface BuildRuntimeMarketContextInput {
  symbol: string
  baseTimeframe: MarketTimeframe
  primaryCloseTs: number
  params: Record<string, unknown>
  barsByTimeframe: Record<string, Bar[]>
}

export function buildRuntimeMarketContext(input: BuildRuntimeMarketContextInput) {
  const primaryLegId = 'primary'
  const dataForPrimary: Record<
    string,
    {
      bars: ReturnType<typeof toRuntimeScriptBars>
      indicators: Record<string, number>
      currentPrice: number
    }
  > = {}

  for (const [timeframe, bars] of Object.entries(input.barsByTimeframe)) {
    const closedBars = getClosedBarsAsOf(bars, input.primaryCloseTs)
    if (closedBars.length === 0) continue

    dataForPrimary[timeframe] = {
      bars: toRuntimeScriptBars(closedBars),
      indicators: {},
      currentPrice: closedBars[closedBars.length - 1]!.close,
    }
  }

  return {
    data: { [primaryLegId]: dataForPrimary },
    execution: { timeframe: input.baseTimeframe },
    legs: [{ id: primaryLegId, symbol: input.symbol, role: 'primary' }],
    dataRequirements: { [primaryLegId]: Object.keys(dataForPrimary) },
    timestamp: input.primaryCloseTs,
    params: input.params,
  }
}
