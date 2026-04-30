export type StrategyPlazaTemplateId =
  | 'ma-cross'
  | 'bollinger-reversion'
  | 'grid-range'
  | 'rsi-reversal'
  | 'breakout-follow'
  | 'macd-cross'

export type StrategyPlazaMarketType = 'spot' | 'perp'
export type StrategyPlazaRiskLevel = 'low' | 'medium' | 'high'
export type StrategyPlazaTemplateStatus = 'live' | 'hidden'
export type StrategyPlazaDeploymentPriceSource = 'last' | 'mark'
export type StrategyPlazaDeploymentOrderType = 'market'
export type StrategyPlazaDeploymentTimeInForce = 'ioc'
export type StrategyPlazaDeploymentTradeMode = 'cash' | 'cross' | 'isolated'
export type StrategyPlazaEvidenceExchange = 'okx' | 'binance'
export type StrategyPlazaEvidenceMarketType = 'spot' | 'swap'

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

export interface OfficialStrategyPlazaEvidenceTemplate {
  templateId: string
  parameterSearchId: string
  exchange: StrategyPlazaEvidenceExchange
  symbol: string
  interval: string
  marketType: StrategyPlazaEvidenceMarketType
  source: string
  dataSource: OfficialStrategyPlazaEvidenceDataSource
  backtestFrom: number
  backtestTo: number
  admission: OfficialStrategyPlazaBacktestAdmission
  candidateCount: number
  candleCount: number
  fromTs: number
  toTs: number
  params: Record<string, number>
  metrics: OfficialStrategyPlazaBacktestMetrics
  best: {
    params: Record<string, number>
    metrics: OfficialStrategyPlazaBacktestMetrics
  }
  semanticReason?: string
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
    tdMode?: StrategyPlazaDeploymentTradeMode | null
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
}

export interface OfficialStrategyPlazaTemplate {
  id: StrategyPlazaTemplateId
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
  editSeed: OfficialStrategyPlazaEditSeed
  displayMetrics: {
    label: 'official_sample_backtest'
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
  }
}
