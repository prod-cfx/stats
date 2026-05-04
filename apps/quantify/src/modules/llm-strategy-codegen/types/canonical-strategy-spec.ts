import type { CanonicalStrategySpecV2 as BaseCanonicalStrategySpecV2 } from './canonical-strategy-spec-v2'

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

export interface CanonicalStrategySpecV1 {
  version: 1
  market: {
    exchange?: 'binance' | 'okx' | 'hyperliquid'
    symbol?: string
    marketType?: 'spot' | 'perp'
    timeframe?: string
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
  } | null
  executionPolicy: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN'
  }
  dataRequirements: {
    primary: string[]
  }
}

export interface CanonicalOrderProgramIntent {
  id: string
  kind: 'contract_order_program'
  mode: 'spot' | 'perp_long' | 'perp_short' | 'perp_neutral'
  levelSet: {
    mode?: 'static_range' | 'centered_percent_range'
    lower?: number
    upper?: number
    centerTiming?: 'deployment' | 'runtime'
    centerSource?: string
    halfRangePct?: number
    gridCount?: number
    spacingPct?: number
    spacingMode: 'arithmetic' | 'geometric'
  }
  budget: {
    mode: 'per_order_quote' | 'total_quote' | 'per_order_pct_equity'
    value: number
    asset?: string
  }
  orderType: 'limit'
  timeInForce: 'gtc'
  recycleOnFill: boolean
  cancelOnStop: boolean
}

export interface CanonicalStrategySpecV2 extends BaseCanonicalStrategySpecV2 {
  orderPrograms?: CanonicalOrderProgramIntent[]
}

export type CanonicalAction =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'REDUCE_LONG'
  | 'REDUCE_SHORT'
  | 'FORCE_EXIT'
  | 'BLOCK_NEW_ENTRY'
  | 'ADJUST_POSITION'

export type CanonicalStrategySpec = CanonicalStrategySpecV1 | CanonicalStrategySpecV2
export type CanonicalStrategySpecAnyVersion = CanonicalStrategySpec

export type {
  CanonicalConditionAtom,
  CanonicalExpressionCondition,
  CanonicalConditionGroup,
  CanonicalConditionNode,
  CanonicalRiskRuleSideScope,
  CanonicalRuleAction,
  CanonicalRuleActionType,
  CanonicalRulePhase,
  CanonicalRuleSideScope,
  CanonicalRuleV2,
} from './canonical-strategy-spec-v2'
