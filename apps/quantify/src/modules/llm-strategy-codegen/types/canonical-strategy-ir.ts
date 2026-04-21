export type HashString = `sha256:${string}`

export interface CanonicalStrategyIrV1 {
  irVersion: 'csi.v1'
  source: {
    graphVersion: number
    graphDigest: HashString
    specHash: HashString
  }
  market: {
    venue: 'binance' | 'okx' | 'hyperliquid'
    instrumentType: 'spot' | 'perpetual'
    symbol: string
    timeframes: string[]
    priceFeed: 'close' | 'hlc3' | 'ohlc4'
  }
  portfolio: {
    positionMode: 'long_only' | 'short_only' | 'long_short'
    sizing: {
      mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
      value: number
    }
    maxConcurrentPositions: number
    allowPyramiding: boolean
    maxPyramidingLayers: number
  }
  dataRequirements: {
    warmupBars: number
    maxLookback: number
    requiredTimeframes: string[]
  }
  signalCatalog: {
    series: SeriesDef[]
    levelSets: LevelSetDef[]
    predicates: PredicateDef[]
  }
  ruleBlocks: RuleBlock[]
  orderPrograms: OrderProgram[]
  riskPolicy: {
    guards: RiskGuard[]
  }
  executionPolicy: {
    signalEvaluation: 'bar_close'
    fillPolicy: 'next_bar_open' | 'same_bar_close' | 'intra_bar_limit_match'
    timeframeAlignment: 'strict'
    orderTypeDefault: 'market' | 'limit'
    timeInForce: 'gtc' | 'ioc' | 'fok'
    allowPartialFill: boolean
  }
}

export interface SeriesDef {
  id: string
  kind:
    | 'PRICE'
    | 'BAR_INDEX'
    | 'CONST'
    | 'MARKET_REGIME'
    | 'TREND_DIRECTION'
    | 'VOLATILITY_STATE'
    | 'PRICE_CHANGE_PCT'
    | 'POSITION_AVG_PRICE'
    | 'POSITION_PNL_PCT'
    | 'BOLLINGER_BARS_OUTSIDE'
    | 'SMA'
    | 'EMA'
    | 'RSI'
    | 'ATR'
    | 'MACD_LINE'
    | 'MACD_SIGNAL'
    | 'HIGHEST_HIGH'
    | 'LOWEST_LOW'
    | 'POSITION_BARS_HELD'
    | 'STDDEV'
    | 'UPPER_BAND'
    | 'MID_BAND'
    | 'LOWER_BAND'
  timeframe?: string
  field?: 'open' | 'high' | 'low' | 'close'
  offsetBars?: number
  inputs?: string[]
  params?: Record<string, number | string>
  value?: number | string
}

export interface LevelSetDef {
  id: string
  kind: 'ARITHMETIC_LEVEL_SET' | 'GEOMETRIC_LEVEL_SET'
  anchorRef: string
  spacing: {
    mode: 'pct' | 'absolute' | 'atr_multiple'
    value: number
  }
  levelsPerSide: {
    down: number
    up: number
  }
  hardBounds?: {
    lowerRef: string
    upperRef: string
  }
}

export interface PredicateDef {
  id: string
  kind:
    | 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'
    | 'CROSS_OVER' | 'CROSS_UNDER'
    | 'BETWEEN'
    | 'TOUCH_LEVEL_UP' | 'TOUCH_LEVEL_DOWN'
    | 'AND' | 'OR' | 'NOT'
  args: string[]
}

export interface RuleBlock {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  when: string
  priority: number
  cooldownBars?: number
  guardRefs?: string[]
  actions: ActionDef[]
}

export interface ActionDef {
  kind:
    | 'OPEN_LONG' | 'CLOSE_LONG'
    | 'OPEN_SHORT' | 'CLOSE_SHORT'
    | 'REDUCE_LONG' | 'REDUCE_SHORT'
  quantity: {
    mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
    value: number
  }
}

export interface OrderProgram {
  id: string
  kind: 'LIMIT_LADDER'
  activeWhen: string
  side: 'buy' | 'sell'
  priceSource: 'level_set' | 'offset_from_price'
  levelSetRef?: string
  offset?: {
    basis: 'pct' | 'absolute' | 'atr_multiple'
    value: number
    anchorRef: string
  }
  tickPolicy: 'round' | 'floor' | 'ceil'
  quantity: {
    mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
    value: number
  }
  orderType: 'limit'
  recycleOnFill: boolean
  maxWorkingOrders: number
  group: string
}

export interface RiskGuard {
  id: string
  kind:
    | 'STOP_LOSS_PCT'
    | 'TAKE_PROFIT_PCT'
    | 'MAX_SINGLE_LOSS_PCT'
    | 'MAX_DRAWDOWN_PCT'
    | 'MAX_POSITION_PCT'
    | 'TRAILING_STOP_PCT'
    | 'HARD_PRICE_STOP'
  scope: 'position' | 'strategy' | 'order_program'
  appliesTo?: string
  value?: number
  referenceRef?: string
  onBreach: 'BLOCK_NEW_ENTRY' | 'FORCE_EXIT' | 'HALT_STRATEGY' | 'CANCEL_ORDER_PROGRAMS'
}
