import type { Stage4BlockerKind } from './staging-dialogue-runner'

export type Stage4RealStrategyCategory =
  | 'simple_trend'
  | 'mean_reversion'
  | 'grid'
  | 'dca'
  | 'add_position'
  | 'portfolio_risk'
  | 'multi_timeframe'
  | 'multi_symbol'
  | 'data_source_binding'
  | 'action_lifecycle'
  | 'execution_program'

export interface Stage4ClarificationTurn {
  readonly assistantSlotPath: string
  readonly userAnswer: string
}

type Stage4RealStrategyExpectedFailure = Stage4BlockerKind | 'program_deploy_payload_binding_missing'

export interface Stage4RealStrategyCase {
  readonly id: string
  readonly category: Stage4RealStrategyCategory
  readonly initialUserMessage: string
  readonly expectedAtomKeys: readonly string[]
  readonly expectedSemanticIntent: readonly string[]
  readonly clarificationTurns: readonly Stage4ClarificationTurn[]
  readonly expectedFailure: Stage4RealStrategyExpectedFailure | null
}

export const STAGE4_REAL_STRATEGY_CORPUS = [
  {
    id: 'stage4-simple-trend-ema-cross-stop-sizing',
    category: 'simple_trend',
    initialUserMessage: 'OKX 永续 BTCUSDT 15m。EMA20 上穿 EMA50 开多，亏损 3% 止损，单笔使用 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'action.open_long', 'risk.stop_loss_pct', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'fixed stop loss', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-simple-trend-ema-open-close-long',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，EMA7 上穿 EMA21 时开多，下穿时平多，单笔 10%。',
    expectedAtomKeys: ['indicator.cross_over', 'indicator.cross_under', 'action.open_long', 'action.close_long', 'position.sizing'],
    expectedSemanticIntent: ['long trend entry', 'long trend exit', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-simple-trend-short-trailing',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，EMA20 下穿 EMA50 开空，EMA20 上穿 EMA50 平空，单笔 10%，开仓后用 3% 移动止损。',
    expectedAtomKeys: ['indicator.cross_under', 'indicator.cross_over', 'action.open_short', 'action.close_short', 'position.sizing', 'risk.trailing_stop_pct'],
    expectedSemanticIntent: ['short trend entry', 'short trend exit', 'fixed ratio sizing', 'trailing stop'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-mean-reversion-rsi-partial-tp',
    category: 'mean_reversion',
    initialUserMessage: 'OKX 永续 BTCUSDT 15m。RSI14 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。',
    expectedAtomKeys: ['oscillator.rsi_lte', 'action.open_long', 'risk.partial_take_profit'],
    expectedSemanticIntent: ['mean reversion entry', 'partial take profit exit'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-mean-reversion-rsi-short-cycle',
    category: 'mean_reversion',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，RSI14 高于 70 开空，RSI14 低于 30 平空，单笔 10%，亏损 3% 止损。',
    expectedAtomKeys: ['oscillator.rsi_gte', 'oscillator.rsi_lte', 'action.open_short', 'action.close_short', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['overbought short entry', 'oversold short exit', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-mean-reversion-rsi-long-cycle',
    category: 'mean_reversion',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，RSI14 低于 30 开多，RSI14 高于 70 平多，单笔 10%，亏损 3% 止损。',
    expectedAtomKeys: ['oscillator.rsi_lte', 'oscillator.rsi_gte', 'action.open_long', 'action.close_long', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['oversold long entry', 'overbought long exit', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-breakout-volume-max-loss',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，突破过去 20 根 K 线高点并且成交量超过 20 根均量 1.5 倍时开多，单笔 10%，单笔最多亏 2%。',
    expectedAtomKeys: ['price.breakout_up', 'volume.threshold', 'action.open_long', 'position.sizing', 'risk.max_loss_per_trade'],
    expectedSemanticIntent: ['breakout long entry', 'volume confirmation', 'fixed ratio sizing', 'per trade loss cap'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-breakout-volume-trailing-long',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，突破过去 30 根 K 线高点并且成交量超过 20 根均量 2 倍时开多，单笔 10%，开仓后用 4% 移动止损。',
    expectedAtomKeys: ['price.breakout_up', 'volume.threshold', 'action.open_long', 'position.sizing', 'risk.trailing_stop_pct'],
    expectedSemanticIntent: ['breakout long entry', 'volume confirmation', 'fixed ratio sizing', 'trailing stop'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-breakout-pullback-hold-long',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，突破 20 根高点后回踩不破再开多，单笔 10%。',
    expectedAtomKeys: ['price.breakout_up', 'price.previous_extrema_retest', 'pattern.pullback', 'action.open_long', 'position.sizing'],
    expectedSemanticIntent: ['breakout memory', 'pullback hold entry', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-breakdown-short-stop',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，跌破过去 20 根 K 线低点开空，价格重新站上 EMA20 平空，单笔 10%，亏损 3% 止损。',
    expectedAtomKeys: ['price.breakout_down', 'indicator.above', 'action.open_short', 'action.close_short', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['breakdown short entry', 'indicator exit', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-time-window-trend-entry',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，北京时间 09:30-15:00 内允许开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expectedAtomKeys: ['strategy.time_window', 'indicator.cross_over', 'action.open_long', 'position.sizing'],
    expectedSemanticIntent: ['session gate', 'trend entry', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-trend-cooldown-after-stop',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，亏损 3% 止损，止损后冷却 5 根 K 线再开仓，单笔 10%。',
    expectedAtomKeys: ['indicator.cross_over', 'action.open_long', 'risk.stop_loss_pct', 'risk.cooldown', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'fixed stop loss', 'post stop cooldown', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-short-trend-cooldown-after-stop',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，MA20 下穿 MA50 开空，亏损 3% 止损，止损后冷却 5 根 K 线再开仓，单笔 10%。',
    expectedAtomKeys: ['indicator.cross_under', 'action.open_short', 'risk.stop_loss_pct', 'risk.cooldown', 'position.sizing'],
    expectedSemanticIntent: ['short trend entry', 'fixed stop loss', 'post stop cooldown', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-grid-range-risk-sizing',
    category: 'grid',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，价格维持在震荡区间内时开多，单笔 10% 仓位。',
    expectedAtomKeys: ['pattern.range', 'position.sizing'],
    expectedSemanticIntent: ['range-bound grid gate', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-dca-schedule-budget',
    category: 'dca',
    initialUserMessage: 'OKX 合约 BTCUSDT 1h，价格每回撤 3% 补仓，最多 3 次，每次 100 USDT，总预算最多 1000 USDT。',
    expectedAtomKeys: ['position.dca_schedule', 'position.budget_cap'],
    expectedSemanticIntent: ['drawdown DCA schedule', 'budget cap'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破本轮均价 8% 时全部退出。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-dca-schedule-fixed-ratio',
    category: 'dca',
    initialUserMessage: 'OKX 合约 BTCUSDT 1h，价格每跌 5% 补仓一次，最多补三次，每次使用 10% 仓位。',
    expectedAtomKeys: ['position.dca_schedule', 'position.sizing'],
    expectedSemanticIntent: ['drawdown DCA schedule', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破本轮均价 8% 时全部退出。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-add-position-pyramiding',
    category: 'add_position',
    initialUserMessage: 'OKX 永续 BTCUSDT 15m。EMA20 上穿开多，盈利 2% 后加仓 10%，最多加仓 2 次，单笔使用 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'action.open_long', 'action.add_position', 'position.pyramiding_limit', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'pyramiding limit', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-short-add-position-pyramiding',
    category: 'add_position',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，EMA20 下穿 EMA50 开空，盈利 2% 后加仓 10%，最多加仓 2 次，单笔使用 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_under', 'action.open_short', 'action.add_position', 'position.pyramiding_limit', 'position.sizing'],
    expectedSemanticIntent: ['short trend entry', 'pyramiding limit', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '价格重新站上 EMA20 时平空。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-portfolio-risk-drawdown-only',
    category: 'portfolio_risk',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，最大回撤超过 8% 停止开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expectedAtomKeys: ['risk.max_drawdown_pct', 'indicator.cross_over', 'action.open_long', 'position.sizing'],
    expectedSemanticIntent: ['account drawdown guard', 'trend entry', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-portfolio-risk-short-drawdown-only',
    category: 'portfolio_risk',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，最大回撤超过 8% 停止开仓，MA20 下穿 MA50 开空，单笔 10%。',
    expectedAtomKeys: ['risk.max_drawdown_pct', 'indicator.cross_under', 'action.open_short', 'position.sizing'],
    expectedSemanticIntent: ['account drawdown guard', 'short trend entry', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '价格重新站上 EMA20 时平空。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-indicator-threshold-long-filter',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，价格高于 EMA50 且 EMA20 上穿 EMA50 时开多，单笔 10%，亏损 3% 止损。',
    expectedAtomKeys: ['indicator.above', 'indicator.cross_over', 'action.open_long', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['indicator threshold filter', 'trend entry', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-indicator-threshold-short-filter',
    category: 'simple_trend',
    initialUserMessage: 'OKX 合约 ETHUSDT 15m，价格低于 EMA50 且 EMA20 下穿 EMA50 时开空，单笔 10%，亏损 3% 止损。',
    expectedAtomKeys: ['indicator.below', 'indicator.cross_under', 'action.open_short', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['indicator threshold filter', 'short trend entry', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-portfolio-risk-drawdown-exposure',
    category: 'portfolio_risk',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，EMA20 上穿 EMA50 开多，最大回撤超过 8% 停止开仓，最大敞口不超过账户 30%。',
    expectedAtomKeys: ['indicator.cross_over', 'risk.max_drawdown_pct', 'portfolioRisk.drawdown_block', 'position.max_exposure_pct'],
    expectedSemanticIntent: ['trend entry', 'portfolio drawdown guard', 'exposure cap'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-multi-timeframe-trend-confirmation',
    category: 'multi_timeframe',
    initialUserMessage: 'BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'indicator.above', 'position.sizing', 'scope.timeframe'],
    expectedSemanticIntent: ['lower timeframe entry', 'higher timeframe gate', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-multi-symbol-shared-risk',
    category: 'multi_symbol',
    initialUserMessage: 'OKX 永续 BTCUSDT 和 ETHUSDT 15m 都按 EMA20 上穿 EMA50 开多，单笔使用 10% 仓位，亏损 3% 止损。',
    expectedAtomKeys: ['indicator.cross_over', 'position.sizing', 'risk.stop_loss_pct', 'scope.symbol'],
    expectedSemanticIntent: ['shared symbol basket rule', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-regime-gate-trend-filter',
    category: 'portfolio_risk',
    initialUserMessage: 'BTCUSDT 15m。价格高于 EMA50 才允许做多，EMA20 上穿 EMA50 开多，单笔 10% 仓位。',
    expectedAtomKeys: ['gate.regime', 'indicator.cross_over', 'position.sizing'],
    expectedSemanticIntent: ['regime gate', 'trend entry', 'fixed ratio sizing'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-orderbook-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。EMA20 上穿开多，但需要 OKX orderbook imbalance 大于 60% 确认。',
    expectedAtomKeys: ['orderbook.imbalance'],
    expectedSemanticIntent: ['orderbook confirmation source', 'fail closed without data-source binding'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-funding-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。',
    expectedAtomKeys: ['fundingRate.condition'],
    expectedSemanticIntent: ['funding rate confirmation source', 'fail closed without data-source binding'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-open-interest-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。',
    expectedAtomKeys: ['openInterest.condition'],
    expectedSemanticIntent: ['open interest confirmation source', 'fail closed without data-source binding'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-liquidation-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，出现多头清算超过 100 万 USDT 后开空，单笔 10% 仓位。',
    expectedAtomKeys: ['liquidation.condition'],
    expectedSemanticIntent: ['liquidation event source', 'fail closed without data-source binding'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '价格重新站上 EMA20 时平空。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-webhook-event-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，收到 TradingView webhook buy 信号后开多，单笔 10% 仓位。',
    expectedAtomKeys: ['external.signal'],
    expectedSemanticIntent: ['external webhook event source', 'fail closed without data-source binding'],
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedFailure: null,
  },
  {
    id: 'stage4-action-reverse-position',
    category: 'action_lifecycle',
    initialUserMessage: 'OKX 永续 BTCUSDT 15m。EMA20 下穿 EMA50 时从多头反手做空，单笔 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_under', 'action.reverse_position'],
    expectedSemanticIntent: ['trend reversal trigger', 'reverse from long to short'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-program-fixed-grid-gated',
    category: 'execution_program',
    initialUserMessage: 'OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。',
    expectedAtomKeys: ['program.fixed_grid_gated'],
    expectedSemanticIntent: ['fixed grid program enters rules effects programs', 'deploy payload binding still missing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
] as const satisfies readonly Stage4RealStrategyCase[]
