import { Injectable } from '@nestjs/common'
import { buildSemanticSlotId } from '../types/semantic-state'
import type { SemanticSlotState, SemanticState } from '../types/semantic-state'

interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode' | 'rangeLower' | 'rangeUpper' | 'stepPct' | 'sideMode'
  paramValue: number | string
  slotValue: number | string
}

@Injectable()
export class SemanticStateReducerService {
  applyClarificationAnswer(input: {
    currentState: SemanticState
    targetSlotKey: string
    targetFieldPath?: string
    targetSlotId?: string
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
      const slot = trigger.openSlots.find((item) => {
        if (input.targetSlotId) {
          return buildSemanticSlotId(item) === input.targetSlotId
        }

        return item.slotKey === input.targetSlotKey && item.fieldPath === input.targetFieldPath
      })
      if (!slot) continue

      const reduction = this.reduceSupportedSlot(slot, answerText)
      if (!reduction) {
        break
      }

      if (reduction.paramKey === 'reference.period') {
        trigger.params['reference.period'] = reduction.paramValue
      } else if (reduction.paramKey === 'confirmationMode') {
        trigger.params.confirmationMode = reduction.paramValue
      } else {
        trigger.params[reduction.paramKey] = reduction.paramValue
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
    const normalizedGridSlotKey = this.normalizeGridSlotKey(slot.slotKey)

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
      const confirmationIsTouch = /盘中|即时|touch/u.test(answerText)
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

    if (normalizedGridSlotKey === 'grid.range.lower' || normalizedGridSlotKey === 'grid.range.upper' || normalizedGridSlotKey === 'grid.stepPct') {
      const value = this.parseGridNumericAnswer(normalizedGridSlotKey, answerText)
      if (value === null) {
        return null
      }

      const paramKey = normalizedGridSlotKey === 'grid.range.lower'
        ? 'rangeLower'
        : (normalizedGridSlotKey === 'grid.range.upper' ? 'rangeUpper' : 'stepPct')

      return {
        paramKey,
        paramValue: value,
        slotValue: value,
      }
    }

    if (normalizedGridSlotKey === 'grid.sideMode') {
      const sideMode = this.parseGridSideModeAnswer(answerText)
      if (!sideMode) {
        return null
      }

      return {
        paramKey: 'sideMode',
        paramValue: sideMode,
        slotValue: sideMode,
      }
    }

    return null
  }

  private normalizeGridSlotKey(slotKey: string): 'grid.range.lower' | 'grid.range.upper' | 'grid.stepPct' | 'grid.sideMode' | null {
    if (slotKey === 'grid.range.lower' || slotKey === 'grid.lower') {
      return 'grid.range.lower'
    }

    if (slotKey === 'grid.range.upper' || slotKey === 'grid.upper') {
      return 'grid.range.upper'
    }

    if (slotKey === 'grid.stepPct') {
      return 'grid.stepPct'
    }

    if (slotKey === 'grid.sideMode') {
      return 'grid.sideMode'
    }

    return null
  }

  private parseGridNumericAnswer(slotKey: string, answerText: string): number | null {
    if (slotKey === 'grid.stepPct') {
      const percentMatch = answerText.match(/(\d+(?:\.\d+)?)\s*%/u)
      if (percentMatch?.[1]) {
        return Number(percentMatch[1])
      }

      const perMilleMatch = answerText.match(/千分之\s*(\d+(?:\.\d+)?)/u)
      if (perMilleMatch?.[1]) {
        return Number(perMilleMatch[1]) / 10
      }
    }

    const numericMatch = answerText.match(/-?\d+(?:\.\d+)?/u)
    if (!numericMatch) {
      return null
    }

    const value = Number(numericMatch[0])
    return Number.isFinite(value) ? value : null
  }

  private parseGridSideModeAnswer(answerText: string): 'long_only' | 'short_only' | 'bidirectional' | null {
    const normalized = answerText.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    if (normalized === 'bidirectional' || /双向|低买高卖|来回|往返|自动买卖|自动交易/u.test(answerText)) {
      return 'bidirectional'
    }

    if (normalized === 'long_only' || /只做多|仅做多/u.test(answerText)) {
      return 'long_only'
    }

    if (normalized === 'short_only' || /只做空|仅做空/u.test(answerText)) {
      return 'short_only'
    }

    return null
  }
}
