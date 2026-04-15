import type { ChecklistPayload } from '../types/codegen-checklist'
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
    const triggers = this.sortTriggers([
      ...entryNormalization.triggers,
      ...exitNormalization.triggers,
    ])
    const grid = this.normalizeGrid(checklist)
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
      const bollinger = this.tryNormalizeBollinger(rule, phase)
      if (bollinger) {
        triggers.push(bollinger)
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
      const hintIndex = hints.length
      hints.push({
        type: 'regime',
        value: stateGates.marketRegime,
        mode: 'observation_only',
        closureStatus: 'open',
        unresolvedSlots: [
          {
            slotKey: 'regimeDefinition',
            fieldPath: `stateHints[${hintIndex}].definition`,
            reason: 'missing_definition',
            questionHint: '震荡行情怎么判断？',
            priority: 'behavior',
            affectsExecution: true,
            evidenceText: stateGates.marketRegime,
          },
        ],
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

    if (/上轨|upper/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_upper',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? (phase === 'entry' ? 'short' : 'both'),
        params: { band: 'upper' },
      })
    }

    if (/下轨|lower/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_lower',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? 'long',
        params: { band: 'lower' },
      })
    }

    if (/中轨|middle|ma20|均线20/i.test(normalized)) {
      return this.createClosedTrigger({
        key: 'bollinger.touch_middle',
        phase,
        sideScope: this.resolveSideScope(rule, phase) ?? 'both',
        params: { band: 'middle' },
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

    const questionPrefix = referenceRole === 'long_term' ? '长期均线' : '短期均线'
    const sideScope = this.resolveSideScope(rule, phase)
    if (/突破|站上|上方|高于/u.test(rule)) {
      return this.createOpenTrigger({
        key: 'indicator.above',
        phase,
        ...(sideScope ? { sideScope } : {}),
        params: {
          indicator: 'ma',
          referenceRole,
        },
      }, [
        {
          slotKey: 'reference.period',
          fieldPath: `triggers[${triggerIndex}].params.reference.period`,
          reason: 'missing_required_param',
          questionHint: `${questionPrefix}是多少？`,
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        },
        {
          slotKey: 'confirmationMode',
          fieldPath: `triggers[${triggerIndex}].params.confirmationMode`,
          reason: 'missing_definition',
          questionHint: '突破按收盘确认还是盘中触发？',
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        },
      ], rule)
    }

    if (/跌破|失守|下方|低于/u.test(rule)) {
      return this.createOpenTrigger({
        key: 'indicator.below',
        phase,
        ...(sideScope ? { sideScope } : {}),
        params: {
          indicator: 'ma',
          referenceRole,
        },
      }, [
        {
          slotKey: 'reference.period',
          fieldPath: `triggers[${triggerIndex}].params.reference.period`,
          reason: 'missing_required_param',
          questionHint: `${questionPrefix}是多少？`,
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        },
        {
          slotKey: 'confirmationMode',
          fieldPath: `triggers[${triggerIndex}].params.confirmationMode`,
          reason: 'missing_definition',
          questionHint: '跌破按收盘确认还是盘中触发？',
          priority: 'core',
          affectsExecution: true,
          evidenceText: rule,
        },
      ], rule)
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
      }
    }

    const combinedText = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    if (!/网格/u.test(combinedText)) return null

    const rangeMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const perMilleMatch = combinedText.match(/千分之\s*(\d+(?:\.\d+)?)/u)
    const percentMatch = combinedText.match(/(?:步长|每格)\s*(\d+(?:\.\d+)?)\s*%/u)
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
    }
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
      const leftKey = `${left.phase}:${left.key}:${JSON.stringify(left.params)}:${left.sideScope ?? ''}`
      const rightKey = `${right.phase}:${right.key}:${JSON.stringify(right.params)}:${right.sideScope ?? ''}`
      return leftKey.localeCompare(rightKey)
    })
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
    if (/做空|开空|平空|short/u.test(rule)) return 'short'
    if (/做多|开多|买入|平多|long/u.test(rule)) return 'long'
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
