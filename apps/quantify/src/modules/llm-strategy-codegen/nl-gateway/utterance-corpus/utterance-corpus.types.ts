export type UtteranceCorpusLocale = 'zh' | 'en' | 'mixed'

export type UtteranceCorpusCoverage = 'locked' | 'open-slot' | 'missing-default' | 'negative'

export type UtteranceCorpusOwner =
  | 'trigger'
  | 'action'
  | 'risk'
  | 'positionConstraint'
  | 'orchestrationPortfolioRisk'

export type SupportedExecutableUtteranceAtom =
  | 'volume.threshold'
  | 'volatility.atr_threshold'
  | 'strategy.time_window'
  | 'position.has_position'
  | 'position.no_position'
  | 'action.add_position'
  | 'action.reverse_position'
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

export interface UtteranceCorpusExpected {
  owner: UtteranceCorpusOwner
  key: SupportedExecutableUtteranceAtom
  status?: 'locked' | 'open'
  params?: Record<string, unknown>
  openSlotKeys?: readonly string[]
}

export interface UtteranceCorpusCase {
  id: string
  atomKey: SupportedExecutableUtteranceAtom
  locale: UtteranceCorpusLocale
  coverage: UtteranceCorpusCoverage
  utterance: string
  expected: UtteranceCorpusExpected
}
