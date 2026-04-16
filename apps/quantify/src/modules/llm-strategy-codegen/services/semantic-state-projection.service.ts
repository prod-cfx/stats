import { Injectable } from '@nestjs/common'
import type { SemanticSlotState, SemanticState } from '../types/semantic-state'

@Injectable()
export class SemanticStateProjectionService {
  buildClarificationView(state: SemanticState): {
    summary: string
    nextQuestion: string | null
  } {
    const triggerSummary = state.triggers
      .map((trigger) => {
        if (trigger.key === 'indicator.above' && trigger.params['reference.period']) {
          return `入场：突破 MA${trigger.params['reference.period']}`
        }

        if (trigger.key === 'indicator.below' && trigger.params['reference.period']) {
          return `出场：跌破 MA${trigger.params['reference.period']}`
        }

        return trigger.key
      })
      .join('；')

    const nextSlot = this.findNextOpenSlot(state)

    return {
      summary: triggerSummary || '已识别部分条件，但仍未完整。',
      nextQuestion: nextSlot?.questionHint ?? null,
    }
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

    const riskSlot = state.risk
      .flatMap(risk => risk.openSlots)
      .find(slot => slot.status === 'open')
    if (riskSlot) {
      return riskSlot
    }

    return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
  }
}
