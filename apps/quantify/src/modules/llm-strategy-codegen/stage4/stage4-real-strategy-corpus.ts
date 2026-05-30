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
    initialUserMessage: 'binance 永续 BTCUSDT 15m。EMA20 上穿 EMA50 开多，亏损 3% 止损，单笔使用 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'risk.stop_loss_pct', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'fixed stop loss', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-mean-reversion-rsi-partial-tp',
    category: 'mean_reversion',
    initialUserMessage: 'binance 永续 BTCUSDT 15m。RSI14 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。',
    expectedAtomKeys: ['oscillator.rsi_lte', 'risk.partial_take_profit'],
    expectedSemanticIntent: ['mean reversion entry', 'partial take profit exit'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-grid-range-risk-sizing',
    category: 'grid',
    initialUserMessage: '价格维持在震荡区间内时开多，单笔 10% 仓位。',
    expectedAtomKeys: ['pattern.range', 'position.sizing'],
    expectedSemanticIntent: ['range-bound grid gate', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: 'ir_compile_missing_branch',
  },
  {
    id: 'stage4-dca-schedule-budget',
    category: 'dca',
    initialUserMessage: 'BTC 回撤 3% 补仓，最多 3 次，每次 100 USDT，总预算最多 1000 USDT。',
    expectedAtomKeys: ['position.dca_schedule', 'position.budget_cap'],
    expectedSemanticIntent: ['drawdown DCA schedule', 'budget cap'],
    clarificationTurns: [],
    expectedFailure: 'runtime_missing_data',
  },
  {
    id: 'stage4-add-position-pyramiding',
    category: 'add_position',
    initialUserMessage: 'binance 永续 BTCUSDT 15m。EMA20 上穿开多，盈利 2% 后加仓 10%，最多加仓 2 次，单笔使用 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'position.pyramiding_limit', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'pyramiding limit', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-portfolio-risk-drawdown-exposure',
    category: 'portfolio_risk',
    initialUserMessage: 'EMA20 上穿开多，最大回撤超过 8% 停止开仓，最大敞口不超过账户 30%。',
    expectedAtomKeys: ['indicator.cross_over', 'risk.max_drawdown_pct', 'position.max_exposure_pct'],
    expectedSemanticIntent: ['trend entry', 'portfolio drawdown guard', 'exposure cap'],
    clarificationTurns: [],
    expectedFailure: 'runtime_missing_data',
  },
  {
    id: 'stage4-multi-timeframe-trend-confirmation',
    category: 'multi_timeframe',
    initialUserMessage: 'BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'indicator.above', 'position.sizing'],
    expectedSemanticIntent: ['lower timeframe entry', 'higher timeframe gate', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-multi-symbol-shared-risk',
    category: 'multi_symbol',
    initialUserMessage: 'binance 永续 BTCUSDT 和 ETHUSDT 15m 都按 EMA20 上穿 EMA50 开多，单笔使用 10% 仓位，亏损 3% 止损。',
    expectedAtomKeys: ['indicator.cross_over', 'position.sizing', 'risk.stop_loss_pct'],
    expectedSemanticIntent: ['shared symbol basket rule', 'fixed ratio sizing', 'fixed stop loss'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-action-reverse-position',
    category: 'action_lifecycle',
    initialUserMessage: 'binance 永续 BTCUSDT 15m。EMA20 下穿 EMA50 时从多头反手做空，单笔 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_under', 'action.reverse_position'],
    expectedSemanticIntent: ['trend reversal trigger', 'reverse from long to short'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-program-fixed-grid-gated',
    category: 'execution_program',
    initialUserMessage: 'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。',
    expectedAtomKeys: ['program.fixed_grid_gated'],
    expectedSemanticIntent: ['fixed grid program enters rules effects programs', 'deploy payload binding still missing'],
    clarificationTurns: [],
    expectedFailure: 'program_deploy_payload_binding_missing',
  },
] as const satisfies readonly Stage4RealStrategyCase[]
