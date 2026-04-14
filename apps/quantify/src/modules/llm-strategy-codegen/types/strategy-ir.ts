import type { AtomicIntentRisk, AtomicIntentSizing } from './strategy-ambiguity'
import type { StrategyExecutionContext } from './strategy-execution-context'

export interface StrategyIrMarket {
  exchange: NonNullable<StrategyExecutionContext['exchange']>
  symbol: NonNullable<StrategyExecutionContext['symbol']>
  marketType: NonNullable<StrategyExecutionContext['marketType']>
  timeframe: NonNullable<StrategyExecutionContext['timeframe']>
}

export interface StrategyIrGridTrigger {
  range: {
    lower: number
    upper: number
  }
  stepPct: number
  sideMode: 'long_only' | 'short_only' | 'bidirectional'
  recycle: boolean
}

export interface StrategyIrGridIntent {
  kind: 'grid.range_rebalance'
  trigger: StrategyIrGridTrigger
  sizing: Omit<AtomicIntentSizing, 'kind'> | null
  actions: string[]
  risk: AtomicIntentRisk[]
}

export interface StrategyIR {
  version: 'strategy-ir.v1'
  market: StrategyIrMarket
  intent: StrategyIrGridIntent
}
