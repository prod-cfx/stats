import { Injectable } from '@nestjs/common'
import type { SemanticSlotState, SemanticState } from '../types/semantic-state'

interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode'
  paramValue: number | string
  slotValue: number | string
}

@Injectable()
export class SemanticStateReducerService {
  applyClarificationAnswer(input: {
    currentState: SemanticState
    targetSlotKey: string
    targetFieldPath: string
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
    for (const trigger of nextState.triggers) {
      const slot = trigger.openSlots.find(item => item.slotKey === input.targetSlotKey && item.fieldPath === input.targetFieldPath)
      if (!slot) continue

      const reduction = this.reduceSupportedSlot(slot, answerText)
      if (!reduction) {
        break
      }

      if (reduction.paramKey === 'reference.period') {
        trigger.params['reference.period'] = reduction.paramValue
      }
      else {
        trigger.params.confirmationMode = reduction.paramValue
      }

      slot.value = reduction.slotValue
      slot.status = 'locked'
      slot.evidence = {
        text: answerText,
        messageIndex: input.messageIndex,
        source: 'user_explicit',
      }

      trigger.status = trigger.openSlots.every(item => item.status !== 'open') ? 'locked' : 'open'
      break
    }

    return nextState
  }

  private reduceSupportedSlot(slot: SemanticSlotState, answerText: string): SupportedSlotReduction | null {
    if (slot.slotKey.includes('reference.period')) {
      const periodMatch = answerText.match(/(?:ma|ema|sma)?\s*(\d{1,4})/iu)
      if (!periodMatch?.[1]) {
        return null
      }

      const period = Number(periodMatch[1])
      return {
        paramKey: 'reference.period',
        paramValue: period,
        slotValue: period,
      }
    }

    if (slot.slotKey.includes('confirmationMode')) {
      const confirmationIsClose = /收盘|确认|close/u.test(answerText)
      const confirmationIsTouch = /盘中|触发|touch/u.test(answerText)
      if (confirmationIsClose === confirmationIsTouch) {
        return null
      }

      const confirmationMode = confirmationIsClose ? 'close_confirm' : 'touch'
      return {
        paramKey: 'confirmationMode',
        paramValue: confirmationMode,
        slotValue: confirmationMode,
      }
    }

    return null
  }
}
