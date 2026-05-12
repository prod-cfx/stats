import type { SupportedExecutableUtteranceAtom, UtteranceCorpusCase } from './utterance-corpus.types'
import { oscillatorRsiUtterances } from './atoms/oscillator.rsi.utterance'
import { externalSignalUtterances } from './atoms/external.signal.utterance'
import { actionAddPositionUtterances } from './atoms/action.add_position.utterance'
import { actionReversePositionUtterances } from './atoms/action.reverse_position.utterance'
import { indicatorDivergenceUtterances } from './atoms/indicator.divergence.utterance'
import { liquiditySweepUtterances } from './atoms/liquidity.sweep.utterance'
import { portfolioDrawdownBlockUtterances } from './atoms/portfolio.drawdown_block.utterance'
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

/**
 * Issue #1231 + #1191/#1198：间接触发的 supported_executable 原子白名单豁免。
 *
 * 这些 atom 通过其他子句（如 action.add_position、grid 触发器）间接落位 state.triggers，
 * 没有独立 atomKey fixture。它们的契约由专门的 projection/invariant spec 覆盖
 * （semantic-state-projection.service.orchestration.spec / sizing-evidence-invariant.spec），
 * 在 utterance-corpus 与 atom-coverage-contract 层全面豁免"≥3 utterances + 探针可识别"两个约束。
 *
 * Single source of truth：utterance-corpus.spec.ts 与 atom-coverage-contract.spec.ts
 * 必须共享同一份豁免清单，禁止任一侧自行硬编码扩展。
 */
export const INDIRECTLY_COVERED_ATOMS: ReadonlySet<SupportedExecutableUtteranceAtom> = new Set([
  'position.pyramiding_limit',
  'grid.range_rebalance',
])

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
  'position.pyramiding_limit',
  'grid.range_rebalance',
  'indicator.divergence',
  'price.candle_pattern',
  'price.chart_pattern',
  'liquidity.sweep',
  'portfolioRisk.drawdown_block',
  'oscillator.rsi_lte',
] as const satisfies readonly SupportedExecutableUtteranceAtom[]

export const SUPPORTED_REQUIRES_SLOT_UTTERANCE_ATOMS = [
  'external.signal',
] as const satisfies readonly SupportedExecutableUtteranceAtom[]

export const SUPPORTED_UTTERANCE_CORPUS_ATOMS = [
  ...SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS,
  ...SUPPORTED_REQUIRES_SLOT_UTTERANCE_ATOMS,
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
  ...portfolioDrawdownBlockUtterances,
  ...oscillatorRsiUtterances,
  ...externalSignalUtterances,
] as const satisfies readonly UtteranceCorpusCase[]

export function getUtteranceCorpusForAtom(atomKey: SupportedExecutableUtteranceAtom): UtteranceCorpusCase[] {
  return utteranceCorpus.filter(item => item.atomKey === atomKey)
}

export function getGoldenUtterancesForAtom(atomKey: SupportedExecutableUtteranceAtom): string[] {
  return getUtteranceCorpusForAtom(atomKey).map(item => item.utterance)
}
