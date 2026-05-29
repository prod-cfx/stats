import type { MarketTimeframe } from '@ai/shared'

export interface RuntimePrimaryClock {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  timeframe: MarketTimeframe
}

export interface RuntimeMarketSeriesRequirement {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  timeframe: MarketTimeframe
}

export interface RuntimeIndicatorRequirement {
  indicator: 'ema'
  period: number
  timeframe: MarketTimeframe
}

export interface RuntimeExternalDataSourceRequirement {
  role: string
  feedId: string
  schemaRef: string
}

export interface RuntimeEventStreamRequirement {
  sourceRef: string
}

export interface RuntimeDataPlan {
  primaryClock: RuntimePrimaryClock
  marketSeries: RuntimeMarketSeriesRequirement[]
  indicators: RuntimeIndicatorRequirement[]
  externalDataSources: RuntimeExternalDataSourceRequirement[]
  eventStreams: RuntimeEventStreamRequirement[]
}

export function uniqTimeframes(timeframes: MarketTimeframe[]): MarketTimeframe[] {
  return Array.from(new Set(timeframes))
}
