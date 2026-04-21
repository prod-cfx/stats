import type { ChecklistPayload } from '../types/checklist-compat'
import type {
  NormalizedActionAtom,
  NormalizedGridIntent,
  NormalizedRiskAtom,
  NormalizedTriggerAtom,
  StrategyNormalizedIntent,
  UnresolvedSlot,
} from '../types/strategy-normalized-intent'
import { Injectable } from '@nestjs/common'
import { GRID_STRATEGY_FAMILY } from '../constants/canonical-strategy-capabilities'

interface NormalizeResult {
  normalizedIntent: StrategyNormalizedIntent
  blocked: boolean
  blockerReason?: string
}

@Injectable()
export class StrategyIntentNormalizerService {
  normalize(checklist: ChecklistPayload): NormalizeResult {
    const entryNormalization = this.normalizeRuleAtoms(checklist.entryRules, checklist.entryRuleBases, 'entry')
    const exitNormalization = this.normalizeRuleAtoms(checklist.exitRules, checklist.exitRuleBases, 'exit')
    const stateHints = this.normalizeStateHints(checklist)
    const grid = this.normalizeGrid(checklist)
    const gridTriggers = this.buildGridTriggerAtoms(checklist, grid)
    const triggers = this.sortTriggers(this.harmonizeBollingerTriggers([
      ...entryNormalization.triggers,
      ...exitNormalization.triggers,
      ...gridTriggers,
    ]))
    const risk = this.normalizeRisk(checklist.riskRules)
    const actions = this.normalizeActions(triggers, grid)
    const families = this.resolveFamilies(triggers, grid)
    const unresolved = [...entryNormalization.unresolved, ...exitNormalization.unresolved]
    const position = this.normalizePosition(checklist.riskRules, actions, grid)

    const normalizedIntent: StrategyNormalizedIntent = {
      families,
      triggers,
      actions,
      risk,
      position,
      grid,
      ...(stateHints.length > 0 ? { stateHints } : {}),
      unresolved,
      normalizationNotes: [],
    }

    if (unresolved.length > 0) {
      return {
        normalizedIntent,
        blocked: true,
        blockerReason: `存在暂不支持的规则片段：${unresolved.join('；')}`,
      }
    }

    if (families.length === 0) {
      return {
        normalizedIntent,
        blocked: true,
        blockerReason: '当前策略还不能稳定归一到首批 atom/family 白名单。',
      }
    }

    return {
      normalizedIntent,
      blocked: false,
    }
  }

  private normalizeRuleAtoms(
    rules: string[] | undefined,
    bases: Record<string, string> | undefined,
    phase: 'entry' | 'exit',
  ): {
    triggers: NormalizedTriggerAtom[]
    unresolved: string[]
  } {
    if (!Array.isArray(rules)) {
      return { triggers: [], unresolved: [] }
    }

    const triggers: NormalizedTriggerAtom[] = []
    const unresolved: string[] = []
    for (const [index, rawRule] of rules.entries()) {
      const rule = rawRule.trim()
      if (!rule) continue

      const percentChange = this.tryNormalizePercentChange(rule, phase, bases?.[`${phase}-${index + 1}`])
      if (percentChange) {
        triggers.push(percentChange)
        continue
      }
      const executionIntent = this.tryNormalizeExecutionIntent(rule, phase)
      if (executionIntent) {
        triggers.push(executionIntent)
        continue
      }
      const pnlChange = this.tryNormalizePositionPnl(rule, phase, bases?.[`${phase}-${index + 1}`])
      if (pnlChange) {
        triggers.push(pnlChange)
        continue
      }
      const movingAverageBreakout = this.tryNormalizeMovingAverageBreakout(rule, phase, triggers.length)
      if (movingAverageBreakout) {
        triggers.push(movingAverageBreakout)
        continue
      }
      const bollinger = this.tryNormalizeBollinger(rule, phase)
      if (bollinger) {
        triggers.push(bollinger)
        continue
      }
      const unknownBreakout = this.tryNormalizeUnknownBreakoutConcept(rule, phase, triggers.length)
      if (unknownBreakout) {
        triggers.push(unknownBreakout)
        continue
      }
      const breakout = this.tryNormalizeBreakout(rule, phase)
      if (breakout) {
        triggers.push(breakout)
        continue
      }
      const indicatorThreshold = this.tryNormalizeIndicatorThreshold(rule, phase)
      if (indicatorThreshold) {
        triggers.push(indicatorThreshold)
        continue
      }
      const indicatorCross = this.tryNormalizeIndicatorCross(rule, phase)
      if (indicatorCross) {
        triggers.push(indicatorCross)
        continue
      }

      unresolved.push(rule)
    }

    return { triggers, unresolved }
  }

