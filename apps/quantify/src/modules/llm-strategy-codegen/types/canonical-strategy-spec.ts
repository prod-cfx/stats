export type CanonicalAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'ADJUST_POSITION'
export type CanonicalSizingMode = 'RATIO' | 'QUOTE' | 'QTY'
export type CanonicalIndicatorKind = 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd' | 'custom'

export interface RuleSpec {
  id: string
  trigger: string
  action: CanonicalAction
  notes?: string
}

export interface RiskRuleSpec {
  id: string
  trigger: string
  effect: 'FORCE_STOP' | 'REDUCE_POSITION' | 'BLOCK_NEW_ENTRY'
  notes?: string
}

export interface CanonicalStrategySpec {
  version: 1
  market: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    marketType: 'spot' | 'perp'
    timeframe: string
  }
  indicators: Array<{
    kind: CanonicalIndicatorKind
    params: Record<string, number | string | boolean>
  }>
  entries: RuleSpec[]
  exits: RuleSpec[]
  riskRules: RiskRuleSpec[]
  sizing: {
    mode: CanonicalSizingMode
    value: number
  }
  executionPolicy: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN'
  }
  dataRequirements: Record<string, string[]>
}
