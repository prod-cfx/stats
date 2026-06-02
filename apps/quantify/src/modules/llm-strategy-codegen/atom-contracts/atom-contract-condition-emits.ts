/**
 * CONDITION_ATOM_EMITS — Issue #1279 PR3a Phase 2 兑现的 23 个 condition predicate 类
 * atom 的 `emit.irShape` 真实实现。
 *
 * 每个 entry 通过 `helpers.*` + `ctx.compileContext.*Map` 完成 series / predicate /
 * runtimeRequirements 写入，行为与 `canonical-spec-v2-ir-compiler.service.ts`
 * 原同名 case body 严格等价（snapshot equivalence 守门 spec 兜底）。
 *
 * 重命名 atom（`price.percent_change` / `oscillator.rsi_lte` / `oscillator.rsi_gte` /
 * `indicator.cross_over` / `indicator.cross_under` / `price.breakout_up` /
 * `price.breakout_down`）的 irShape 复用对应旧 key（`price.change_pct` /
 * `rsi.threshold_lte/gte` / `ma.golden_cross/death_cross` /
 * `breakout.channel_high_break/low_break`）的逻辑骨架；compileAtom dispatcher 内
 * 旧 key 走 legacy switch 兜底以维持向后兼容。
 */

import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'
import { LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS } from '../types/canonical-strategy-ir'

/**
 * 仅覆盖 `capabilityStatus` + `irShape` 两个字段。`capability` 三元组与
 * `evidenceSource` 由 `createPr1bEmit` 继承（与 dispatcher self-baseline 录制的
 * `{ domain: bucket, verb: 'emit', object: <key-suffix> }` 形态保持一致），避免
 * 修改影响下游 surface 录制 snapshot。
 */
export type ConditionEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'irShape'>

