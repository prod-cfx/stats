/**
 * 注意（review m1，#1279 PR2b）：以下 atom 在 `atoms/` 目录下有 `*.utterance.ts`
 * fixture，但**故意不**在此 index 导入：
 *
 *   - grid.range_rebalance       → atoms/grid.range_rebalance.utterance.ts
 *   - position.pyramiding_limit  → atoms/position.pyramiding_limit.utterance.ts
 *
 * 原因：这两 atom 由 INDIRECTLY_COVERED_ATOMS 全面豁免 corpus invariants A-I，其
 * fixture 仅供 dispatcher-self-baseline.spec.ts 通过 `readdirSync('atoms/')`
 * 自动拾取消费；接入 utteranceCorpus 总线会要求 seed-extractor 直接输出对应
 * atomKey，破坏 PR2b 不动 legacy extractor 的红线。
 *
 * 新增此类 dispatcher-only fixture 时，请在此白名单追加一行；不要直接 import。
 */
import type { SupportedAtomKey, UtteranceCorpusCase } from './utterance-corpus.types'
import { oscillatorRsiLteUtterances } from './atoms/oscillator.rsi_lte.utterance'
import { oscillatorRsiGteUtterances } from './atoms/oscillator.rsi_gte.utterance'
import { bollingerTouchUpperUtterances } from './atoms/bollinger.touch_upper.utterance'
import { bollingerTouchLowerUtterances } from './atoms/bollinger.touch_lower.utterance'
import { bollingerTouchMiddleUtterances } from './atoms/bollinger.touch_middle.utterance'
import { pricePercentChangeUtterances } from './atoms/price.percent_change.utterance'
import { priceBreakoutUpUtterances } from './atoms/price.breakout_up.utterance'
import { priceBreakoutDownUtterances } from './atoms/price.breakout_down.utterance'
import { priceDetectIndicatorBoundaryUtterances } from './atoms/price.detect.indicator_boundary.utterance'
import { indicatorCrossOverUtterances } from './atoms/indicator.cross_over.utterance'
import { indicatorCrossUnderUtterances } from './atoms/indicator.cross_under.utterance'
import { indicatorAboveUtterances } from './atoms/indicator.above.utterance'
import { indicatorBelowUtterances } from './atoms/indicator.below.utterance'
import { executionOnStartUtterances } from './atoms/execution.on_start.utterance'
import { trendDirectionUtterances } from './atoms/trend.direction.utterance'
import { marketRegimeUtterances } from './atoms/market.regime.utterance'
import { volatilityStateUtterances } from './atoms/volatility.state.utterance'
import { priceRangePositionLteUtterances } from './atoms/price.range_position_lte.utterance'
import { priceRangePositionGteUtterances } from './atoms/price.range_position_gte.utterance'
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
import { actionOpenShortUtterances } from './atoms/action.open_short.utterance'
import { actionCloseShortUtterances } from './atoms/action.close_short.utterance'
import { gateRegimeUtterances } from './atoms/gate.regime.utterance'
import { portfolioRiskSymbolExposureCapUtterances } from './atoms/portfolioRisk.symbol_exposure_cap.utterance'
import { portfolioRiskSubstrategyExposureCapUtterances } from './atoms/portfolioRisk.substrategy_exposure_cap.utterance'
import { programDynamicGridUtterances } from './atoms/program.dynamic_grid.utterance'
import { programFixedGridGatedUtterances } from './atoms/program.fixed_grid_gated.utterance'
import { programAdaptiveVolatilityGridUtterances } from './atoms/program.adaptive_volatility_grid.utterance'
import { programEventListenerUtterances } from './atoms/program.event_listener.utterance'
import { scopeSymbolUtterances } from './atoms/scope.symbol.utterance'
import { scopeLegUtterances } from './atoms/scope.leg.utterance'
import { scopeTimeframeUtterances } from './atoms/scope.timeframe.utterance'
import { scopeDataSourceUtterances } from './atoms/scope.dataSource.utterance'
import { scopeSubStrategyUtterances } from './atoms/scope.subStrategy.utterance'
import { gateSubStrategyUtterances } from './atoms/gate.subStrategy.utterance'
import { volumeThresholdUtterances } from './atoms/volume.threshold.utterance'

