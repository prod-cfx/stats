import { Injectable } from '@nestjs/common'
import type { SemanticSlotState, SemanticState } from '../types/semantic-state'

export interface SemanticConversationView {
  summary: string
  triggerSummary: string
  riskSummary: string
  positionSummary: string
  executionContext: {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  }
  hasDeterministicSemantics: boolean
  recommendationSignals: {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  }
  inferredDefaults: {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: string | null
    takeProfitBasis: string | null
  }
}

@Injectable()
export class SemanticStateProjectionService {
  buildConversationView(state: SemanticState): SemanticConversationView {
    const deterministicTriggers = this.filterDeterministicTriggers(state.triggers)
    const deterministicRisk = this.filterDeterministicRisk(state.risk)
    const deterministicActions = this.filterDeterministicActions(state.actions)
    const deterministicSignals = this.buildRecommendationSignals({
      actions: deterministicActions,
      triggers: deterministicTriggers,
      families: state.families,
    })
    const triggerSummary = this.buildTriggerSummary(deterministicTriggers, false)
    const riskSummary = this.buildRiskSummary(deterministicRisk)
    const positionSummary = this.buildPositionSummary(state.position)
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const inferredDefaults = this.buildInferredDefaults(deterministicRisk)
    const hasDeterministicSemantics = this.hasDeterministicSemantics({
      triggers: deterministicTriggers,
      actions: deterministicActions,
      risk: deterministicRisk,
      position: state.position,
      hasGridIntent: deterministicSignals.hasGridIntent,
    })
    const summaryItems = [triggerSummary, riskSummary, positionSummary]
      .filter(item => item.length > 0)

    return {
      summary: summaryItems.length > 0 ? summaryItems.join('；') : '已识别部分条件，但仍未完整。',
      triggerSummary,
      riskSummary,
      positionSummary,
      executionContext,
      hasDeterministicSemantics,
      recommendationSignals: {
        hasShortIntent: deterministicSignals.hasShortIntent,
        hasLongIntent: deterministicSignals.hasLongIntent,
        hasBidirectionalIntent: deterministicSignals.hasBidirectionalIntent,
        hasGridIntent: deterministicSignals.hasGridIntent,
      },
      inferredDefaults,
    }
  }

  buildClarificationView(state: SemanticState): {
    summary: string
    nextQuestion: string | null
  } {
    const triggerSummary = this.buildTriggerSummary(state.triggers, true)

    const nextSlot = this.findNextOpenSlot(state)

    return {
      summary: triggerSummary || '已识别部分条件，但仍未完整。',
      nextQuestion: nextSlot?.questionHint ?? null,
    }
  }

  private buildExecutionContext(slots: {
    exchange: SemanticSlotState | null
    symbol: SemanticSlotState | null
    marketType: SemanticSlotState | null
    timeframe: SemanticSlotState | null
  }): {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  } {
    return {
      exchange: this.readExecutionContextValue(slots.exchange),
      symbol: this.readExecutionContextValue(slots.symbol),
      marketType: this.readExecutionContextValue(slots.marketType),
      timeframe: this.readExecutionContextValue(slots.timeframe),
    }
  }

  private readExecutionContextValue(slot: SemanticSlotState | null): string | null {
    if (!slot || slot.status !== 'locked') {
      return null
    }

    return typeof slot.value === 'string' ? slot.value : null
  }

  private buildTriggerSummary(triggers: SemanticState['triggers'], includeSuperseded: boolean): string {
    const sourceTriggers = includeSuperseded
      ? [...triggers]
      : triggers.filter(trigger => trigger.status === 'locked')

    return sourceTriggers
      .sort((left, right) => this.compareTriggers(left, right))
      .map((trigger) => {
        if (trigger.key === 'grid.range_rebalance') {
          const lower = trigger.params.rangeLower
          const upper = trigger.params.rangeUpper
          const stepPct = trigger.params.stepPct
          return [
            '入场：区间网格',
            typeof lower === 'number' && typeof upper === 'number' ? `${lower}-${upper}` : '区间待补充',
            typeof stepPct === 'number' ? `步长 ${this.formatPercent(stepPct)}%` : '步长待补充',
          ].join(' ')
        }

        if (trigger.key === 'execution.on_start') {
          return trigger.phase === 'entry'
            ? '入场：立即开始时市价执行一次'
            : '出场：立即开始时市价执行一次'
        }

        if (trigger.key === 'price.percent_change') {
          const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
          const basisLabel = basis === 'entry_avg_price' || basis === 'position_pnl'
            ? '开仓均价'
            : '前收盘'
          const direction = typeof trigger.params.valuePct === 'number' && trigger.params.valuePct > 0 ? '上涨' : '下跌'
          const pctText = typeof trigger.params.valuePct === 'number' ? `${this.formatPercent(Math.abs(trigger.params.valuePct))}%` : '阈值待补充'
          return `${trigger.phase === 'entry' ? '入场' : '出场'}：价格相对${basisLabel}${direction}${pctText}`
        }

        if (trigger.key === 'indicator.above' && trigger.params['reference.period']) {
          return `入场：突破 MA${trigger.params['reference.period']}`
        }

        if (trigger.key === 'indicator.below' && trigger.params['reference.period']) {
          return `出场：跌破 MA${trigger.params['reference.period']}`
        }

        if (
          (trigger.key === 'bollinger.touch_upper' || trigger.key === 'bollinger.touch_lower' || trigger.key === 'bollinger.touch_middle')
          && trigger.params.period !== undefined
        ) {
          const period = typeof trigger.params.period === 'number' ? trigger.params.period : 0
          const band = trigger.key === 'bollinger.touch_upper'
            ? '上轨'
            : trigger.key === 'bollinger.touch_lower'
              ? '下轨'
              : '中轨'
          const direction = trigger.sideScope === 'short' ? '做空' : '做多'
          return `触及 MA${period} 的布林带${band}时${direction}`
        }

        return trigger.key
      })
      .filter(item => item.length > 0)
      .join('；')
  }

