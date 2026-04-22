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
    const triggerSummary = this.buildTriggerSummary(state.triggers, false)
    const riskSummary = this.buildRiskSummary(state.risk)
    const positionSummary = this.buildPositionSummary(state.position)
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const recommendationSignals = this.buildRecommendationSignals(state)
    const inferredDefaults = this.buildInferredDefaults(state.risk)
    const hasDeterministicSemantics = this.hasDeterministicSemantics(state, recommendationSignals)
    const summaryItems = [triggerSummary, riskSummary, positionSummary]
      .filter(item => item.length > 0)

    return {
      summary: summaryItems.length > 0 ? summaryItems.join('；') : '已识别部分条件，但仍未完整。',
      triggerSummary,
      riskSummary,
      positionSummary,
      executionContext,
      hasDeterministicSemantics,
      recommendationSignals,
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
      ? triggers
      : triggers.filter(trigger => trigger.status !== 'superseded')

    return sourceTriggers
      .map((trigger) => {
        if (trigger.key === 'grid.range_rebalance') {
          const lower = trigger.params.rangeLower
          const upper = trigger.params.rangeUpper
          const stepPct = trigger.params.stepPct
          return [
            '入场：区间网格',
            typeof lower === 'number' && typeof upper === 'number' ? `${lower}-${upper}` : '区间待补充',
            typeof stepPct === 'number' ? `步长 ${stepPct}%` : '步长待补充',
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
          const pctText = typeof trigger.params.valuePct === 'number' ? `${Math.abs(trigger.params.valuePct)}%` : '阈值待补充'
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
      .filter(risk => risk.status !== 'superseded')
      .map((risk) => {
        const valuePct = risk.params.valuePct
        if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) {
          return ''
        }

        if (risk.key === 'risk.stop_loss_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止损：价格相对${basis}下跌${valuePct}% 强制平仓`
        }

        if (risk.key === 'risk.take_profit_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止盈：价格相对${basis}上涨${valuePct}% 平仓`
        }

        if (risk.key === 'risk.max_drawdown_pct') {
          return `回撤：下跌${valuePct}% 平仓`
        }

        if (risk.key === 'risk.max_single_loss_pct') {
          return `单笔止损：下跌${valuePct}%`
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
      ? `${position.value <= 1 ? position.value * 100 : position.value}`
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

  private buildRecommendationSignals(state: SemanticState): {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  } {
    const hasGridIntent = state.families.includes('grid.range_rebalance')
      || state.families.some(family => family.includes('grid'))
      || state.triggers.some(trigger =>
        trigger.status !== 'superseded'
        && trigger.key.includes('grid')
      )

    const hasLongIntentFromActions = state.actions
      .filter(action => action.status !== 'superseded')
      .some(action => action.key === 'open_long' || action.key === 'close_long' || action.key === 'reduce_long')

    const hasShortIntentFromActions = state.actions
      .filter(action => action.status !== 'superseded')
      .some(action => action.key === 'open_short' || action.key === 'close_short' || action.key === 'reduce_short')

    const hasLongIntentFromTrigger = state.triggers
      .filter(trigger => trigger.status !== 'superseded')
      .some(trigger => trigger.sideScope === 'long')

    const hasShortIntentFromTrigger = state.triggers
      .filter(trigger => trigger.status !== 'superseded')
      .some(trigger => trigger.sideScope === 'short')

    const hasBidirectionalFromSideScope = state.triggers
      .filter(trigger => trigger.status !== 'superseded')
      .some(trigger => trigger.sideScope === 'both')

    const hasBidirectionalGridSideMode = state.triggers
      .filter(trigger => trigger.status !== 'superseded')
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
      if (risk.status === 'superseded') {
        continue
      }

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

  private hasDeterministicSemantics(
    state: SemanticState,
    recommendationSignals: ReturnType<SemanticStateProjectionService['buildRecommendationSignals']>,
  ): boolean {
    const hasLockedDeterministicAtom = state.triggers.some(trigger => trigger.status !== 'superseded')
      || state.actions.some(action => action.status !== 'superseded')
      || state.risk.some(risk => risk.status !== 'superseded')
      || this.hasValidLockedPosition(state.position)
      || recommendationSignals.hasGridIntent

    return hasLockedDeterministicAtom
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
}