export type {
  SupportedAtomKey,
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
export const INDIRECTLY_COVERED_ATOMS: ReadonlySet<SupportedAtomKey> = new Set([
  'position.pyramiding_limit',
  'grid.range_rebalance',
  // dispatcher-only action atoms (PR2c-final-1a): legacy extractor unaware; fixture files
  // are auto-picked by dispatcher-self-baseline.spec via readdirSync('atoms/').
  'action.open_long',
  'action.close_long',
])

/**
 * PR1b canonical alias map.
 *
 * These atoms remain supported first-wave contract keys, but the current seed extractor
 * canonicalizes explicit Bollinger boundary NL into the universal indicator-boundary atom.
 * Coverage specs must count the source atom fixtures while validating the observed target key.
 */
export const CANONICAL_CORPUS_ALIASES = {
  'bollinger.touch_upper': 'price.detect.indicator_boundary',
  'bollinger.touch_lower': 'price.detect.indicator_boundary',
  'bollinger.touch_middle': 'price.detect.indicator_boundary',
} as const satisfies Partial<Record<SupportedAtomKey, SupportedAtomKey>>

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
  'oscillator.rsi_gte',
  'bollinger.touch_upper',
  'bollinger.touch_lower',
  'bollinger.touch_middle',
  'price.percent_change',
  'price.breakout_up',
  'price.breakout_down',
  'price.detect.indicator_boundary',
  'indicator.cross_over',
  'indicator.cross_under',
  'indicator.above',
  'indicator.below',
  'execution.on_start',
  'trend.direction',
  'market.regime',
  'volatility.state',
  'price.range_position_lte',
  'price.range_position_gte',
  'action.open_short',
  'action.close_short',
  'gate.regime',
  'portfolioRisk.symbol_exposure_cap',
  'portfolioRisk.substrategy_exposure_cap',
  'program.dynamic_grid',
  'program.fixed_grid_gated',
  'program.adaptive_volatility_grid',
  'program.event_listener',
  'scope.symbol',
  'scope.leg',
  'scope.timeframe',
  'scope.dataSource',
  'scope.subStrategy',
  'gate.subStrategy',
] as const satisfies readonly SupportedAtomKey[]

export const SUPPORTED_REQUIRES_SLOT_UTTERANCE_ATOMS = [
  'external.signal',
] as const satisfies readonly SupportedAtomKey[]

export const SUPPORTED_UTTERANCE_CORPUS_ATOMS = [
  ...SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS,
  ...SUPPORTED_REQUIRES_SLOT_UTTERANCE_ATOMS,
] as const satisfies readonly SupportedAtomKey[]

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
  ...oscillatorRsiLteUtterances,
  ...oscillatorRsiGteUtterances,
  ...bollingerTouchUpperUtterances,
  ...bollingerTouchLowerUtterances,
  ...bollingerTouchMiddleUtterances,
  ...pricePercentChangeUtterances,
  ...priceBreakoutUpUtterances,
  ...priceBreakoutDownUtterances,
  ...priceDetectIndicatorBoundaryUtterances,
  ...indicatorCrossOverUtterances,
  ...indicatorCrossUnderUtterances,
  ...indicatorAboveUtterances,
  ...indicatorBelowUtterances,
  ...executionOnStartUtterances,
  ...trendDirectionUtterances,
  ...marketRegimeUtterances,
  ...volatilityStateUtterances,
  ...priceRangePositionLteUtterances,
  ...priceRangePositionGteUtterances,
  ...externalSignalUtterances,
  ...actionOpenShortUtterances,
  ...actionCloseShortUtterances,
  ...gateRegimeUtterances,
  ...portfolioRiskSymbolExposureCapUtterances,
  ...portfolioRiskSubstrategyExposureCapUtterances,
  ...programDynamicGridUtterances,
  ...programFixedGridGatedUtterances,
  ...programAdaptiveVolatilityGridUtterances,
  ...programEventListenerUtterances,
  ...scopeSymbolUtterances,
  ...scopeLegUtterances,
  ...scopeTimeframeUtterances,
  ...scopeDataSourceUtterances,
  ...scopeSubStrategyUtterances,
  ...gateSubStrategyUtterances,
] as const satisfies readonly UtteranceCorpusCase[]

export function getUtteranceCorpusForAtom(atomKey: SupportedAtomKey): UtteranceCorpusCase[] {
  return utteranceCorpus.filter(item => item.atomKey === atomKey)
}

export function getGoldenUtterancesForAtom(atomKey: SupportedAtomKey): string[] {
  return getUtteranceCorpusForAtom(atomKey).map(item => item.utterance)
}
