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
    return state.triggers
      .flatMap(trigger => trigger.openSlots)
      .find(slot => slot.status === 'open' && this.isReducerSupportedSlot(slot)) ?? null
  }

  private isReducerSupportedSlot(slot: SemanticSlotState): boolean {
    return slot.slotKey.includes('reference.period') || slot.slotKey.includes('confirmationMode')
  }
}