  private tryNormalizePercentChange(
    rule: string,
    phase: 'entry' | 'exit',
    basis: string | undefined,
  ): NormalizedTriggerAtom | null {
    const rawValue = this.extractPercentValue(rule)
    if (rawValue === null) return null

    const hasDirectionWord = /下跌|跌|回调|上涨|涨|反弹/u.test(rule)
    const hasActionWord = /买入|卖出|做多|做空|开多|开空|平多|平空|平仓/u.test(rule)
    if (!hasDirectionWord || !hasActionWord) return null

    const valuePct = /下跌|跌|回调/u.test(rule) ? -Math.abs(rawValue) : Math.abs(rawValue)
    const window = this.extractWindow(rule)
    const sideScope = this.resolveSideScope(rule, phase)

    return this.createClosedTrigger({
      key: 'price.percent_change',
      phase,
      ...(sideScope ? { sideScope } : {}),
      params: {
        valuePct,
        ...(window ? { window } : {}),
        basis: basis ?? 'prev_close',
      },
    })
  }

  private tryNormalizeExecutionIntent(
    rule: string,
    phase: 'entry' | 'exit',
  ): NormalizedTriggerAtom | null {
    const hasImmediateCue = /立即|立刻|马上|启动时|开始时|一开始|开局|开始后/u.test(rule)
    const hasDirectMarketCue = /直接/u.test(rule) && /市价|当前价/u.test(rule)
    const hasSingleExecutionCue = /一次|一次性|首根|首次/u.test(rule)
    const hasTimingCue = hasImmediateCue || hasDirectMarketCue || hasSingleExecutionCue
    if (!hasTimingCue) return null

    const hasActionWord = /市价买入|买入|开仓|做多|市价卖出|卖出|平仓|平多|平空|做空/u.test(rule)
    if (!hasActionWord) return null

    const sideScope = this.resolveSideScope(rule, phase) ?? 'long'
    return this.createClosedTrigger({
      key: 'execution.on_start',
      phase,
      ...(sideScope ? { sideScope } : {}),
      params: {
        timing: 'on_start',
        orderType: 'market',
        occurrence: 'once',
      },
    })
  }

  private normalizeStateHints(checklist: ChecklistPayload): StrategyNormalizedIntent['stateHints'] {
    const stateGates = checklist.stateGates
    if (!stateGates) return []

    const hints: NonNullable<StrategyNormalizedIntent['stateHints']> = []
    if (stateGates.trendDirection) {
      hints.push({
        type: 'trend',
        value: stateGates.trendDirection,
        mode: 'observation_only',
        closureStatus: 'closed',
        unresolvedSlots: [],
      })
    }
    if (stateGates.marketRegime) {
      hints.push({
        type: 'regime',
        value: stateGates.marketRegime,
        mode: 'observation_only',
        closureStatus: 'closed',
        unresolvedSlots: [],
        evidenceText: stateGates.marketRegime,
      })
    }
    if (stateGates.volatilityState) {
      hints.push({
        type: 'volatility',
        value: stateGates.volatilityState,
        mode: 'observation_only',
        closureStatus: 'closed',
        unresolvedSlots: [],
      })
    }

    return hints
  }

