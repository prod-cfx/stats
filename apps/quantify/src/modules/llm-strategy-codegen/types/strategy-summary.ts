import type { CanonicalSizingMode } from './canonical-strategy-spec'

export type StrategySummaryType = 'bollinger' | 'movingAverage' | 'momentum' | 'volatility' | 'custom'

export type StrategySummaryIndicator = 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd'

export type StrategySummarySizingEvidence = 'explicit' | 'unresolved'

// #1186 PR5 (NC3): 多腿渲染需要专属 mode；单腿沿用窄 CanonicalSizingMode。
// 单 leg 永远不会是 'MULTI_LEG'，所以 legs[*].mode 仍用窄 union。
export type StrategySummarySizingMode = CanonicalSizingMode | 'MULTI_LEG'

export interface StrategySummarySizingLeg {
  legId: string
  mode: CanonicalSizingMode
  value: number
  asset?: string
  scopeKey: string
}

export interface StrategySummarySizing {
  mode: StrategySummarySizingMode
  evidence: StrategySummarySizingEvidence
  // #1186 PR5: 单腿场景用 value/asset；多腿用 legs[]，互斥语义由 builder 保证。
  value?: number
  asset?: string
  legs?: ReadonlyArray<StrategySummarySizingLeg>
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
