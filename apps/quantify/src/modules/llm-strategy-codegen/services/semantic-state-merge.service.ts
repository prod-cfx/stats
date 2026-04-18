import { Injectable } from '@nestjs/common'

import type {
  SemanticActionState,
  SemanticContextSlotState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'

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
      actions: this.mergeActions(input.persisted.actions, input.derived.actions),
      risk: this.mergeRisk(input.persisted.risk, input.derived.risk),
      position: this.mergePosition(input.persisted.position, input.derived.position),
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
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedTrigger of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameTriggerIdentity(persistedTrigger, candidate))
      const replacementIndex = matchIndex >= 0
        ? matchIndex
        : this.findReplacementTriggerIndex(persistedTrigger, next, consumedDerivedIndexes)
      if (replacementIndex < 0) {
        next.push({
          ...persistedTrigger,
          params: { ...persistedTrigger.params },
          openSlots: persistedTrigger.openSlots.map(slot => ({ ...slot })),
        })
        continue
      }

      const derivedTrigger = next[replacementIndex]
      consumedDerivedIndexes.add(replacementIndex)
      const preferPersisted = this.compareNodeStrength(persistedTrigger, derivedTrigger) > 0
      const strongerTrigger = preferPersisted ? persistedTrigger : derivedTrigger
      next[replacementIndex] = {
        ...(preferPersisted ? derivedTrigger : persistedTrigger),
        ...(preferPersisted ? persistedTrigger : derivedTrigger),
        id: persistedTrigger.id,
        sideScope: persistedTrigger.sideScope ?? derivedTrigger.sideScope,
        params: preferPersisted
          ? { ...derivedTrigger.params, ...persistedTrigger.params }
          : { ...persistedTrigger.params, ...derivedTrigger.params },
        openSlots: this.shouldPreserveClosedSlots(strongerTrigger)
          ? strongerTrigger.openSlots.map(slot => ({ ...slot }))
          : this.mergeOpenSlots(persistedTrigger.openSlots, derivedTrigger.openSlots),
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

  private findReplacementTriggerIndex(
    persistedTrigger: SemanticTriggerState,
    derived: SemanticTriggerState[],
    consumedDerivedIndexes: Set<number>,
  ): number {
    const candidates = derived
      .map((trigger, index) => ({ trigger, index }))
      .filter(({ trigger, index }) =>
        !consumedDerivedIndexes.has(index)
        && this.isSameTriggerReplacementFamily(persistedTrigger, trigger))

    if (candidates.length !== 1) {
      return -1
    }

    const persistedGroupSize = this.countTriggerReplacementFamily(persistedTrigger, derived)
    if (persistedGroupSize > 1) {
      return -1
    }

    return candidates[0]?.index ?? -1
  }

  private mergeActions(
    persisted: SemanticActionState[],
    derived: SemanticActionState[],
  ): SemanticActionState[] {
    const next = derived.map(action => ({
      ...action,
      params: action.params ? { ...action.params } : undefined,
    }))
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedAction of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameActionIdentity(persistedAction, candidate))
      if (matchIndex < 0) {
        next.push({
          ...persistedAction,
          params: persistedAction.params ? { ...persistedAction.params } : undefined,
        })
        continue
      }

      consumedDerivedIndexes.add(matchIndex)
      const derivedAction = next[matchIndex]
      const preferPersisted = this.compareNodeStrength(persistedAction, derivedAction) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedAction : persistedAction),
        ...(preferPersisted ? persistedAction : derivedAction),
        id: persistedAction.id,
        params: preferPersisted
          ? { ...derivedAction.params, ...persistedAction.params }
          : { ...persistedAction.params, ...derivedAction.params },
        evidence: preferPersisted
          ? persistedAction.evidence ?? derivedAction.evidence
          : derivedAction.evidence ?? persistedAction.evidence,
      }
    }

    return next
  }

  private mergeRisk(
    persisted: SemanticRiskState[],
    derived: SemanticRiskState[],
  ): SemanticRiskState[] {
    const next = derived.map(risk => ({
      ...risk,
      params: { ...risk.params },
      openSlots: risk.openSlots.map(slot => ({ ...slot })),
    }))
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedRisk of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameRiskIdentity(persistedRisk, candidate))
      if (matchIndex < 0) {
        next.push({
          ...persistedRisk,
          params: { ...persistedRisk.params },
          openSlots: persistedRisk.openSlots.map(slot => ({ ...slot })),
        })
        continue
      }

      consumedDerivedIndexes.add(matchIndex)
      const derivedRisk = next[matchIndex]
      const preferPersisted = this.compareNodeStrength(persistedRisk, derivedRisk) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedRisk : persistedRisk),
        ...(preferPersisted ? persistedRisk : derivedRisk),
        id: persistedRisk.id,
        params: preferPersisted
          ? { ...derivedRisk.params, ...persistedRisk.params }
          : { ...persistedRisk.params, ...derivedRisk.params },
        openSlots: this.mergeOpenSlots(persistedRisk.openSlots, derivedRisk.openSlots),
        evidence: preferPersisted
          ? persistedRisk.evidence ?? derivedRisk.evidence
          : derivedRisk.evidence ?? persistedRisk.evidence,
      }
    }

    return next
  }

  private mergePosition(
    persisted: SemanticPositionState | null,
    derived: SemanticPositionState | null,
  ): SemanticPositionState | null {
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
      value: stronger.value ?? weaker.value,
      evidence: stronger.evidence ?? weaker.evidence,
    }
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

    return this.haveCompatibleParamValues(left.params, right.params, identityKeys)
  }

  private isSameTriggerReplacementFamily(
    left: SemanticTriggerState,
    right: SemanticTriggerState,
  ): boolean {
    if (left.phase !== right.phase || left.key !== right.key) {
      return false
    }

    return !left.sideScope || !right.sideScope || left.sideScope === right.sideScope
  }

  private countTriggerReplacementFamily(
    target: SemanticTriggerState,
    triggers: SemanticTriggerState[],
  ): number {
    return triggers.filter(trigger => this.isSameTriggerReplacementFamily(target, trigger)).length
  }

  private isSameActionIdentity(left: SemanticActionState, right: SemanticActionState): boolean {
    if (left.key !== right.key) {
      return false
    }

    return this.haveCompatibleParamValues(left.params ?? {}, right.params ?? {})
  }

  private isSameRiskIdentity(left: SemanticRiskState, right: SemanticRiskState): boolean {
    if (left.key !== right.key) {
      return false
    }

    return this.haveCompatibleParamValues(left.params, right.params)
  }

  private haveCompatibleParamValues(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    keys?: readonly string[],
  ): boolean {
    const identityKeys = keys ?? [...new Set([...Object.keys(left), ...Object.keys(right)])]

    return identityKeys.every((key) => {
      const leftValue = left[key]
      const rightValue = right[key]
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

  private shouldPreserveClosedSlots(
    trigger: Pick<SemanticTriggerState, 'status' | 'openSlots'>,
  ): boolean {
    return trigger.status === 'locked' && trigger.openSlots.every(slot => slot.status !== 'open')
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
