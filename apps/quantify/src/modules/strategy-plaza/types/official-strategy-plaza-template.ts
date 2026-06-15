import type { OfficialStrategyPlazaCategory } from '../constants/official-strategy-plaza-category'

export type StrategyPlazaTemplateId =
  | 'ma-cross'
  | 'bollinger-reversion'
  | 'grid-range'
  | 'rsi-reversal'
  | 'breakout-follow'
  | 'macd-cross'
  | 'ema-trend-continuation'
  | 'ema-slope-trend'
  | 'multi-timeframe-trend'
  | 'macd-momentum-filter'
  | 'breakout-volume-confirm'
  | 'breakout-pullback-hold'
  | 'breakdown-short-follow'
  | 'bollinger-breakout-stop'
  | 'rsi-cycle-reversion'
  | 'indicator-boundary-reversion'
  | 'range-edge-reversal'
  | 'fixed-grid-gated'
  | 'trend-filtered-grid'
  | 'grid-breakout-stop'
  | 'drawdown-dca-budget'
  | 'timed-dca-budget'
  | 'dca-program-start'
  | 'orderbook-imbalance-long'
  | 'orderbook-spread-post-only'
  | 'orderbook-depth-ratio-confirm'
  | 'funding-rate-mean-reversion'
  | 'open-interest-breakout'
  | 'liquidation-cascade-short'
  | 'funding-oi-confirmation'
  | 'drawdown-guard-trend'
  | 'exposure-cap-trend'
  | 'cooldown-after-stop'
  | 'low-drawdown-regime-gate'

export type StrategyPlazaMarketType = 'spot' | 'perp'
export type StrategyPlazaRiskLevel = 'low' | 'medium' | 'high'
export type StrategyPlazaTemplateStatus = 'live' | 'hidden'
export type StrategyPlazaDeploymentPriceSource = 'last' | 'mark'
export type StrategyPlazaDeploymentOrderType = 'market'
export type StrategyPlazaDeploymentTimeInForce = 'ioc'
export type StrategyPlazaEvidenceExchange = 'okx' | 'binance'
export type StrategyPlazaEvidenceMarketType = 'spot' | 'swap'
export type StrategyPlazaBacktestRangePreset = '7D' | '30D'

export interface OfficialStrategyPlazaBacktestAdmission {
  maxDrawdownPctCeiling: number
  minWinRate: number
  minTradeCount: number
  minTotalReturnPct: number
}

export interface OfficialStrategyPlazaBacktestMetrics {
  winRate: number
  maxDrawdownPct: number
  totalReturnPct: number
  tradeCount: number
}

export interface OfficialStrategyPlazaEvidenceEquityPoint {
  ts: number
  equity: number
}

export interface OfficialStrategyPlazaEvidenceTrade {
  id: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  returnPct: number
  reasonOpen?: string
  reasonClose?: string
  reasonOpenDisplay?: string
  reasonCloseDisplay?: string
}

export type StrategyPlazaOfficialBacktestConfidenceLevel = 'high' | 'medium' | 'low'

export interface StrategyPlazaOfficialBacktestConfidence {
  level: StrategyPlazaOfficialBacktestConfidenceLevel
  reasons: string[]
}

export type OfficialStrategyPlazaTemplateAdmission = OfficialStrategyPlazaBacktestAdmission

export interface OfficialStrategyPlazaEvidenceDataSource {
  exchange: StrategyPlazaEvidenceExchange
  marketType: StrategyPlazaEvidenceMarketType
  endpoint: string
  fixedEndTs: number
  pagination: {
    parameter: string
    pageLimit: number
    pageCount: number
  }
}

export interface OfficialStrategyPlazaEvidenceEventDataSource {
  schemaRef: 'orderbook' | 'funding' | 'open_interest' | 'liquidation'
  endpoint: string
  sampleCount: number
  fixedEndTs?: number
}