  private buildRiskSummary(riskItems: SemanticState['risk']): string {
    return riskItems
      .filter(risk => risk.status === 'locked')
      .sort((left, right) => this.compareRiskAtoms(left, right))
      .map((risk) => {
        const valuePct = risk.params.valuePct
        if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) {
          return ''
        }

        if (risk.key === 'risk.stop_loss_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止损：价格相对${basis}下跌${this.formatPercent(valuePct)}% 强制平仓`
        }

        if (risk.key === 'risk.take_profit_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止盈：价格相对${basis}上涨${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_drawdown_pct') {
          return `回撤：下跌${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_single_loss_pct') {
          return `单笔止损：下跌${this.formatPercent(valuePct)}%`
        }

        return ''
      })
      .filter(item => item.length > 0)
      .join('；')
  }

  private describeRiskBasis(rawBasis: unknown): string {
    if (rawBasis === 'entry_avg_price' || rawBasis === 'position_pnl') {
      return '入场均价'
    }

    if (rawBasis === 'peak_position_pnl' || rawBasis === 'peak_equity') {
      return '持仓收益高点'
    }

    if (rawBasis === 'upper_band') {
      return '布林带上轨'
    }

    if (rawBasis === 'lower_band') {
      return '布林带下轨'
    }

    if (rawBasis === 'middle_band') {
      return '布林带中轨'
    }

    return '前收盘'
  }

  private buildPositionSummary(position: SemanticState['position']): string {
    if (!this.hasValidLockedPosition(position)) {
      return ''
    }

    const ratio = position.mode === 'fixed_ratio'
      ? this.formatRatio(position.value)
      : String(position.value)
    return `仓位：${ratio}%`
  }

  private hasValidLockedPosition(position: SemanticState['position']): position is SemanticState['position'] & { status: 'locked' } {
    return !!position
      && position.status === 'locked'
      && position.mode === 'fixed_ratio'
      && Number.isFinite(position.value)
      && position.value > 0
  }

  private buildRecommendationSignals(input: {
    actions: SemanticState['actions']
    triggers: SemanticState['triggers']
    families: SemanticState['families']
  }): {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  } {
    const hasGridFamily = input.families.includes('grid.range_rebalance')
      || input.families.some(family => family.includes('grid'))
    const hasGridTrigger = input.triggers.some(trigger =>
      trigger.key.includes('grid')
    )
    const hasGridIntent = hasGridTrigger
      || (hasGridFamily && (input.actions.length > 0 || input.triggers.length > 0))

    const hasLongIntentFromActions = input.actions
      .some(action => action.key === 'open_long' || action.key === 'close_long' || action.key === 'reduce_long')

    const hasShortIntentFromActions = input.actions
      .some(action => action.key === 'open_short' || action.key === 'close_short' || action.key === 'reduce_short')

    const hasLongIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'long')

    const hasShortIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'short')

    const hasBidirectionalFromSideScope = input.triggers
      .some(trigger => trigger.sideScope === 'both')

    const hasBidirectionalGridSideMode = input.triggers
      .some(trigger => trigger.key === 'grid.range_rebalance' && trigger.params.sideMode === 'bidirectional')

    const hasLongIntent = hasLongIntentFromActions || hasLongIntentFromTrigger
    const hasShortIntent = hasShortIntentFromActions || hasShortIntentFromTrigger
    const hasBidirectionalIntent = (hasLongIntent && hasShortIntent)
      || hasBidirectionalFromSideScope
      || hasBidirectionalGridSideMode

    return {
      hasShortIntent,
      hasLongIntent,
      hasBidirectionalIntent,
      hasGridIntent,
    }
  }

  private hasDeterministicSemantics(
    input: {
      triggers: SemanticState['triggers']
      actions: SemanticState['actions']
      risk: SemanticState['risk']
      position: SemanticState['position']
      hasGridIntent: boolean
    },
  ): boolean {
    return input.triggers.length > 0
      || input.actions.length > 0
      || input.risk.length > 0
      || this.hasValidLockedPosition(input.position)
      || input.hasGridIntent
  }

  private compareTriggers(left: SemanticState['triggers'][number], right: SemanticState['triggers'][number]): number {
    const phaseOrder: Record<'entry' | 'exit' | 'risk' | 'gate', number> = {
      entry: 0,
      exit: 1,
      risk: 2,
      gate: 3,
    }
    if (left.phase !== right.phase) {
      return phaseOrder[left.phase] - phaseOrder[right.phase]
    }

    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareRiskAtoms(
    left: SemanticState['risk'][number],
    right: SemanticState['risk'][number],
  ): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private filterDeterministicAtoms<T extends {
    id: string
    status: 'open' | 'locked' | 'superseded'
    supersedes?: string[]
  }>(atoms: T[]): T[] {
    const supersededIds = new Set(
      atoms
        .flatMap(atom => atom.supersedes ?? [])
        .filter(supersededId => typeof supersededId === 'string'),
    )

    return atoms
      .filter(atom => atom.status === 'locked')
      .filter(atom => !supersededIds.has(atom.id))
      .sort((left, right) => this.compareDeterministicAtoms(left, right))
  }

  private filterDeterministicRisk(riskItems: SemanticState['risk']): SemanticState['risk'] {
    return this.filterDeterministicAtoms(riskItems)
  }

  private filterDeterministicTriggers(triggers: SemanticState['triggers']): SemanticState['triggers'] {
    return this.filterDeterministicAtoms(triggers)
      .sort((left, right) => this.compareTriggers(left, right))
  }

  private filterDeterministicActions(actions: SemanticState['actions']): SemanticState['actions'] {
    return this.filterDeterministicAtoms(actions)
      .sort((left, right) => this.compareActionAtoms(left, right))
  }

  private formatPercent(value: number): string {
    const normalized = Number.parseFloat(Number(value).toFixed(6))
    return `${normalized}`
  }

  private formatRatio(value: number): string {
    const percent = value <= 1 ? value * 100 : value
    return this.formatPercent(percent)
  }

  private buildInferredDefaults(riskItems: SemanticState['risk']): {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: string | null
    takeProfitBasis: string | null
  } {
    const inferred: {
      inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
      stopLossBasis: string | null
      takeProfitBasis: string | null
    } = {
      inferredKeys: [],
      stopLossBasis: null,
      takeProfitBasis: null,
    }

    for (const risk of riskItems) {
      if (typeof risk.params.basis !== 'string' || risk.params.basisSource !== 'system_default') {
        continue
      }

      if (risk.key === 'risk.stop_loss_pct' && !inferred.inferredKeys.includes('risk.stopLossBasis')) {
        inferred.inferredKeys.push('risk.stopLossBasis')
        inferred.stopLossBasis = risk.params.basis
      }

      if (risk.key === 'risk.take_profit_pct' && !inferred.inferredKeys.includes('risk.takeProfitBasis')) {
        inferred.inferredKeys.push('risk.takeProfitBasis')
        inferred.takeProfitBasis = risk.params.basis
      }
    }

    return inferred
  }

  private findNextOpenSlot(state: SemanticState): SemanticSlotState | null {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      state.triggers
        .filter(trigger => trigger.phase === phase)
        .flatMap(trigger => trigger.openSlots)
        .filter(slot => slot.status === 'open'),
    )
    const behaviorTriggerSlot = openTriggerSlots.find(slot =>
      slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition',
    )
    if (behaviorTriggerSlot) {
      return behaviorTriggerSlot
    }

    const firstBlockingTriggerSlot = openTriggerSlots[0] ?? null
    if (firstBlockingTriggerSlot) {
      return firstBlockingTriggerSlot
    }

    const positionSlot = state.position?.openSlots?.find(slot => slot.status === 'open') ?? null
    if (positionSlot) {
      return positionSlot
    }

    const riskSlot = state.risk
      .flatMap(risk => risk.openSlots)
      .find(slot => slot.status === 'open')
    if (riskSlot) {
      return riskSlot
    }

    return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
  }

  private compareActionAtoms(left: SemanticState['actions'][number], right: SemanticState['actions'][number]): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareDeterministicAtoms(
    left: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
    right: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
  ): number {
    return left.id.localeCompare(right.id)
  }
}