  private tryNormalizeBollinger(
    rule: string,
    phase: 'entry' | 'exit',
  ): NormalizedTriggerAtom | null {
    const normalized = rule.toLowerCase()
    if (!/布林|bollinger|上轨|下轨|中轨|upper|lower|middle/iu.test(rule)) {
      return null
    }
    const bandMatch = rule.match(/布林带\s*[（(]\s*(\d{1,3})\s*[,，]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
    const middleMatch = rule.match(/中轨\s*\(?(?:MA|ma)\s*(\d{1,3})\)?/u)
      ?? rule.match(/均线\s*(\d{1,3})/u)
    const period = bandMatch?.[1]
      ? Number(bandMatch[1])
      : (middleMatch?.[1] ? Number(middleMatch[1]) : null)
    const stdDev = bandMatch?.[2] ? Number(bandMatch[2]) : null

    if (/上轨|upper/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_upper',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? (phase === 'entry' ? 'short' : 'both'),
        params: {
          band: 'upper',
          ...(period !== null ? { period } : {}),
          ...(stdDev !== null ? { stdDev } : {}),
        },
        resolutionHints: { confirmation: this.resolveBollingerConfirmationHint(rule) },
      })
    }

    if (/下轨|lower/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_lower',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? 'long',
        params: {
          band: 'lower',
          ...(period !== null ? { period } : {}),
          ...(stdDev !== null ? { stdDev } : {}),
        },
        resolutionHints: { confirmation: this.resolveBollingerConfirmationHint(rule) },
      })
    }

    if (/中轨|middle|ma20|均线20/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_middle',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? 'both',
        params: {
          band: 'middle',
          ...(period !== null ? { period } : {}),
          ...(stdDev !== null ? { stdDev } : {}),
        },
        resolutionHints: { confirmation: this.resolveBollingerConfirmationHint(rule) },
      })
    }

    return null
  }

  private tryNormalizeMovingAverageBreakout(
    rule: string,
    phase: 'entry' | 'exit',
    triggerIndex: number,
  ): NormalizedTriggerAtom | null {
    if (!/均线|ema|sma|ma/iu.test(rule)) return null

    const referenceRole = /长期|长线|长周期|long[\s-]?term/iu.test(rule)
      ? 'long_term'
      : (/短期|短线|短周期|short[\s-]?term/iu.test(rule) ? 'short_term' : null)
    if (!referenceRole) return null

    const periodMatch = rule.match(/(?:ma|ema|sma)?\s*[（(]?\s*(\d{1,4})\s*[)）]?/iu)
      ?? rule.match(/(\d{1,4})\s*(?:日|周期)?均线/iu)
    const referencePeriod = periodMatch?.[1] ? Number(periodMatch[1]) : null
    const confirmationMode = /收盘|确认|close/iu.test(rule)
      ? 'close_confirm'
      : (/盘中|即时|触发/iu.test(rule) ? 'touch' : null)

    const questionPrefix = referenceRole === 'long_term' ? '长期均线' : '短期均线'
    const sideScope = this.resolveSideScope(rule, phase)
    if (/突破|站上|上方|高于/u.test(rule)) {
      if (referencePeriod !== null && confirmationMode) {
        return this.createClosedTrigger({
          key: 'indicator.above',
          phase,
          ...(sideScope ? { sideScope } : {}),
          params: {
            indicator: 'ma',
            referenceRole,
            'reference.period': referencePeriod,
            confirmationMode,
          },
        })
      }
      const unresolvedSlots: UnresolvedSlot[] = []
      const semanticScope = phase === 'entry' ? 'entry' : 'exit'
      if (referencePeriod === null) {
        unresolvedSlots.push({
          slotKey: `reference.period.${semanticScope}`,
          fieldPath: `triggers[${triggerIndex}].params.reference.period`,
          reason: 'missing_required_param',
          questionHint: `${questionPrefix}是多少？`,
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        })
      }
      if (!confirmationMode) {
        unresolvedSlots.push({
          slotKey: `confirmationMode.${semanticScope}`,
          fieldPath: `triggers[${triggerIndex}].params.confirmationMode`,
          reason: 'missing_definition',
          questionHint: '突破按收盘确认还是盘中触发？',
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        })
      }
      return this.createOpenTrigger({
        key: 'indicator.above',
        phase,
        ...(sideScope ? { sideScope } : {}),
        params: {
          indicator: 'ma',
          referenceRole,
          ...(referencePeriod !== null ? { 'reference.period': referencePeriod } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      }, unresolvedSlots, rule)
    }

    if (/跌破|失守|下方|低于/u.test(rule)) {
      if (referencePeriod !== null && confirmationMode) {
        return this.createClosedTrigger({
          key: 'indicator.below',
          phase,
          ...(sideScope ? { sideScope } : {}),
          params: {
            indicator: 'ma',
            referenceRole,
            'reference.period': referencePeriod,
            confirmationMode,
          },
        })
      }
      const unresolvedSlots: UnresolvedSlot[] = []
      const semanticScope = phase === 'entry' ? 'entry' : 'exit'
      if (referencePeriod === null) {
        unresolvedSlots.push({
          slotKey: `reference.period.${semanticScope}`,
          fieldPath: `triggers[${triggerIndex}].params.reference.period`,
          reason: 'missing_required_param',
          questionHint: `${questionPrefix}是多少？`,
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        })
      }
      if (!confirmationMode) {
        unresolvedSlots.push({
          slotKey: `confirmationMode.${semanticScope}`,
          fieldPath: `triggers[${triggerIndex}].params.confirmationMode`,
          reason: 'missing_definition',
          questionHint: '跌破按收盘确认还是盘中触发？',
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        })
      }
      return this.createOpenTrigger({
        key: 'indicator.below',
        phase,
        ...(sideScope ? { sideScope } : {}),
        params: {
          indicator: 'ma',
          referenceRole,
          ...(referencePeriod !== null ? { 'reference.period': referencePeriod } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      }, unresolvedSlots, rule)
    }

    return null
  }

  private tryNormalizeUnknownBreakoutConcept(
    rule: string,
    phase: 'entry' | 'exit',
    triggerIndex: number,
  ): NormalizedTriggerAtom | null {
    if (!/关键位置|回踩|确认支撑|确认压力/u.test(rule)) return null

    const sideScope = this.resolveSideScope(rule, phase)
    return this.createOpenTrigger({
      key: /跌破|下破|失守/u.test(rule) ? 'price.breakout_down' : 'price.breakout_up',
      phase,
      ...(sideScope ? { sideScope } : {}),
      params: {
        reference: 'unknown',
      },
    }, [
      {
        slotKey: 'unknown_trigger_definition',
        fieldPath: `triggers[${triggerIndex}].params.reference`,
        reason: 'missing_definition',
        questionHint: '这里的关键位置怎么定义？',
        priority: 'core',
        affectsExecution: true,
        evidenceText: rule,
      },
      {
        slotKey: 'pullback.confirmation',
        fieldPath: `triggers[${triggerIndex}].params.pullback`,
        reason: 'missing_definition',
        questionHint: '回踩确认用什么信号？',
        priority: 'core',
        affectsExecution: true,
        evidenceText: rule,
      },
    ], rule)
  }

  private tryNormalizeBreakout(
    rule: string,
    phase: 'entry' | 'exit',
  ): NormalizedTriggerAtom | null {
    if (/突破.{0,12}(?:阻力|高点|压力)|站上.{0,12}(?:阻力|高点|压力)|breakout|突破/u.test(rule)) {
      return this.createClosedTrigger({
        key: 'price.breakout_up',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? (phase === 'entry' ? 'long' : 'long'),
        params: { reference: 'resistance' },
      })
    }

    if (/跌破.{0,12}(?:支撑|低点)|失守.{0,12}(?:支撑|低点)|breakdown/iu.test(rule)) {
      return this.createClosedTrigger({
        key: 'price.breakout_down',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? (phase === 'entry' ? 'short' : 'long'),
        params: { reference: 'support' },
      })
    }

    return null
  }

  private tryNormalizePositionPnl(
    rule: string,
    phase: 'entry' | 'exit',
    basis: string | undefined,
  ): NormalizedTriggerAtom | null {
    if (phase !== 'exit') return null
    if (!/收益率|盈利|盈亏|pnl/iu.test(rule)) return null
    const rawValue = this.extractPercentValue(rule)
    if (rawValue === null) return null

    return this.createClosedTrigger({
      key: 'price.percent_change',
      phase,
      sideScope: this.resolveSideScope(rule, phase) ?? 'long',
      params: {
        valuePct: rawValue,
        basis: basis ?? 'position_pnl',
        window: this.extractWindow(rule) ?? 'position',
      },
    })
  }

  private tryNormalizeIndicatorThreshold(
    rule: string,
    phase: 'entry' | 'exit',
  ): NormalizedTriggerAtom | null {
    const percentMatch = rule.match(/(\d+(?:\.\d+)?)/u)
    if (/\brsi\b/i.test(rule)) {
      if (/超卖|低于|小于|<=|≤/u.test(rule)) {
        return this.createClosedTrigger({
          key: 'oscillator.rsi_lte',
          phase,
          sideScope: this.resolveSideScope(rule, phase),
          params: percentMatch?.[1] ? { value: Number(percentMatch[1]) } : {},
        })
      }
      if (/超买|高于|大于|>=|≥/u.test(rule)) {
        return this.createClosedTrigger({
          key: 'oscillator.rsi_gte',
          phase,
          sideScope: this.resolveSideScope(rule, phase),
          params: percentMatch?.[1] ? { value: Number(percentMatch[1]) } : {},
        })
      }
    }

    if (/均线|ema|sma|ma/iu.test(rule) && /上方|高于|站上/u.test(rule)) {
      return this.createClosedTrigger({
        key: 'indicator.above',
        phase,
        sideScope: this.resolveSideScope(rule, phase),
        params: { indicator: this.resolveIndicatorName(rule) },
      })
    }

    if (/均线|ema|sma|ma/iu.test(rule) && /下方|低于|跌破/u.test(rule)) {
      return this.createClosedTrigger({
        key: 'indicator.below',
        phase,
        sideScope: this.resolveSideScope(rule, phase),
        params: { indicator: this.resolveIndicatorName(rule) },
      })
    }

    return null
  }

  private tryNormalizeIndicatorCross(
    rule: string,
    phase: 'entry' | 'exit',
  ): NormalizedTriggerAtom | null {
    if (/金叉|cross over|上穿/u.test(rule)) {
      return this.createClosedTrigger({
        key: 'indicator.cross_over',
        phase,
        sideScope: this.resolveSideScope(rule, phase),
        params: { indicator: this.resolveIndicatorName(rule) },
      })
    }
    if (/死叉|cross under|下穿/u.test(rule)) {
      return this.createClosedTrigger({
        key: 'indicator.cross_under',
        phase,
        sideScope: this.resolveSideScope(rule, phase),
        params: { indicator: this.resolveIndicatorName(rule) },
      })
    }

    return null
  }

  private normalizeGrid(checklist: ChecklistPayload): NormalizedGridIntent | null {
    const explicitGrid = checklist.grid
    if (
      explicitGrid
      && typeof explicitGrid.lower === 'number'
      && typeof explicitGrid.upper === 'number'
      && typeof explicitGrid.stepPct === 'number'
    ) {
      return {
        family: GRID_STRATEGY_FAMILY,
        range: {
          lower: explicitGrid.lower,
          upper: explicitGrid.upper,
        },
        stepPct: explicitGrid.stepPct,
        sideMode: explicitGrid.sideMode ?? 'bidirectional',
        recycle: true,
        ...(explicitGrid.breakoutAction === 'pause' || explicitGrid.breakoutAction === 'continue'
          ? { breakoutAction: explicitGrid.breakoutAction }
          : {}),
      }
    }

    const combinedText = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    if (!/网格/u.test(combinedText)) return null

    const rangeMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const perMilleMatch = combinedText.match(/千分之\s*(\d+(?:\.\d+)?)/u)
    const percentMatch = combinedText.match(/(?:步长|每一格|每格)\s*(\d+(?:\.\d+)?)\s*%/u)
    if (!rangeMatch?.[1] || !rangeMatch[2]) return null

    const stepPct = percentMatch?.[1]
      ? Number(percentMatch[1])
      : (perMilleMatch?.[1] ? Number(perMilleMatch[1]) / 10 : null)
    if (stepPct === null || !Number.isFinite(stepPct)) return null

    return {
      family: GRID_STRATEGY_FAMILY,
      range: {
        lower: Number(rangeMatch[1]),
        upper: Number(rangeMatch[2]),
      },
      stepPct,
      sideMode: this.resolveGridSideMode(combinedText),
      recycle: true,
      breakoutAction: /突破.{0,8}(停|暂停|停止)/u.test(combinedText) ? 'pause' : 'continue',
    }
  }

  private buildGridTriggerAtoms(
    checklist: ChecklistPayload,
    grid: NormalizedGridIntent | null,
  ): NormalizedTriggerAtom[] {
    const combinedText = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    const structuredGrid = checklist.grid
    const breakoutAction = structuredGrid?.breakoutAction
      ?? (/突破.{0,8}(停|暂停|停止)/u.test(combinedText) ? 'pause' : 'continue')
    if (grid) {
      return [this.createClosedTrigger({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: grid.sideMode === 'bidirectional'
          ? 'both'
          : (grid.sideMode === 'short_only' ? 'short' : 'long'),
        params: {
          rangeLower: grid.range.lower,
          rangeUpper: grid.range.upper,
          stepPct: grid.stepPct,
          sideMode: grid.sideMode,
          recycle: grid.recycle,
          breakoutAction,
        },
      })]
    }

    if (structuredGrid) {
      const unresolvedSlots: UnresolvedSlot[] = []
      if (typeof structuredGrid.lower !== 'number' || !Number.isFinite(structuredGrid.lower)) {
        unresolvedSlots.push({
          slotKey: 'grid.range.lower',
          fieldPath: 'triggers[grid].params.rangeLower',
          reason: 'missing_required_param',
          questionHint: '请确认网格区间下界。',
          priority: 'core',
          affectsExecution: true,
          ...(combinedText ? { evidenceText: combinedText } : {}),
        })
      }
      if (typeof structuredGrid.upper !== 'number' || !Number.isFinite(structuredGrid.upper)) {
        unresolvedSlots.push({
          slotKey: 'grid.range.upper',
          fieldPath: 'triggers[grid].params.rangeUpper',
          reason: 'missing_required_param',
          questionHint: '请确认网格区间上界。',
          priority: 'core',
          affectsExecution: true,
          ...(combinedText ? { evidenceText: combinedText } : {}),
        })
      }
      if (typeof structuredGrid.stepPct !== 'number' || !Number.isFinite(structuredGrid.stepPct)) {
        unresolvedSlots.push({
          slotKey: 'grid.stepPct',
          fieldPath: 'triggers[grid].params.stepPct',
          reason: 'missing_required_param',
          questionHint: '请确认每格步长（例如 0.5%）。',
          priority: 'core',
          affectsExecution: true,
          ...(combinedText ? { evidenceText: combinedText } : {}),
        })
      }

      return [this.createOpenTrigger({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: structuredGrid.sideMode === 'short_only'
          ? 'short'
          : (structuredGrid.sideMode === 'long_only' ? 'long' : 'both'),
        params: {
          ...(typeof structuredGrid.lower === 'number' && Number.isFinite(structuredGrid.lower)
            ? { rangeLower: structuredGrid.lower }
            : {}),
          ...(typeof structuredGrid.upper === 'number' && Number.isFinite(structuredGrid.upper)
            ? { rangeUpper: structuredGrid.upper }
            : {}),
          ...(typeof structuredGrid.stepPct === 'number' && Number.isFinite(structuredGrid.stepPct)
            ? { stepPct: structuredGrid.stepPct }
            : {}),
          ...(structuredGrid.sideMode ? { sideMode: structuredGrid.sideMode } : {}),
          breakoutAction,
        },
      }, unresolvedSlots, combinedText || JSON.stringify(structuredGrid))]
    }

    if (!/网格|grid/iu.test(combinedText)) {
      return []
    }

    return [this.createOpenTrigger({
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope: 'both',
      params: {
        breakoutAction,
      },
    }, [
      {
        slotKey: 'grid.range.lower',
        fieldPath: 'triggers[grid].params.rangeLower',
        reason: 'missing_required_param',
        questionHint: '请确认网格区间下界。',
        priority: 'core',
        affectsExecution: true,
        evidenceText: combinedText,
      },
      {
        slotKey: 'grid.range.upper',
        fieldPath: 'triggers[grid].params.rangeUpper',
        reason: 'missing_required_param',
        questionHint: '请确认网格区间上界。',
        priority: 'core',
        affectsExecution: true,
        evidenceText: combinedText,
      },
      {
        slotKey: 'grid.stepPct',
        fieldPath: 'triggers[grid].params.stepPct',
        reason: 'missing_required_param',
        questionHint: '请确认每格步长（例如 0.5%）。',
        priority: 'core',
        affectsExecution: true,
        evidenceText: combinedText,
      },
    ], combinedText)]
  }

  private normalizeRisk(riskRules: Record<string, unknown> | undefined): NormalizedRiskAtom[] {
    if (!riskRules) return []

    const risk: NormalizedRiskAtom[] = []
    if (typeof riskRules.stopLossPct === 'number' && Number.isFinite(riskRules.stopLossPct)) {
      risk.push({
        key: 'risk.stop_loss_pct',
        params: {
          valuePct: riskRules.stopLossPct,
          basis: typeof riskRules.stopLossBasis === 'string' ? riskRules.stopLossBasis : 'entry_avg_price',
        },
      })
    }
    if (typeof riskRules.takeProfitPct === 'number' && Number.isFinite(riskRules.takeProfitPct)) {
      risk.push({
        key: 'risk.take_profit_pct',
        params: {
          valuePct: riskRules.takeProfitPct,
          basis: typeof riskRules.takeProfitBasis === 'string' ? riskRules.takeProfitBasis : 'entry_avg_price',
        },
      })
    }
    if (typeof riskRules.maxDrawdownPct === 'number' && Number.isFinite(riskRules.maxDrawdownPct)) {
      risk.push({
        key: 'risk.max_drawdown_pct',
        params: { valuePct: riskRules.maxDrawdownPct },
      })
    }
    if (typeof riskRules.maxSingleLossPct === 'number' && Number.isFinite(riskRules.maxSingleLossPct)) {
      risk.push({
        key: 'risk.max_single_loss_pct',
        params: { valuePct: riskRules.maxSingleLossPct },
      })
    }

    return risk
  }

  private normalizeActions(
    triggers: NormalizedTriggerAtom[],
    grid: NormalizedGridIntent | null,
  ): NormalizedActionAtom[] {
    if (grid) {
      return [
        { key: 'open_long' },
        { key: 'close_long' },
        { key: 'open_short' },
        { key: 'close_short' },
      ]
    }

    return triggers.flatMap((trigger) => {
      if (trigger.phase === 'entry') {
        if (trigger.sideScope === 'short') return [{ key: 'open_short' }]
        return [{ key: 'open_long' }]
      }
      if (trigger.phase === 'exit') {
        if (trigger.sideScope === 'short') return [{ key: 'close_short' }]
        return [{ key: 'close_long' }]
      }
      return []
    })
  }

  private normalizePosition(
    riskRules: Record<string, unknown> | undefined,
    actions: NormalizedActionAtom[],
    grid: NormalizedGridIntent | null,
  ): StrategyNormalizedIntent['position'] {
    const rawPositionPct = typeof riskRules?.positionPct === 'number' && Number.isFinite(riskRules.positionPct)
      ? riskRules.positionPct
      : 10
    const marketType = typeof riskRules?.marketType === 'string' ? riskRules.marketType : null
    const actionKeys = new Set(actions.map(action => action.key))
    const inferredPositionMode = (() => {
      if (grid?.sideMode === 'bidirectional') return 'long_short'
      if (grid?.sideMode === 'long_only') return 'long_only'
      if (grid?.sideMode === 'short_only') return 'short_only'
      const hasLong = actionKeys.has('open_long') || actionKeys.has('close_long') || actionKeys.has('reduce_long')
      const hasShort = actionKeys.has('open_short') || actionKeys.has('close_short') || actionKeys.has('reduce_short')
      if (hasLong && hasShort) return 'long_short'
      if (hasShort) return 'short_only'
      return 'long_only'
    })()

    return {
      mode: 'fixed_ratio',
      value: rawPositionPct / 100,
      positionMode: marketType === 'spot' ? 'long_only' : inferredPositionMode,
    }
  }

  private resolveFamilies(
    triggers: NormalizedTriggerAtom[],
    grid: NormalizedGridIntent | null,
  ): StrategyNormalizedIntent['families'] {
    const families = new Set<StrategyNormalizedIntent['families'][number]>()

    if (triggers.some(trigger => trigger.phase === 'entry' || trigger.phase === 'exit')) {
      families.add('single-leg')
    }
    if (grid) {
      families.add(GRID_STRATEGY_FAMILY)
    }
    return [...families]
  }

  private sortTriggers(triggers: NormalizedTriggerAtom[]): NormalizedTriggerAtom[] {
    return [...triggers].sort((left, right) => {
      const leftKey = `${left.phase}:${left.key}:${JSON.stringify(left.params)}:${left.sideScope ?? ''}:${JSON.stringify(left.resolutionHints ?? {})}`
      const rightKey = `${right.phase}:${right.key}:${JSON.stringify(right.params)}:${right.sideScope ?? ''}:${JSON.stringify(right.resolutionHints ?? {})}`
      return leftKey.localeCompare(rightKey)
    })
  }

  private harmonizeBollingerTriggers(
    triggers: NormalizedTriggerAtom[],
  ): NormalizedTriggerAtom[] {
    const reference = triggers.find(trigger => (
      (trigger.key === 'bollinger.touch_upper' || trigger.key === 'bollinger.touch_lower')
      && typeof trigger.params.period === 'number'
      && typeof trigger.params.stdDev === 'number'
    ))

    if (!reference) {
      return triggers
    }

    return triggers.map((trigger) => {
      if (!trigger.key.startsWith('bollinger.touch_')) {
        return trigger
      }

      return {
        ...trigger,
        params: {
          ...trigger.params,
          ...(typeof trigger.params.period === 'number' ? {} : { period: reference.params.period }),
          ...(typeof trigger.params.stdDev === 'number' ? {} : { stdDev: reference.params.stdDev }),
        },
      }
    })
  }

  private resolveBollingerConfirmationHint(rule: string): 'touch' | 'close_confirm' | 'ambiguous_touch_or_close_confirm' {
    const hasTouchCue = /触及|触碰|碰到|touch/iu.test(rule)
    const hasCloseConfirmCue = /收盘|收于|收在|close/iu.test(rule)

    if (hasTouchCue && hasCloseConfirmCue) {
      return 'ambiguous_touch_or_close_confirm'
    }
    if (hasCloseConfirmCue) {
      return 'close_confirm'
    }
    if (hasTouchCue) {
      return 'touch'
    }

    return 'ambiguous_touch_or_close_confirm'
  }

  private extractWindow(rule: string): string | null {
    const matched = rule.match(/(\d{1,4})\s*(分钟|min|小时|[mhd天])/iu)
    if (!matched?.[1] || !matched[2]) return null
    const value = matched[1]
    const unit = matched[2].toLowerCase()
    if (unit === 'm' || unit === 'min' || unit === '分钟') return `${value}m`
    if (unit === 'h' || unit === '小时') return `${value}h`
    return `${value}d`
  }

  private extractPercentValue(rule: string): number | null {
    const standardMatch = rule.match(/(\d+(?:\.\d+)?)\s*%/u)
    if (standardMatch?.[1]) return Number(standardMatch[1])

    const chineseMatch = rule.match(/百分之?\s*(\d+(?:\.\d+)?)/u)
    if (chineseMatch?.[1]) return Number(chineseMatch[1])

    return null
  }

  private resolveSideScope(rule: string, phase: 'entry' | 'exit'): NormalizedTriggerAtom['sideScope'] | undefined {
    if (/做空|开空|平空|空单|short/u.test(rule)) return 'short'
    if (/做多|开多|买入|平多|多单|long/u.test(rule)) return 'long'
    if (phase === 'exit' && /卖出|止盈|平仓|离场|出场/u.test(rule)) {
      return 'long'
    }
    return phase === 'exit' ? 'both' : undefined
  }

  private resolveGridSideMode(text: string): NormalizedGridIntent['sideMode'] {
    if (/双向/u.test(text)) return 'bidirectional'
    if (/做空网格|空头网格|short/u.test(text)) return 'short_only'
    if (/做多网格|多头网格|long/u.test(text)) return 'long_only'
    return 'bidirectional'
  }

  private resolveIndicatorName(rule: string): string {
    if (/\brsi\b/i.test(rule)) return 'rsi'
    if (/\bmacd\b/i.test(rule)) return 'macd'
    if (/\bema\b/i.test(rule)) return 'ema'
    if (/\bsma\b/i.test(rule) || /均线|ma/iu.test(rule)) return 'sma'
    return 'indicator'
  }

  private createClosedTrigger(
    trigger: Omit<NormalizedTriggerAtom, 'closureStatus' | 'unresolvedSlots' | 'evidenceText'>,
  ): NormalizedTriggerAtom {
    return {
      ...trigger,
      closureStatus: 'closed',
      unresolvedSlots: [],
    }
  }

  private createOpenTrigger(
    trigger: Omit<NormalizedTriggerAtom, 'closureStatus' | 'unresolvedSlots' | 'evidenceText'>,
    unresolvedSlots: UnresolvedSlot[],
    evidenceText?: string,
  ): NormalizedTriggerAtom {
    return {
      ...trigger,
      closureStatus: 'open',
      unresolvedSlots,
      ...(evidenceText ? { evidenceText } : {}),
    }
  }
}