export interface OfficialStrategyPlazaEvidenceTemplate {
  templateId: string
  parameterSearchId: string
  exchange: StrategyPlazaEvidenceExchange
  symbol: string
  interval: string
  marketType: StrategyPlazaEvidenceMarketType
  source: string
  dataSource: OfficialStrategyPlazaEvidenceDataSource
  eventDataSources?: OfficialStrategyPlazaEvidenceEventDataSource[]
  backtestFrom: number
  backtestTo: number
  admission: OfficialStrategyPlazaBacktestAdmission
  candidateCount: number
  candleCount: number
  fromTs: number
  toTs: number
  params: Record<string, number>
  metrics: OfficialStrategyPlazaBacktestMetrics
  trades: OfficialStrategyPlazaEvidenceTrade[]
  equityCurve: OfficialStrategyPlazaEvidenceEquityPoint[]
  best: {
    params: Record<string, number>
    metrics: OfficialStrategyPlazaBacktestMetrics
  }
  semanticReason?: string
}

export interface StrategyPlazaOfficialBacktest {
  generatedAt: string
  backtestFrom: number
  backtestTo: number
  source: string
  dataSource: OfficialStrategyPlazaEvidenceDataSource
  eventDataSources?: OfficialStrategyPlazaEvidenceEventDataSource[]
  candleCount: number
  metrics: {
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    tradeCount: number | null
  }
  equityCurve: OfficialStrategyPlazaEvidenceEquityPoint[]
  trades: OfficialStrategyPlazaEvidenceTrade[]
  confidence: StrategyPlazaOfficialBacktestConfidence
  disclaimer: string
}

export interface OfficialStrategyPlazaBacktestEvidence {
  status: 'VERIFIED'
  generatedAt: string
  generatedBy: string
  admission: OfficialStrategyPlazaBacktestAdmission
  templates: OfficialStrategyPlazaEvidenceTemplate[]
}

export interface OfficialStrategyPlazaRunConfig {
  exchange: 'okx'
  marketType: StrategyPlazaMarketType
  symbol: string
  timeframe: string
  positionPct: number
  leverage: number | null
  publishedSnapshotId: string
  deploymentExecutionConfig: {
    leverage?: number | null
    priceSource?: StrategyPlazaDeploymentPriceSource | null
    orderType?: StrategyPlazaDeploymentOrderType | null
    timeInForce?: StrategyPlazaDeploymentTimeInForce | null
  }
}

export interface OfficialStrategyPlazaEditSeed {
  initialMessage: string
  guideConfig?: {
    symbolExample?: string
    timeframeExample?: string
    entryRuleExample?: string
    exitRuleExample?: string
    riskRuleExample?: string
  }
  locales?: Partial<Record<'zh' | 'en', {
    initialMessage: string
    guideConfig?: OfficialStrategyPlazaEditSeed['guideConfig']
  }>>
}

export interface OfficialStrategyPlazaTemplate {
  id: StrategyPlazaTemplateId
  category: OfficialStrategyPlazaCategory
  name: string
  description: string
  logicDescription: string
  tags: string[]
  riskLevel: StrategyPlazaRiskLevel
  scenario: string
  exchange: 'okx'
  environment: 'demo'
  status: StrategyPlazaTemplateStatus
  displayOrder: number
  runConfig: OfficialStrategyPlazaRunConfig
  backtestRangePreset?: StrategyPlazaBacktestRangePreset
  editSeed: OfficialStrategyPlazaEditSeed
  expectedAtomKeys: readonly string[]
  admission: OfficialStrategyPlazaTemplateAdmission
  displayMetrics: {
    label: 'official_sample_backtest'
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    sharpe?: number | null
    profitLossRatio?: number | null
    tradeCount?: number | null
    users?: number | null
  }
  officialBacktest: StrategyPlazaOfficialBacktest
  sparkline?: number[]
  params?: Record<string, number>
  signals?: OfficialStrategyPlazaSignal[]
  equityCurve?: number[]
}

export interface OfficialStrategyPlazaSignal {
  time: string
  side: 'buy' | 'sell'
  price: number
  pnlPercent: number
}
