import type { CanonicalSizingMode } from './canonical-strategy-spec'

export type StrategySummaryType = 'bollinger' | 'movingAverage' | 'momentum' | 'volatility' | 'custom'

export type StrategySummaryIndicator = 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd'

export type StrategySummarySizingEvidence = 'explicit' | 'unresolved'

export interface StrategySummarySizing {
  mode: CanonicalSizingMode
  evidence: StrategySummarySizingEvidence
}

export interface StrategySummary {
  strategyType: StrategySummaryType
  indicators: StrategySummaryIndicator[]
  entryRule: string
  exitRule: string
  market: {
    symbol?: string
    timeframe?: string
    marketType?: 'spot' | 'perp'
  }
  sizing: StrategySummarySizing | null
}
