import { Injectable } from '@nestjs/common'
import type { ChecklistPayload } from '../types/codegen-checklist'
import type { SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type {
  StrategyNormalizedIntent,
  NormalizedTriggerAtom,
} from '../types/strategy-normalized-intent'

@Injectable()
export class SemanticStateCompileBridgeService {
  buildNormalizedIntent(state: SemanticState): StrategyNormalizedIntent {
    const families = new Set(state.families)
    if (state.triggers.some(trigger => trigger.phase === 'gate')) {
      families.add('state-gated')
    }
    const grid = this.buildGridIntent(state.triggers)

    return {
      families: Array.from(families) as StrategyNormalizedIntent['families'],
      triggers: state.triggers
        .filter(trigger => trigger.status !== 'superseded')
        .map(trigger => this.toNormalizedTrigger(trigger)),
      actions: state.actions.map(action => ({
        key: action.key,
        ...(action.params ? { params: { ...action.params } } : {}),
      })),
      risk: state.risk.map(risk => ({
        key: risk.key,
        params: { ...risk.params },
      })),
      position: state.position
        ? {
            mode: state.position.mode as StrategyNormalizedIntent['position']['mode'],
            value: state.position.value,
            positionMode: state.position.positionMode as StrategyNormalizedIntent['position']['positionMode'],
          }
        : null,
      ...(grid ? { grid } : {}),
      unresolved: [],
      normalizationNotes: [...state.normalizationNotes],
    }
  }

  private buildGridIntent(
    triggers: SemanticTriggerState[],
  ): StrategyNormalizedIntent['grid'] {
    const activeGrid = triggers.find(trigger =>
      trigger.key === 'grid.range_rebalance'
      && trigger.status !== 'superseded'
      && typeof trigger.params.rangeLower === 'number'
      && typeof trigger.params.rangeUpper === 'number'
      && typeof trigger.params.stepPct === 'number',
    )
    if (!activeGrid) {
      return null
    }

    return {
      family: 'grid.range_rebalance',
      range: {
        lower: activeGrid.params.rangeLower as number,
        upper: activeGrid.params.rangeUpper as number,
      },
      stepPct: activeGrid.params.stepPct as number,
      sideMode: (activeGrid.params.sideMode as StrategyNormalizedIntent['grid']['sideMode']) ?? 'bidirectional',
      recycle: activeGrid.params.recycle !== false,
    }
  }

  buildLegacyChecklist(
    state: SemanticState,
    fallbackChecklist: ChecklistPayload = {},
  ): ChecklistPayload {
    const nextChecklist: ChecklistPayload = {
      ...fallbackChecklist,
      riskRules: fallbackChecklist.riskRules ? { ...fallbackChecklist.riskRules } : undefined,
      stateGates: fallbackChecklist.stateGates ? { ...fallbackChecklist.stateGates } : undefined,
      market: fallbackChecklist.market ? { ...fallbackChecklist.market } : undefined,
    }

    const entryRules = this.buildRulesForPhase(state, 'entry')
    const exitRules = this.buildRulesForPhase(state, 'exit')

    if (entryRules.length > 0) {
      nextChecklist.entryRules = entryRules
      nextChecklist.entryRuleDrafts = undefined
    }
    if (exitRules.length > 0) {
      nextChecklist.exitRules = exitRules
      nextChecklist.exitRuleDrafts = undefined
    }

    const projectedStateGates = this.buildStateGates(state)
    if (Object.keys(projectedStateGates).length > 0) {
      nextChecklist.stateGates = {
        ...(nextChecklist.stateGates ?? {}),
        ...projectedStateGates,
      }
    }

    const riskRules = {
      ...(nextChecklist.riskRules ?? {}),
    } as Record<string, unknown>

    for (const risk of state.risk) {
      if (risk.key === 'risk.stop_loss_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.stopLossPct = risk.params.valuePct
      }
      if (risk.key === 'risk.take_profit_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.takeProfitPct = risk.params.valuePct
      }
      if (risk.key === 'risk.max_drawdown_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.maxDrawdownPct = risk.params.valuePct
      }
      if (risk.key === 'risk.max_single_loss_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.maxSingleLossPct = risk.params.valuePct
      }
      if (
        (risk.key === 'risk.stop_loss_pct' || risk.key === 'risk.take_profit_pct')
        && typeof risk.params.basis === 'string'
      ) {
        if (risk.key === 'risk.stop_loss_pct') {
          riskRules.stopLossBasis = risk.params.basis
        }
        if (risk.key === 'risk.take_profit_pct') {
          riskRules.takeProfitBasis = risk.params.basis
        }
      }
    }

    if (state.position?.mode === 'fixed_ratio' && Number.isFinite(state.position.value)) {
      riskRules.positionPct = state.position.value <= 1
        ? state.position.value * 100
        : state.position.value
    }

    const exchange = this.readContextValue(state.contextSlots.exchange)
    const symbol = this.readContextValue(state.contextSlots.symbol)
    const marketType = this.readContextValue(state.contextSlots.marketType)
    const timeframe = this.readContextValue(state.contextSlots.timeframe)

    if (exchange) riskRules.exchange = exchange
    if (marketType) riskRules.marketType = marketType
    if (Object.keys(riskRules).length > 0) {
      nextChecklist.riskRules = riskRules
    }
    if (symbol) {
      nextChecklist.symbols = [symbol]
    }
    if (timeframe) {
      nextChecklist.timeframes = [timeframe]
    }

    return nextChecklist
  }

  private buildStateGates(state: SemanticState): NonNullable<ChecklistPayload['stateGates']> {
    const nextStateGates: NonNullable<ChecklistPayload['stateGates']> = {}

    for (const trigger of state.triggers) {
      if (trigger.phase !== 'gate') continue

      if (trigger.key === 'market.regime' && typeof trigger.params.value === 'string') {
        nextStateGates.marketRegime = trigger.params.value as NonNullable<ChecklistPayload['stateGates']>['marketRegime']
      }
      if (trigger.key === 'trend.direction' && typeof trigger.params.value === 'string') {
        nextStateGates.trendDirection = trigger.params.value as NonNullable<ChecklistPayload['stateGates']>['trendDirection']
      }
      if (trigger.key === 'volatility.state' && typeof trigger.params.value === 'string') {
        nextStateGates.volatilityState = trigger.params.value as NonNullable<ChecklistPayload['stateGates']>['volatilityState']
      }
    }

    return nextStateGates
  }

  private toNormalizedTrigger(trigger: SemanticTriggerState): NormalizedTriggerAtom {
    const confirmationMode = typeof trigger.params.confirmationMode === 'string'
      ? trigger.params.confirmationMode
      : null
    const unresolvedSlots = trigger.openSlots.map(slot => this.toUnresolvedSlot(slot))

    return {
      key: trigger.key as NormalizedTriggerAtom['key'],
      phase: trigger.phase,
      ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
      params: { ...trigger.params } as NormalizedTriggerAtom['params'],
      ...(confirmationMode === 'touch'
        || confirmationMode === 'close_confirm'
        || confirmationMode === 'ambiguous_touch_or_close_confirm'
        ? { resolutionHints: { confirmation: confirmationMode } }
        : {}),
      closureStatus: trigger.status === 'locked' && unresolvedSlots.length === 0 ? 'closed' : 'open',
      unresolvedSlots,
      ...(trigger.evidence?.text ? { evidenceText: trigger.evidence.text } : {}),
    }
  }

  private toUnresolvedSlot(slot: SemanticSlotState): NormalizedTriggerAtom['unresolvedSlots'][number] {
    return {
      slotKey: slot.slotKey,
      fieldPath: slot.fieldPath,
      reason: 'missing_definition',
      questionHint: slot.questionHint,
      priority: slot.priority,
      affectsExecution: slot.affectsExecution,
      ...(slot.evidence?.text ? { evidenceText: slot.evidence.text } : {}),
    }
  }

  private buildRulesForPhase(
    state: SemanticState,
    phase: 'entry' | 'exit',
  ): string[] {
    return state.triggers
      .filter(trigger => trigger.phase === phase && trigger.status !== 'superseded')
      .map(trigger => this.buildRuleText(trigger))
      .filter((rule): rule is string => Boolean(rule))
  }

  private buildRuleText(trigger: SemanticTriggerState): string | null {
    if (
      (trigger.key === 'indicator.above' || trigger.key === 'indicator.below')
      && trigger.params.indicator === 'ma'
    ) {
      return this.buildMovingAverageRule(trigger)
    }

    if (
      trigger.key === 'bollinger.touch_upper'
      || trigger.key === 'bollinger.touch_lower'
      || trigger.key === 'bollinger.touch_middle'
    ) {
      return this.buildBollingerRule(trigger)
    }

    return null
  }

  private buildMovingAverageRule(trigger: SemanticTriggerState): string | null {
    const referenceRole = trigger.params.referenceRole === 'short_term' ? '短期均线' : '长期均线'
    const referencePeriod = typeof trigger.params['reference.period'] === 'number'
      ? `（${trigger.params['reference.period']}）`
      : ''
    const confirmationPrefix = trigger.params.confirmationMode === 'close_confirm'
      ? '收盘确认'
      : (trigger.params.confirmationMode === 'touch' ? '盘中' : '')
    const verb = trigger.key === 'indicator.above' ? '突破' : '跌破'
    const action = trigger.phase === 'entry'
      ? (trigger.sideScope === 'short' ? '做空' : '买入')
      : (trigger.sideScope === 'short' ? '平空' : '卖出')

    return `${confirmationPrefix}价格${verb}${referenceRole}${referencePeriod}时${action}`
  }

  private buildBollingerRule(trigger: SemanticTriggerState): string | null {
    const period = this.readPositiveNumber(trigger.params.period) ?? 20
    const stdDev = this.readPositiveNumber(trigger.params.stdDev) ?? 2
    const confirmationPrefix = trigger.params.confirmationMode === 'close_confirm'
      ? 'K线收盘后确认'
      : '触及'

    if (trigger.phase === 'entry') {
      const band = trigger.key === 'bollinger.touch_upper'
        ? '上轨'
        : trigger.key === 'bollinger.touch_lower'
          ? '下轨'
          : '中轨'
      const action = trigger.sideScope === 'short' ? '做空' : '做多'
      return `${confirmationPrefix}突破布林带(${period},${this.formatNumber(stdDev)})${band}时${action}`
    }

    if (trigger.phase === 'exit' && trigger.key === 'bollinger.touch_middle') {
      const action = trigger.sideScope === 'short'
        ? '平空'
        : trigger.sideScope === 'long'
          ? '平多'
          : '平仓'
      return `价格回到布林带中轨(MA${period})时${action}`
    }

    return null
  }

  private readPositiveNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(value)
  }

  private readContextValue(slot: SemanticSlotState | null): string | null {
    if (!slot) return null
    return typeof slot.value === 'string' && slot.value.trim() ? slot.value.trim() : null
  }
}
