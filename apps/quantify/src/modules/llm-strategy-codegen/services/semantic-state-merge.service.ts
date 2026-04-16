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
      const preferPersisted = this.compareNodeStrength(persistedTrigger, derivedTrigger) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedTrigger : persistedTrigger),
        ...(preferPersisted ? persistedTrigger : derivedTrigger),
        id: persistedTrigger.id,
        sideScope: persistedTrigger.sideScope ?? derivedTrigger.sideScope,
        params: preferPersisted
          ? { ...derivedTrigger.params, ...persistedTrigger.params }
          : { ...persistedTrigger.params, ...derivedTrigger.params },
        openSlots: this.mergeOpenSlots(persistedTrigger.openSlots, derivedTrigger.openSlots),
        status: derivedTrigger.status === 'locked' || persistedTrigger.status === 'superseded'
          ? derivedTrigger.status
          : persistedTrigger.status,
        evidence: preferPersisted
          ? persistedTrigger.evidence ?? derivedTrigger.evidence
          : derivedTrigger.evidence ?? persistedTrigger.evidence,
      }
    }

    return next
  }

  private mergeContextSlots(
    persisted: SemanticContextSlotState,
    derived: SemanticContextSlotState,
  ): SemanticContextSlotState {
    return {
      exchange: this.mergeSlotState(persisted.exchange, derived.exchange),
      symbol: this.mergeSlotState(persisted.symbol, derived.symbol),
      marketType: this.mergeSlotState(persisted.marketType, derived.marketType),
      timeframe: this.mergeSlotState(persisted.timeframe, derived.timeframe),
    }
  }

  private isSameTriggerIdentity(left: SemanticTriggerState, right: SemanticTriggerState): boolean {
    if (left.phase !== right.phase || left.key !== right.key) {
      return false
    }

    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
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

  private mergeOpenSlots(
    persisted: SemanticTriggerState['openSlots'],
    derived: SemanticTriggerState['openSlots'],
  ): SemanticTriggerState['openSlots'] {
    const next = derived.map(slot => ({ ...slot }))

    for (const persistedSlot of persisted) {
      const matchIndex = next.findIndex(slot =>
        slot.slotKey === persistedSlot.slotKey && slot.fieldPath === persistedSlot.fieldPath)
      if (matchIndex < 0) {
        next.push({ ...persistedSlot })
        continue
      }

      next[matchIndex] = this.mergeSlotState(persistedSlot, next[matchIndex])!
    }

    return next
  }

  private mergeSlotState<T extends SemanticContextSlotState[keyof SemanticContextSlotState]>(
    persisted: T,
    derived: T,
  ): T {
    if (!persisted) {
      return derived
    }

    if (!derived) {
      return persisted
    }

    const preferPersisted = this.compareNodeStrength(persisted, derived) > 0
    const stronger = preferPersisted ? persisted : derived
    const weaker = preferPersisted ? derived : persisted

    return {
      ...weaker,
      ...stronger,
      value: 'value' in stronger && stronger.value !== undefined
        ? stronger.value
        : 'value' in weaker
          ? weaker.value
          : undefined,
      evidence: stronger.evidence ?? weaker.evidence,
    } as T
  }

  private compareNodeStrength(
    left: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    right: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
  ): number {
    const statusDiff = this.getStatusRank(left.status) - this.getStatusRank(right.status)
    if (statusDiff !== 0) {
      return statusDiff
    }

    const sourceDiff = this.getSourceRank(left.source) - this.getSourceRank(right.source)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    return Number(left.value !== undefined) - Number(right.value !== undefined)
  }

  private getStatusRank(status: 'open' | 'locked' | 'superseded'): number {
    switch (status) {
      case 'locked':
        return 2
      case 'open':
        return 1
      case 'superseded':
      default:
        return 0
    }
  }

  private getSourceRank(source?: 'user_explicit' | 'inferred' | 'derived'): number {
    switch (source) {
      case 'user_explicit':
        return 2
      case 'inferred':
        return 1
      case 'derived':
      default:
        return 0
    }
  }
}