export const CONDITION_ATOM_EMITS = {
  'execution.on_start': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const barIndexRef = 'bar_index'
      if (!c.seriesMap.has(barIndexRef)) {
        c.seriesMap.set(barIndexRef, { id: barIndexRef, kind: 'BAR_INDEX' })
      }
      const thresholdRef = helpers.ensureConstSeries(c, 1)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'EQ',
        [barIndexRef, thresholdRef],
      )
    },
  },

  'indicator.above': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
        ? atom.params.timeframe.trim()
        : c.timeframe
      const leftRef = helpers.resolveIndicatorCompareLeftRef(c, atom, timeframe)
      const indicatorRef = helpers.ensureIndicatorReferenceSeries(c, atom, timeframe)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
        'GTE',
        [leftRef, indicatorRef],
      )
    },
  },

  'indicator.below': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
        ? atom.params.timeframe.trim()
        : c.timeframe
      const leftRef = helpers.resolveIndicatorCompareLeftRef(c, atom, timeframe)
      const indicatorRef = helpers.ensureIndicatorReferenceSeries(c, atom, timeframe)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${timeframe}`,
        'LTE',
        [leftRef, indicatorRef],
      )
    },
  },

  'price.range_position_lte': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const period = helpers.readNumber([atom.params?.period, atom.params?.lookbackBars], 20)
      const rangePositionRef = helpers.ensureRangePositionSeries(c, period)
      const thresholdRef = helpers.ensureConstSeries(
        c,
        helpers.normalizeRangePositionThreshold(helpers.readNumber([atom.value, atom.params?.thresholdPct], 0.5)),
      )
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'LTE',
        [rangePositionRef, thresholdRef],
      )
    },
  },

  'price.range_position_gte': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const period = helpers.readNumber([atom.params?.period, atom.params?.lookbackBars], 20)
      const rangePositionRef = helpers.ensureRangePositionSeries(c, period)
      const thresholdRef = helpers.ensureConstSeries(
        c,
        helpers.normalizeRangePositionThreshold(helpers.readNumber([atom.value, atom.params?.thresholdPct], 0.5)),
      )
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'GTE',
        [rangePositionRef, thresholdRef],
      )
    },
  },

  'price.percent_change': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'price.change_pct'` body @ canonical-spec-v2-ir-compiler.service.ts:1350-1374
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const timeframe = typeof atom.params?.timeframe === 'string' && atom.params.timeframe.trim().length > 0
        ? atom.params.timeframe.trim()
        : c.timeframe
      const lookbackBars = helpers.readNumber([atom.params?.lookbackBars], 1)
      const latestPriceRef = helpers.ensurePriceSeries(c, 'close', timeframe, 0)
      const previousPriceRef = helpers.ensurePriceSeries(c, 'close', timeframe, lookbackBars)
      const seriesId = `price_change_pct_${timeframe}_${lookbackBars}`
      if (!c.seriesMap.has(seriesId)) {
        c.seriesMap.set(seriesId, {
          id: seriesId,
          kind: 'PRICE_CHANGE_PCT',
          timeframe,
          inputs: [latestPriceRef, previousPriceRef],
          params: { lookbackBars },
        })
      }
      const thresholdRef = helpers.ensureConstSeries(c, helpers.readNumber([atom.value], 0))
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        helpers.resolveComparisonKind(atom.op),
        [seriesId, thresholdRef],
      )
    },
  },

  'oscillator.rsi_lte': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'rsi.threshold_lte'` threshold branch @ 1481-1504
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const rsiRef = helpers.ensureRsiSeries(
        c,
        helpers.readNumber([atom.params?.period], c.rsi.period),
      )
      const thresholdRef = helpers.ensureConstSeries(c, helpers.readNumber([atom.value], 50))
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        helpers.resolveComparisonKind(atom.op),
        [rsiRef, thresholdRef],
      )
    },
  },

  'oscillator.rsi_gte': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const rsiRef = helpers.ensureRsiSeries(
        c,
        helpers.readNumber([atom.params?.period], c.rsi.period),
      )
      const thresholdRef = helpers.ensureConstSeries(c, helpers.readNumber([atom.value], 50))
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        helpers.resolveComparisonKind(atom.op),
        [rsiRef, thresholdRef],
      )
    },
  },

  'bollinger.touch_upper': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'bollinger.touch_upper'` body @ 1624-1650
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      c.runtimeRequirements.helpers.add('bollinger')
      const bandRef = helpers.ensureBollingerSeries(c, 'UPPER_BAND', atom.params)
      const confirmationMode = typeof atom.params?.confirmationMode === 'string'
        ? atom.params.confirmationMode
        : undefined
      const usesTouchSemantics = confirmationMode === undefined || confirmationMode === 'touch'
      const defaultOp = usesTouchSemantics ? 'GTE' : 'CROSS_OVER'
      const priceRef = usesTouchSemantics ? helpers.ensurePriceSeries(c, 'high') : closeRef
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'compare',
        [priceRef, bandRef],
        { op: atom.op ?? defaultOp },
      )
    },
  },

  'bollinger.touch_lower': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      c.runtimeRequirements.helpers.add('bollinger')
      const bandRef = helpers.ensureBollingerSeries(c, 'LOWER_BAND', atom.params)
      const confirmationMode = typeof atom.params?.confirmationMode === 'string'
        ? atom.params.confirmationMode
        : undefined
      const usesTouchSemantics = confirmationMode === undefined || confirmationMode === 'touch'
      const defaultOp = usesTouchSemantics ? 'LTE' : 'CROSS_UNDER'
      const priceRef = usesTouchSemantics ? helpers.ensurePriceSeries(c, 'low') : closeRef
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'compare',
        [priceRef, bandRef],
        { op: atom.op ?? defaultOp },
      )
    },
  },

  'bollinger.touch_middle': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'bollinger.touch_middle'` body @ 1652-1659
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      c.runtimeRequirements.helpers.add('bollinger')
      const midRef = helpers.ensureBollingerSeries(c, 'MID_BAND', atom.params)
      const over = helpers.upsertPredicate(c.predicateMap, `${seed}_middle_over`, 'CROSS_OVER', [closeRef, midRef])
      const under = helpers.upsertPredicate(c.predicateMap, `${seed}_middle_under`, 'CROSS_UNDER', [closeRef, midRef])
      return helpers.upsertPredicate(c.predicateMap, `${seed}_middle_revert`, 'OR', [over, under])
    },
  },

  'trend.direction': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'trend.direction'` body @ 1712-1726
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const stateSeriesRef = helpers.ensureStateContextSeries(atom.key, c)
      const expectedValueRef = helpers.ensureConstSeries(
        c,
        typeof atom.value === 'string' ? atom.value : '',
      )
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'EQ',
        [stateSeriesRef, expectedValueRef],
      )
    },
  },

  'market.regime': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const stateSeriesRef = helpers.ensureStateContextSeries(atom.key, c)
      const expectedValueRef = helpers.ensureConstSeries(
        c,
        typeof atom.value === 'string' ? atom.value : '',
      )
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'EQ',
        [stateSeriesRef, expectedValueRef],
      )
    },
  },

  'volatility.state': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const stateSeriesRef = helpers.ensureStateContextSeries(atom.key, c)
      const expectedValueRef = helpers.ensureConstSeries(
        c,
        typeof atom.value === 'string' ? atom.value : '',
      )
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'EQ',
        [stateSeriesRef, expectedValueRef],
      )
    },
  },

  'indicator.divergence': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'indicator.divergence'` body @ 1791-1832（fail-closed 守门保留）
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const divIndicator = typeof atom.params?.indicator === 'string'
        ? atom.params.indicator.trim().toLowerCase()
        : null
      if (divIndicator !== 'rsi' && divIndicator !== 'macd') {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:indicator`)
      }
      const divDirection = typeof atom.params?.direction === 'string'
        ? atom.params.direction.trim().toLowerCase()
        : null
      if (divDirection !== 'bullish' && divDirection !== 'bearish') {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
      }
      const pivotWindow = helpers.readNumber([atom.params?.pivotWindow], 14)
      const confirmationBars = helpers.readNumber([atom.params?.confirmationBars], 3)
      const divSeriesId = `indicator_divergence_${divIndicator}_${divDirection}_${pivotWindow}_${confirmationBars}_${c.timeframe}`
      if (!c.seriesMap.has(divSeriesId)) {
        c.seriesMap.set(divSeriesId, {
          id: divSeriesId,
          kind: 'INDICATOR_DIVERGENCE',
          timeframe: c.timeframe,
          params: {
            indicator: divIndicator,
            direction: divDirection,
            pivotWindow,
            confirmationBars,
          },
        })
      }
      c.runtimeRequirements.helpers.add(divIndicator === 'macd' ? 'macd' : 'rsi')
      c.runtimeRequirements.helpers.add('priceHighsLows')
      const constOneRef = helpers.ensureConstSeries(c, 1)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_indicator_divergence_${divIndicator}_${divDirection}`,
        'EQ',
        [divSeriesId, constOneRef],
      )
    },
  },

  'price.candle_pattern': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'price.candle_pattern'` body @ 1834-1891
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const cpPattern = typeof atom.params?.pattern === 'string'
        ? atom.params.pattern.trim().toLowerCase()
        : null
      if (
        cpPattern !== 'engulfing'
        && cpPattern !== 'hammer'
        && cpPattern !== 'doji'
        && cpPattern !== 'consecutive_body'
        && cpPattern !== 'single_bull_bar'
        && cpPattern !== 'single_bear_bar'
      ) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:pattern`)
      }
      // single bull/bear bar 自身方向已确定，direction 缺省时由 pattern 推导
      let cpDirection = typeof atom.params?.direction === 'string'
        ? atom.params.direction.trim().toLowerCase()
        : null
      if (!cpDirection && cpPattern === 'single_bull_bar') cpDirection = 'bullish'
      if (!cpDirection && cpPattern === 'single_bear_bar') cpDirection = 'bearish'
      if (cpDirection !== 'bullish' && cpDirection !== 'bearish') {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
      }
      const cpMinBars = cpPattern === 'consecutive_body'
        && typeof atom.params?.minBars === 'number'
        && Number.isInteger(atom.params.minBars)
        && atom.params.minBars > 0
        ? atom.params.minBars
        : undefined
      if (cpPattern === 'consecutive_body' && cpMinBars === undefined) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:minBars`)
      }
      const cpSeriesId = cpMinBars !== undefined
        ? `candle_pattern_${cpPattern}_${cpDirection}_${cpMinBars}_${c.timeframe}`
        : `candle_pattern_${cpPattern}_${cpDirection}_${c.timeframe}`
      if (!c.seriesMap.has(cpSeriesId)) {
        c.seriesMap.set(cpSeriesId, {
          id: cpSeriesId,
          kind: 'CANDLE_PATTERN',
          timeframe: c.timeframe,
          params: {
            pattern: cpPattern,
            direction: cpDirection,
            ...(cpMinBars !== undefined ? { minBars: cpMinBars } : {}),
          },
        })
      }
      c.runtimeRequirements.helpers.add('candlePatternDetector')
      const constOneRef = helpers.ensureConstSeries(c, 1)
      return helpers.upsertPredicate(
        c.predicateMap,
        cpMinBars !== undefined
          ? `${seed}_candle_pattern_${cpPattern}_${cpDirection}_${cpMinBars}`
          : `${seed}_candle_pattern_${cpPattern}_${cpDirection}`,
        'EQ',
        [cpSeriesId, constOneRef],
      )
    },
  },

  'price.chart_pattern': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'price.chart_pattern'` body @ 1893-1940
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const chPattern = typeof atom.params?.pattern === 'string'
        ? atom.params.pattern.trim().toLowerCase()
        : null
      if (
        chPattern !== 'head_and_shoulders'
        && chPattern !== 'double_top'
        && chPattern !== 'double_bottom'
        && chPattern !== 'triangle'
      ) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:pattern`)
      }
      const chDirection = typeof atom.params?.direction === 'string'
        ? atom.params.direction.trim().toLowerCase()
        : null
      if (chDirection !== 'bullish' && chDirection !== 'bearish') {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
      }
      const chDirectionPatternConflict = (chPattern === 'double_top' && chDirection !== 'bearish')
        || (chPattern === 'double_bottom' && chDirection !== 'bullish')
      if (chDirectionPatternConflict) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction_pattern_conflict`)
      }
      const chSeriesId = `chart_pattern_${chPattern}_${chDirection}_${c.timeframe}`
      if (!c.seriesMap.has(chSeriesId)) {
        c.seriesMap.set(chSeriesId, {
          id: chSeriesId,
          kind: 'CHART_PATTERN',
          timeframe: c.timeframe,
          params: {
            pattern: chPattern,
            direction: chDirection,
          },
        })
      }
      c.runtimeRequirements.helpers.add('chartPatternDetector')
      const constOneRef = helpers.ensureConstSeries(c, 1)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_chart_pattern_${chPattern}_${chDirection}`,
        'EQ',
        [chSeriesId, constOneRef],
      )
    },
  },

  'liquidity.sweep': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'liquidity.sweep'` body @ 1942-1996（direction × reference 冲突守门保留）
    irShape: (atom, { compileContext: c, helpers, seed }) => {
      const lsDirection = typeof atom.params?.direction === 'string'
        ? atom.params.direction.trim().toLowerCase()
        : null
      if (lsDirection !== 'bullish' && lsDirection !== 'bearish') {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction`)
      }
      const lsReference = typeof atom.params?.reference === 'string'
        ? atom.params.reference.trim().toLowerCase()
        : null
      if (
        lsReference !== 'prev_low'
        && lsReference !== 'prev_high'
        && lsReference !== 'session_low'
        && lsReference !== 'session_high'
      ) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:reference`)
      }
      const lsImpossibleCombo = (lsDirection === 'bullish' && (lsReference === 'prev_high' || lsReference === 'session_high'))
        || (lsDirection === 'bearish' && (lsReference === 'prev_low' || lsReference === 'session_low'))
      if (lsImpossibleCombo) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:direction_reference_conflict`)
      }
      const lsReclaimBars = typeof atom.params?.reclaimBars === 'number'
        && Number.isInteger(atom.params.reclaimBars)
        && atom.params.reclaimBars > 0
        ? atom.params.reclaimBars
        : LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS
      const lsSeriesId = `liquidity_sweep_${lsDirection}_${lsReference}_${lsReclaimBars}_${c.timeframe}`
      if (!c.seriesMap.has(lsSeriesId)) {
        c.seriesMap.set(lsSeriesId, {
          id: lsSeriesId,
          kind: 'LIQUIDITY_SWEEP',
          timeframe: c.timeframe,
          params: {
            direction: lsDirection,
            reference: lsReference,
            reclaimBars: lsReclaimBars,
          },
        })
      }
      c.runtimeRequirements.helpers.add('liquiditySweepDetector')
      const constOneRef = helpers.ensureConstSeries(c, 1)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_liquidity_sweep_${lsDirection}_${lsReference}_${lsReclaimBars}`,
        'EQ',
        [lsSeriesId, constOneRef],
      )
    },
  },

  'grid.range_rebalance': {
    capabilityStatus: 'pr3a-condition',
    // grid 为 positionConstraint bucket：与原 `createPr1bEmit` 默认行为一致使用 'segment'。
    // mirror legacy `case 'grid.range_rebalance'` body @ 1520-1529
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const levelSetId = helpers.ensureGridLevelSet(c, atom)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        atom.op === 'GTE' ? 'TOUCH_LEVEL_UP' : 'TOUCH_LEVEL_DOWN',
        [closeRef, levelSetId],
      )
    },
  },

  'indicator.cross_over': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'ma.golden_cross'` body @ 1416-1427（MA 选择经
    // resolveMovingAverageAtomConfig 处理 atom.params.indicator = 'ma' | 'ema'）
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const period = helpers.readNumber([
        atom.params?.['reference.period'],
        atom.params?.period,
      ], NaN)
      const fastPeriod = helpers.readNumber([atom.params?.fastPeriod], NaN)
      const slowPeriod = helpers.readNumber([atom.params?.slowPeriod], NaN)
      if ((atom.params?.priceCross === true && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(period) && (!Number.isFinite(fastPeriod) || fastPeriod === period))) {
        const referencePeriod = Number.isFinite(period) ? period : fastPeriod
        const kind = typeof atom.params?.indicator === 'string' && atom.params.indicator.toLowerCase() === 'ema' ? 'EMA' : 'SMA'
        const ref = helpers.ensureIndicatorSeries(c, kind, referencePeriod, c.timeframe)
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_price_${referencePeriod}`,
          'CROSS_OVER',
          [closeRef, ref],
        )
      }
      const movingAverage = helpers.resolveMovingAverageAtomConfig(atom, c.movingAverage)
      const fastRef = helpers.ensureMovingAverageSeries(c, movingAverage.kind, movingAverage.fast)
      const slowRef = helpers.ensureMovingAverageSeries(c, movingAverage.kind, movingAverage.slow)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'CROSS_OVER',
        [fastRef, slowRef],
      )
    },
  },

  'indicator.cross_under': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const period = helpers.readNumber([
        atom.params?.['reference.period'],
        atom.params?.period,
      ], NaN)
      const fastPeriod = helpers.readNumber([atom.params?.fastPeriod], NaN)
      const slowPeriod = helpers.readNumber([atom.params?.slowPeriod], NaN)
      if ((atom.params?.priceCross === true && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(fastPeriod)) || (!Number.isFinite(slowPeriod) && Number.isFinite(period) && (!Number.isFinite(fastPeriod) || fastPeriod === period))) {
        const referencePeriod = Number.isFinite(period) ? period : fastPeriod
        const kind = typeof atom.params?.indicator === 'string' && atom.params.indicator.toLowerCase() === 'ema' ? 'EMA' : 'SMA'
        const ref = helpers.ensureIndicatorSeries(c, kind, referencePeriod, c.timeframe)
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_price_${referencePeriod}`,
          'CROSS_UNDER',
          [closeRef, ref],
        )
      }
      const movingAverage = helpers.resolveMovingAverageAtomConfig(atom, c.movingAverage)
      const fastRef = helpers.ensureMovingAverageSeries(c, movingAverage.kind, movingAverage.fast)
      const slowRef = helpers.ensureMovingAverageSeries(c, movingAverage.kind, movingAverage.slow)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'CROSS_UNDER',
        [fastRef, slowRef],
      )
    },
  },

  'price.breakout_up': {
    capabilityStatus: 'pr3a-condition',
    // mirror legacy `case 'breakout.channel_high_break'` body @ 1540-1553
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const period = helpers.readNumber([atom.params?.period], 20)
      const channelRef = helpers.ensureChannelSeries(c, 'HIGHEST_HIGH', period)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'CROSS_OVER',
        [closeRef, channelRef],
      )
    },
  },

  'price.breakout_down': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const period = helpers.readNumber([atom.params?.period], 20)
      const channelRef = helpers.ensureChannelSeries(c, 'LOWEST_LOW', period)
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}`,
        'CROSS_UNDER',
        [closeRef, channelRef],
      )
    },
  },

  // Issue #1498 S1 — condition.sequence
  //   mirror legacy `case 'condition.sequence'` body @ canonical-spec-v2-ir-compiler.service.ts:1969-2131
  //   五个 sequenceKind 分支：pullback_reclaim / rsi_reclaim / consecutive_body /
  //   breakout_then_retest / pattern_then_volume_spike + 未知 sequenceKind 占位兜底。
  'condition.sequence': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const sequenceKind = typeof atom.params?.sequenceKind === 'string' ? atom.params.sequenceKind : 'sequence'

      if (sequenceKind === 'pullback_reclaim') {
        const referenceIndicator = helpers.readStringParam(atom.params?.['reference.indicator']) ?? 'ma'
        const referencePeriod = helpers.readNumber(
          [atom.params?.['reference.period'], atom.params?.period],
          c.movingAverage.slow,
        )
        const referenceRef = referenceIndicator.toLowerCase() === 'ema'
          ? helpers.ensureIndicatorSeries(c, 'EMA', referencePeriod, c.timeframe)
          : helpers.ensureIndicatorSeries(c, 'SMA', referencePeriod, c.timeframe)
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${referenceIndicator}_${referencePeriod}`,
          'cross',
          [closeRef, referenceRef],
          {
            sequenceKind,
            direction: 'CROSS_OVER',
            'reference.indicator': referenceIndicator.toLowerCase() === 'ema' ? 'ema' : 'ma',
            'reference.period': referencePeriod,
          },
        )
      }

      if (sequenceKind === 'rsi_reclaim') {
        const period = helpers.readNumber([atom.params?.period], c.rsi.period)
        const threshold = helpers.readNumber([atom.params?.threshold, atom.value], 30)
        const rsiRef = helpers.ensureRsiSeries(c, period)
        const thresholdRef = helpers.ensureConstSeries(c, threshold)
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${period}_${helpers.normalizeNumberToken(threshold)}`,
          'cross',
          [rsiRef, thresholdRef],
          {
            sequenceKind,
            direction: 'CROSS_OVER',
            period,
            threshold,
          },
        )
      }

      // Issue #1395 — 三种新 sequenceKind 真实兑现：consecutive_body /
      //   breakout_then_retest / pattern_then_volume_spike
      const direction = atom.params?.direction === 'down' ? 'down' : 'up'
      const openRef = helpers.ensurePriceSeries(c, 'open')
      const seqParamsNew: Record<string, number | string | boolean> = { sequenceKind }
      if (typeof atom.params?.withinBars === 'number' && atom.params.withinBars > 0) {
        seqParamsNew.withinBars = atom.params.withinBars
      }
      const nextBarOnlyRaw = atom.params?.nextBarOnly
      if (nextBarOnlyRaw === true || nextBarOnlyRaw === 'true') {
        seqParamsNew.nextBarOnly = true
      }
      if (typeof atom.params?.direction === 'string') {
        seqParamsNew.direction = atom.params.direction
      }
      const memoryKeyNew = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
        ? atom.params.memoryKey.trim()
        : null
      if (memoryKeyNew && memoryKeyNew !== 'auto') {
        c.runtimeRequirements.stateKeys.add(memoryKeyNew)
      }

      if (sequenceKind === 'consecutive_body') {
        const count = helpers.readNumber([atom.params?.count], 3)
        if (!Number.isInteger(count) || count <= 0) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:count`)
        }
        const steps: string[] = []
        for (let i = 0; i < count; i += 1) {
          steps.push(helpers.upsertPredicate(
            c.predicateMap,
            `${seed}_seq_body_${direction}_${i}`,
            direction === 'down' ? 'LT' : 'GT',
            [closeRef, openRef],
          ))
        }
        seqParamsNew.count = count
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
          'sequence',
          steps,
          seqParamsNew,
        )
      }

      if (sequenceKind === 'breakout_then_retest') {
        const lookback = helpers.readNumber([atom.params?.lookbackBars], 24)
        if (!Number.isInteger(lookback) || lookback <= 0) {
          throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:lookbackBars`)
        }
        const isUp = direction === 'up'
        const channelRef = isUp
          ? helpers.ensureChannelSeries(c, 'HIGHEST_HIGH', lookback)
          : helpers.ensureChannelSeries(c, 'LOWEST_LOW', lookback)
        c.runtimeRequirements.helpers.add(isUp ? 'rollingHigh' : 'rollingLow')
        const breakoutStep = helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_seq_breakout_${direction}_${lookback}`,
          isUp ? 'GT' : 'LT',
          [closeRef, channelRef],
        )
        const retestStep = helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_seq_retest_${direction}_${lookback}`,
          isUp ? 'GTE' : 'LTE',
          [closeRef, channelRef],
        )
        seqParamsNew.lookbackBars = lookback
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
          'sequence',
          [breakoutStep, retestStep],
          seqParamsNew,
        )
      }

      if (sequenceKind === 'pattern_then_volume_spike') {
        const lookback = helpers.readNumber([atom.params?.lookbackBars], 20)
        const volumeRef = helpers.ensureVolumeSeries(c, c.timeframe)
        const smaVolRef = helpers.ensureSmaVolumeSeries(c, lookback, 1, c.timeframe)
        const patternStep = helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_seq_pattern_${direction}`,
          direction === 'down' ? 'LT' : 'GT',
          [closeRef, openRef],
        )
        const volumeStep = helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_seq_volume_spike_${lookback}`,
          'compare',
          [volumeRef, smaVolRef],
          { op: 'GTE' },
        )
        seqParamsNew.lookbackBars = lookback
        return helpers.upsertPredicate(
          c.predicateMap,
          `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}_${direction}`,
          'sequence',
          [patternStep, volumeStep],
          seqParamsNew,
        )
      }

      // 兜底：未知 sequenceKind / 仅做占位（保持 #1395 之前的向后兼容行为）
      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${sequenceKind}`,
        'sequence',
        [],
        {
          sequenceKind,
          ...(typeof atom.params?.lookbackWindow === 'string' ? { lookbackWindow: atom.params.lookbackWindow } : {}),
          ...(typeof atom.params?.lookbackBars === 'number' ? { lookbackBars: atom.params.lookbackBars } : {}),
          ...(typeof atom.params?.count === 'number' ? { count: atom.params.count } : {}),
          ...(typeof atom.params?.direction === 'string' ? { direction: atom.params.direction } : {}),
          ...(memoryKeyNew ? { memoryKey: memoryKeyNew } : {}),
        },
      )
    },
  },

  // Issue #1498 S2 — price.previous_extrema_retest
  //   mirror legacy `case 'price.previous_extrema_retest'` body @ 2352-2418。
  //   "突破后回踩" 语义 — 2 步 sequence：突破 N 周期 high/low → 回踩到突破位
  //   ±tolerance% 仍不破/已跌穿；memoryKey 透传到 runtimeRequirements.stateKeys。
  'price.previous_extrema_retest': {
    capabilityStatus: 'pr3a-condition',
    irShape: (atom, { compileContext: c, helpers, seed, closeRef }) => {
      const lookback = helpers.readNumber([
        atom.params?.lookbackBars,
        atom.params?.window,
        atom.params?.period,
      ], 24)
      if (!Number.isInteger(lookback) || lookback <= 0) {
        throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:lookbackBars`)
      }
      const extremaType = atom.params?.extremaType === 'low' ? 'low' : 'high'
      const retestKindRaw = atom.params?.retestKind
      const retestKind = retestKindRaw === 'break_through' ? 'break_through' : 'not_break'
      const isHigh = extremaType === 'high'
      const channelRef = isHigh
        ? helpers.ensureChannelSeries(c, 'HIGHEST_HIGH', lookback)
        : helpers.ensureChannelSeries(c, 'LOWEST_LOW', lookback)
      c.runtimeRequirements.helpers.add(isHigh ? 'rollingHigh' : 'rollingLow')

      const breakoutStep = helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_prev_extrema_breakout_${extremaType}_${lookback}`,
        isHigh ? 'GT' : 'LT',
        [closeRef, channelRef],
      )

      const retestKindOp = retestKind === 'not_break'
        ? (isHigh ? 'GTE' : 'LTE')
        : (isHigh ? 'LT' : 'GT')
      const retestStep = helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_prev_extrema_retest_${retestKind}_${extremaType}_${lookback}`,
        retestKindOp,
        [closeRef, channelRef],
      )

      const memoryKey = typeof atom.params?.memoryKey === 'string' && atom.params.memoryKey.trim().length > 0
        ? atom.params.memoryKey.trim()
        : null
      if (memoryKey && memoryKey !== 'auto') {
        c.runtimeRequirements.stateKeys.add(memoryKey)
      }

      const seqParams: Record<string, number | string> = {}
      if (typeof atom.params?.maxBars === 'number' && atom.params.maxBars > 0) {
        seqParams.withinBars = atom.params.maxBars
      }
      if (typeof atom.params?.tolerancePct === 'number') {
        seqParams.tolerancePct = atom.params.tolerancePct
      }
      seqParams.extremaType = extremaType
      seqParams.retestKind = retestKind

      return helpers.upsertPredicate(
        c.predicateMap,
        `${seed}_${atom.key.replace(/\./g, '_')}_${retestKind}_${extremaType}_${lookback}`,
        'sequence',
        [breakoutStep, retestStep],
        seqParams,
      )
    },
  },
} satisfies Partial<Record<AtomContractKey, ConditionEmitOverride>>
