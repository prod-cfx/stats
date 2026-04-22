export interface StrategyRuleBasis {
  kind:
    | 'prev_close'
    | 'entry_avg_price'
    | 'position_pnl'
    | 'peak_equity'
    | 'peak_position_pnl'
    | 'upper_band'
    | 'lower_band'
    | 'middle_band'
    | 'last_high'
    | 'last_low'
}

export interface StrategyRuleDraft {
  id: string
  phase: 'entry' | 'exit' | 'risk'
  text: string
  timeframe: string | null
  basis?: StrategyRuleBasis['kind'] | null
}

export interface StrategyLogicSnapshot {
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
  entryRuleBases?: Record<string, StrategyRuleBasis['kind']>
  exitRuleBases?: Record<string, StrategyRuleBasis['kind']>
  entryRuleDrafts?: StrategyRuleDraft[]
  exitRuleDrafts?: StrategyRuleDraft[]
  riskRuleDrafts?: StrategyRuleDraft[]
  market?: {
    exchange?: 'binance' | 'okx' | 'hyperliquid'
    marketType?: 'spot' | 'perp'
    defaultTimeframe?: string | null
  }
  stateGates?: {
    trendDirection?: 'up' | 'down' | 'sideways'
    marketRegime?: 'trend' | 'range'
    volatilityState?: 'high' | 'low'
  }
  grid?: {
    lower?: number
    upper?: number
    stepPct?: number
    sideMode?: 'long_only' | 'short_only' | 'bidirectional'
    breakoutAction?: 'pause' | 'continue'
  }
}
