import { Injectable } from '@nestjs/common'

import type { SemanticContextSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'

@Injectable()
export class SemanticStateMergeService {
  merge(input: { persisted: SemanticState | null, derived: SemanticState }): SemanticState {
    if (!input.persisted) {
      return input.derived
    }

    return {
      ...input.derived,
      families: [...new Set([...input.persisted.families, ...input.derived.families])],
      triggers: this.mergeTriggers(input.persisted.triggers, input.derived.triggers),
      actions: input.derived.actions.length > 0 ? input.derived.actions : input.persisted.actions,
      risk: input.derived.risk.length > 0 ? input.derived.risk : input.persisted.risk,
      position: input.derived.position ?? input.persisted.position,
      contextSlots: this.mergeContextSlots(input.persisted.contextSlots, input.derived.contextSlots),
      normalizationNotes: [...new Set([...input.persisted.normalizationNotes, ...input.derived.normalizationNotes])],
      updatedAt: new Date().toISOString(),
    }
  }

  private mergeTriggers(
    persisted: SemanticTriggerState[],
    derived: SemanticTriggerState[],
  ): SemanticTriggerState[] {
    const next = derived.map(trigger => ({
      ...trigger,
      params: { ...trigger.params },
      openSlots: trigger.openSlots.map(slot => ({ ...slot })),
    }))

    for (const persistedTrigger of persisted) {
      const matchIndex = next.findIndex(candidate => this.isSameTriggerIdentity(persistedTrigger, candidate))
      if (matchIndex < 0) {
        next.push({
          ...persistedTrigger,
          params: { ...persistedTrigger.params },
          openSlots: persistedTrigger.openSlots.map(slot => ({ ...slot })),
        })
        continue
      }

      const derivedTrigger = next[matchIndex]
      next[matchIndex] = {
        ...derivedTrigger,
        id: persistedTrigger.id,
        params: { ...persistedTrigger.params, ...derivedTrigger.params },
        openSlots: derivedTrigger.openSlots.length > 0 ? derivedTrigger.openSlots : persistedTrigger.openSlots,
        status: derivedTrigger.status === 'locked' || persistedTrigger.status === 'superseded'
          ? derivedTrigger.status
          : persistedTrigger.status,
        evidence: derivedTrigger.evidence ?? persistedTrigger.evidence,
      }
    }

    return next
  }

  private mergeContextSlots(
    persisted: SemanticContextSlotState,
    derived: SemanticContextSlotState,
  ): SemanticContextSlotState {
    return {
      exchange: derived.exchange ?? persisted.exchange,
      symbol: derived.symbol ?? persisted.symbol,
      marketType: derived.marketType ?? persisted.marketType,
      timeframe: derived.timeframe ?? persisted.timeframe,
    }
  }

  private isSameTriggerIdentity(left: SemanticTriggerState, right: SemanticTriggerState): boolean {
    if (left.phase !== right.phase || left.key !== right.key || left.sideScope !== right.sideScope) {
      return false
    }

    const identityKeys = [
      'indicator',
      'referenceRole',
      'reference.period',
      'period',
      'stdDev',
      'value',
      'rangeLower',
      'rangeUpper',
      'stepPct',
      'sideMode',
      'breakoutAction',
    ] as const

    return identityKeys.every((key) => {
      const leftValue = left.params[key]
      const rightValue = right.params[key]
      if (leftValue === undefined || rightValue === undefined) {
        return true
      }
      return leftValue === rightValue
    })
  }
}
