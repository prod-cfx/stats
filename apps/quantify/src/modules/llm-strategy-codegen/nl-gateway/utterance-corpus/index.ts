import type { SupportedExecutableUtteranceAtom, UtteranceCorpusCase } from './utterance-corpus.types'
import { actionAddPositionUtterances } from './atoms/action.add_position.utterance'
import { actionReversePositionUtterances } from './atoms/action.reverse_position.utterance'
import { indicatorDivergenceUtterances } from './atoms/indicator.divergence.utterance'
import { liquiditySweepUtterances } from './atoms/liquidity.sweep.utterance'
import { positionDcaScheduleUtterances } from './atoms/position.dca_schedule.utterance'
import { positionHasPositionUtterances } from './atoms/position.has_position.utterance'
import { positionNoPositionUtterances } from './atoms/position.no_position.utterance'
import { priceCandlePatternUtterances } from './atoms/price.candle_pattern.utterance'
import { priceChartPatternUtterances } from './atoms/price.chart_pattern.utterance'
import { riskPartialTakeProfitUtterances } from './atoms/risk.partial_take_profit.utterance'
import { strategyTimeWindowUtterances } from './atoms/strategy.time_window.utterance'
import { volatilityAtrThresholdUtterances } from './atoms/volatility.atr_threshold.utterance'
import { volumeThresholdUtterances } from './atoms/volume.threshold.utterance'

export type {
  SupportedExecutableUtteranceAtom,
  UtteranceCorpusCase,
  UtteranceCorpusCoverage,
  UtteranceCorpusExpected,
  UtteranceCorpusLocale,
  UtteranceCorpusOwner,
} from './utterance-corpus.types'

export const SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS = [
  'volume.threshold',
  'volatility.atr_threshold',
  'strategy.time_window',
  'position.has_position',
  'position.no_position',
  'action.add_position',
  'action.reverse_position',
  'risk.partial_take_profit',
  'position.dca_schedule',
  'indicator.divergence',
  'price.candle_pattern',
  'price.chart_pattern',
  'liquidity.sweep',
] as const satisfies readonly SupportedExecutableUtteranceAtom[]

export const utteranceCorpus = [
  ...volumeThresholdUtterances,
  ...volatilityAtrThresholdUtterances,
  ...strategyTimeWindowUtterances,
  ...positionHasPositionUtterances,
  ...positionNoPositionUtterances,
  ...actionAddPositionUtterances,
  ...actionReversePositionUtterances,
  ...riskPartialTakeProfitUtterances,
  ...positionDcaScheduleUtterances,
  ...indicatorDivergenceUtterances,
  ...priceCandlePatternUtterances,
  ...priceChartPatternUtterances,
  ...liquiditySweepUtterances,
] as const satisfies readonly UtteranceCorpusCase[]

export function getUtteranceCorpusForAtom(atomKey: SupportedExecutableUtteranceAtom): UtteranceCorpusCase[] {
  return utteranceCorpus.filter(item => item.atomKey === atomKey)
}

export function getGoldenUtterancesForAtom(atomKey: SupportedExecutableUtteranceAtom): string[] {
  return getUtteranceCorpusForAtom(atomKey).map(item => item.utterance)
}

