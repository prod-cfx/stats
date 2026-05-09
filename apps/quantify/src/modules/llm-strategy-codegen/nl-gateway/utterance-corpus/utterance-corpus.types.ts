export type UtteranceCorpusLocale = 'zh' | 'en' | 'mixed'

export type UtteranceCorpusCoverage = 'locked' | 'open-slot' | 'missing-default' | 'negative'

export type UtteranceCorpusOwner = 'trigger' | 'action' | 'risk' | 'positionConstraint'

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
  | 'indicator.divergence'
  | 'price.candle_pattern'
  | 'price.chart_pattern'
  | 'liquidity.sweep'

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

