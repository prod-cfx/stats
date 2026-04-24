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
    exchange?: 'okx'
    symbol?: string
    timeframe?: string
    positionPct?: number
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
