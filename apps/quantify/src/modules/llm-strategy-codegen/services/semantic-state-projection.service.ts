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
    const triggerSlots = state.triggers.flatMap(trigger => trigger.openSlots)
    const supportedTriggerSlot = triggerSlots.find(slot => slot.status === 'open' && this.isReducerSupportedSlot(slot))
    if (supportedTriggerSlot) {
      return supportedTriggerSlot
    }

    const firstBlockingTriggerSlot = triggerSlots.find(slot => slot.status === 'open')
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

  private isReducerSupportedSlot(slot: SemanticSlotState): boolean {
    return slot.slotKey.includes('reference.period') || slot.slotKey.includes('confirmationMode')
  }
}
