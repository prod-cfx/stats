export interface StrategyExecutionContext {
  exchange: 'okx' | 'binance' | 'hyperliquid' | null
  symbol: string | null
  marketType: 'spot' | 'perp' | null
  timeframe: string | null
}

export interface StrategyExecutionContextAmbiguity {
  kind: 'execution_context_missing'
  field: 'exchange' | 'symbol' | 'marketType' | 'timeframe'
  reason: 'missing_exchange' | 'missing_symbol' | 'missing_market_type' | 'missing_timeframe'
}

export interface StrategyExecutionContextResolution {
  context: StrategyExecutionContext
  ambiguities: StrategyExecutionContextAmbiguity[]
  evidence: Array<{
    key: string
    reason: string
    priority: number
    question?: string
  }>
}
