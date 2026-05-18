export type UtteranceCorpusLocale = 'zh' | 'en' | 'mixed'

export type UtteranceCorpusCoverage = 'locked' | 'open-slot' | 'missing-default' | 'negative'

export type UtteranceCorpusOwner =
  | 'trigger'
  | 'action'
  | 'risk'
  | 'positionConstraint'
  | 'orchestrationPortfolioRisk'

/**
 * Atom Key 联合（含 trigger/action/risk/positionConstraint/orchestration/scope/gate/program 共 47+ key）。
 * 历史名 SupportedExecutableUtteranceAtom 已不再精确（不仅是 executable atom），#1329 统一改为 SupportedAtomKey。
 */
export type SupportedAtomKey =
  | 'volume.threshold'
  | 'volatility.atr_threshold'
  | 'strategy.time_window'
  | 'position.has_position'
  | 'position.no_position'
  | 'action.add_position'
  | 'action.reverse_position'
  | 'risk.stop_loss_pct'
  | 'risk.take_profit_pct'
  | 'risk.atr_stop'
  | 'risk.partial_take_profit'
  | 'position.dca_schedule'
  | 'position.pyramiding_limit'
  | 'grid.range_rebalance'
  | 'indicator.divergence'
  | 'price.candle_pattern'
  | 'price.chart_pattern'
  | 'liquidity.sweep'
  | 'portfolioRisk.drawdown_block'
  | 'oscillator.rsi_lte'
  | 'external.signal'
  // ── first-wave (PR1b) ──
  | 'oscillator.rsi_gte'
  | 'bollinger.touch_upper'
  | 'bollinger.touch_lower'
  | 'bollinger.touch_middle'
  | 'price.percent_change'
  | 'price.breakout_up'
  | 'price.breakout_down'
  | 'price.detect.indicator_boundary'
  | 'indicator.cross_over'
  | 'indicator.cross_under'
  | 'indicator.above'
  | 'indicator.below'
  | 'execution.on_start'
  | 'trend.direction'
  | 'market.regime'
  | 'volatility.state'
  | 'price.range_position_lte'
  | 'price.range_position_gte'
  // ── position lifecycle actions (PR2c-final-1a / M2) ──
  | 'action.open_long'
  | 'action.close_long'
  | 'action.open_short'
  | 'action.close_short'
  // ── orchestration / scope（#1329 follow-up：从 legacy-presentation-data.ts PRESENTATIONS 迁入）──
  | 'gate.regime'
  | 'portfolioRisk.symbol_exposure_cap'
  | 'portfolioRisk.substrategy_exposure_cap'
  | 'program.dynamic_grid'
  | 'program.fixed_grid_gated'
  | 'program.adaptive_volatility_grid'
  | 'program.event_listener'
  | 'scope.symbol'
  | 'scope.leg'
  | 'scope.timeframe'
  | 'scope.dataSource'
  | 'scope.subStrategy'
  | 'gate.subStrategy'
  // ── Issue #1395：新 atom（registry 注册，IR emit 尚未兑现，readinessCheck=UNSUPPORTED_SKIP）──
  | 'condition.sequence'
  | 'price.previous_extrema_retest'
  | 'risk.atr_take_profit'
  // ── Issue #1498 S4/S5：ATR 倍数 stop/TP + 记忆位 stop ──
  | 'risk.atr_multiple_stop'
  | 'risk.atr_multiple_take_profit'
  | 'risk.remembered_level_stop'
  // ── Issue #1491 阶段 B：滚动高低点突破 ──
  | 'price.rolling_extrema_breakout'

/** @deprecated #1329 已更名 SupportedAtomKey，本 alias 保留兼容 in-flight branch；下个 PR 删 */
export type SupportedExecutableUtteranceAtom = SupportedAtomKey

export interface UtteranceCorpusExpected {
  owner: UtteranceCorpusOwner
  key: SupportedAtomKey
  status?: 'locked' | 'open'
  params?: Record<string, unknown>
  openSlotKeys?: readonly string[]
}

export interface UtteranceCorpusCase {
  id: string
  atomKey: SupportedAtomKey
  locale: UtteranceCorpusLocale
  coverage: UtteranceCorpusCoverage
  utterance: string
  expected: UtteranceCorpusExpected
}
