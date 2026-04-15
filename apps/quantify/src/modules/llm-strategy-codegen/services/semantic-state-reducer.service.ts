import { Injectable } from '@nestjs/common'
import type { SemanticState } from '../types/semantic-state'

@Injectable()
export class SemanticStateReducerService {
  applyClarificationAnswer(input: {
    currentState: SemanticState
    targetSlotKey: string
    answer: string
    messageIndex?: number
  }): SemanticState {
    const nextState: SemanticState = {
      ...input.currentState,
      triggers: input.currentState.triggers.map(trigger => ({
        ...trigger,
        params: { ...trigger.params },
        openSlots: trigger.openSlots.map(slot => ({ ...slot })),
      })),
      actions: input.currentState.actions.map(action => ({
        ...action,
        ...(action.params ? { params: { ...action.params } } : {}),
      })),
      risk: input.currentState.risk.map(risk => ({
        ...risk,
        params: { ...risk.params },
        openSlots: risk.openSlots.map(slot => ({ ...slot })),
      })),
      position: input.currentState.position ? { ...input.currentState.position } : null,
      contextSlots: {
        exchange: input.currentState.contextSlots.exchange ? { ...input.currentState.contextSlots.exchange } : null,
        symbol: input.currentState.contextSlots.symbol ? { ...input.currentState.contextSlots.symbol } : null,
        marketType: input.currentState.contextSlots.marketType ? { ...input.currentState.contextSlots.marketType } : null,
        timeframe: input.currentState.contextSlots.timeframe ? { ...input.currentState.contextSlots.timeframe } : null,
      },
      updatedAt: new Date().toISOString(),
    }

    const answerText = input.answer.trim()
    const periodMatch = answerText.match(/(?:ma|ema|sma)?\s*(\d{1,4})/iu)
    const confirmationIsClose = /收盘|确认|close/u.test(answerText)
    const confirmationIsTouch = /盘中|触发|touch/u.test(answerText)

    for (const trigger of nextState.triggers) {
      const slot = trigger.openSlots.find(item => item.slotKey === input.targetSlotKey)
      if (!slot) continue

      if (slot.slotKey.includes('reference.period') && periodMatch?.[1]) {
        trigger.params['reference.period'] = Number(periodMatch[1])
      }

      if (slot.slotKey.includes('confirmationMode') && (confirmationIsClose || confirmationIsTouch)) {
        trigger.params.confirmationMode = confirmationIsClose ? 'close_confirm' : 'touch'
      }

      if (slot.slotKey.includes('confirmationMode')) {
        slot.value = (trigger.params.confirmationMode as string | undefined) ?? answerText
      }
      else if (slot.slotKey.includes('reference.period') && typeof trigger.params['reference.period'] === 'number') {
        slot.value = trigger.params['reference.period'] as number
      }
      else {
        slot.value = answerText
      }
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }

      trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
    }

    return nextState
  }
}
