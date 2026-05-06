import { Injectable } from '@nestjs/common'

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticContextSlotState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { normalizeRiskSemantics } from './semantic-state-normalization'

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
    if (derived.length === 0) {
      return persisted.map(trigger => ({
        ...trigger,
        params: { ...trigger.params },
        openSlots: trigger.openSlots.map(slot => ({ ...slot })),
      }))
    }

    const next = derived.map(trigger => ({
      ...trigger,
      params: { ...trigger.params },
      openSlots: trigger.openSlots.map(slot => ({ ...slot })),
    }))
    const originalDerivedCount = next.length
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedTrigger of persisted) {
      const matchIndex = this.findBestTriggerMatchIndex(
        persistedTrigger,
        next,
        consumedDerivedIndexes,
        originalDerivedCount,
      )
      if (matchIndex < 0) {
        next.push({
          ...persistedTrigger,
          params: { ...persistedTrigger.params },
          openSlots: persistedTrigger.openSlots.map(slot => ({ ...slot })),
        })
        continue
      }

      const derivedTrigger = next[matchIndex]
      consumedDerivedIndexes.add(matchIndex)
      const preferPersisted = this.compareNodeStrength(persistedTrigger, derivedTrigger) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedTrigger : persistedTrigger),
        ...(preferPersisted ? persistedTrigger : derivedTrigger),
        id: persistedTrigger.id,
        sideScope: persistedTrigger.sideScope ?? derivedTrigger.sideScope,
        params: preferPersisted
          ? { ...derivedTrigger.params, ...persistedTrigger.params }
          : { ...persistedTrigger.params, ...derivedTrigger.params },
        contracts: this.mergeContracts(persistedTrigger.contracts, derivedTrigger.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedTrigger,
          derivedTrigger,
          persistedTrigger.openSlots,
          derivedTrigger.openSlots,
        ),
        status: derivedTrigger.status === 'locked' || persistedTrigger.status === 'superseded'
          ? derivedTrigger.status
          : persistedTrigger.status,
        evidence: preferPersisted
          ? persistedTrigger.evidence ?? derivedTrigger.evidence
          : derivedTrigger.evidence ?? persistedTrigger.evidence,
      }
    }

    return this.coalesceEquivalentTriggers(next)
  }

  private findBestTriggerMatchIndex(
    persistedTrigger: SemanticTriggerState,
    derivedTriggers: SemanticTriggerState[],
    consumedDerivedIndexes: Set<number>,
    searchLimit: number = derivedTriggers.length,
  ): number {
    let bestIndex = -1
    let bestScore = -1

    for (const [index, candidate] of derivedTriggers.entries()) {
      if (index >= searchLimit) {
        break
      }
      if (consumedDerivedIndexes.has(index) || !this.isSameTriggerIdentity(persistedTrigger, candidate)) {
        continue
      }

      const score = this.scoreTriggerMatch(persistedTrigger, candidate)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }

    return bestIndex
  }

  private mergeActions(
    persisted: SemanticActionState[],
    derived: SemanticActionState[],
  ): SemanticActionState[] {
    const next = derived.map(action => ({
      ...action,
      params: action.params ? { ...action.params } : undefined,
      openSlots: (action.openSlots ?? []).map(slot => ({ ...slot })),
    }))
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedAction of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameActionIdentity(persistedAction, candidate))
      if (matchIndex < 0) {
        next.push({
          ...persistedAction,
          params: persistedAction.params ? { ...persistedAction.params } : undefined,
          openSlots: (persistedAction.openSlots ?? []).map(slot => ({ ...slot })),
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
        contracts: this.mergeContracts(persistedAction.contracts, derivedAction.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedAction,
          derivedAction,
          persistedAction.openSlots ?? [],
          derivedAction.openSlots ?? [],
        ),
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
        contracts: this.mergeContracts(persistedRisk.contracts, derivedRisk.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedRisk,
          derivedRisk,
          persistedRisk.openSlots,
          derivedRisk.openSlots,
        ),
        evidence: preferPersisted
          ? persistedRisk.evidence ?? derivedRisk.evidence
          : derivedRisk.evidence ?? persistedRisk.evidence,
      }
    }

    return normalizeRiskSemantics(next)
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
      contracts: this.mergeContracts(persisted.contracts, derived.contracts),
      evidence: stronger.evidence ?? weaker.evidence,
    }
  }

  private mergeContracts(
    persisted: SemanticAtomContract[] | undefined,
    derived: SemanticAtomContract[] | undefined,
  ): SemanticAtomContract[] | undefined {
    const next: SemanticAtomContract[] = []
    for (const contract of [...(persisted ?? []), ...(derived ?? [])]) {
      const matchIndex = next.findIndex(candidate => this.isSameContractIdentity(candidate, contract))
      if (matchIndex < 0) {
        next.push(this.cloneContract(contract))
        continue
      }

      next[matchIndex] = this.mergeContract(next[matchIndex]!, contract)
    }

    return next.length > 0 ? next : undefined
  }

  private isSameContractIdentity(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): boolean {
    if (left.id === right.id) {
      return true
    }
    if (left.kind !== right.kind) {
      return false
    }

    const leftSemanticKeys = this.collectContractSemanticKeys(left)
    const rightSemanticKeys = this.collectContractSemanticKeys(right)
    return [...leftSemanticKeys].some(key => rightSemanticKeys.has(key))
  }

  private mergeContract(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): SemanticAtomContract {
    return {
      ...left,
      ...right,
      capabilities: this.mergeContractCapabilities(left.capabilities, right.capabilities),
      requires: this.mergeContractRequirements(left.requires, right.requires),
      effects: this.mergeContractEffects(left.effects, right.effects),
      params: {
        ...left.params,
        ...right.params,
      },
    }
  }

  private collectContractSemanticKeys(contract: SemanticAtomContract): Set<string> {
    return new Set([
      ...contract.capabilities.map(capability => this.semanticTupleKey(capability)),
      ...contract.requires.map(requirement => this.semanticTupleKey(requirement)),
      ...(contract.effects ?? []).map(effect => this.semanticTupleKey(effect)),
    ])
  }

  private semanticTupleKey(tuple: { domain: string, verb: string, object: string }): string {
    return `${tuple.domain}:${tuple.verb}:${tuple.object}`
  }

  private mergeContractCapabilities(
    left: SemanticAtomContract['capabilities'],
    right: SemanticAtomContract['capabilities'],
  ): SemanticAtomContract['capabilities'] {
    const next: Array<SemanticAtomContract['capabilities'][number]> = []
    for (const capability of [...left, ...right]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === capability.domain
        && candidate.verb === capability.verb
        && candidate.object === capability.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...capability,
          shape: { ...capability.shape },
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...capability,
        shape: {
          ...next[matchIndex]!.shape,
          ...capability.shape,
        },
      }
    }
    return next
  }

  private mergeContractRequirements(
    left: SemanticAtomContract['requires'],
    right: SemanticAtomContract['requires'],
  ): SemanticAtomContract['requires'] {
    const next: Array<SemanticAtomContract['requires'][number]> = []
    for (const requirement of [...left, ...right]) {
      if (next.some(candidate =>
        candidate.domain === requirement.domain
        && candidate.verb === requirement.verb
        && candidate.object === requirement.object,
      )) {
        continue
      }
      next.push({ ...requirement })
    }
    return next
  }

  private mergeContractEffects(
    left: SemanticAtomContract['effects'],
    right: SemanticAtomContract['effects'],
  ): SemanticAtomContract['effects'] {
    const next: Array<NonNullable<SemanticAtomContract['effects']>[number]> = []
    for (const effect of [...(left ?? []), ...(right ?? [])]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === effect.domain
        && candidate.verb === effect.verb
        && candidate.object === effect.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...effect,
          shape: effect.shape ? { ...effect.shape } : undefined,
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...effect,
        shape: {
          ...next[matchIndex]!.shape,
          ...effect.shape,
        },
      }
    }
    return next.length > 0 ? next : undefined
  }

  private cloneContract(contract: SemanticAtomContract): SemanticAtomContract {
    return {
      ...contract,
      capabilities: contract.capabilities.map(capability => ({
        ...capability,
        shape: capability.shape ? { ...capability.shape } : undefined,
      })),
      requires: contract.requires.map(requirement => ({ ...requirement })),
      effects: contract.effects?.map(effect => ({
        ...effect,
        shape: effect.shape ? { ...effect.shape } : undefined,
      })),
      params: { ...contract.params },
    }
  }

  private mergeOpenSlotsForMatchedNodes(
    persistedNode: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    derivedNode: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    persistedSlots: SemanticTriggerState['openSlots'],
    derivedSlots: SemanticTriggerState['openSlots'],
  ): SemanticTriggerState['openSlots'] {
    if (
      persistedNode.status === 'locked'
      && derivedNode.status === 'open'
      && this.compareNodeStrength(persistedNode, derivedNode) > 0
    ) {
      return persistedSlots.map(slot => ({ ...slot }))
    }

    return this.mergeOpenSlots(persistedSlots, derivedSlots)
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

    const stableIdentityKeys = [
      'indicator',
      'referenceRole',
      'basis',
    ] as const

    return this.haveCompatibleParamValues(left.params, right.params, stableIdentityKeys)
  }

  private coalesceEquivalentTriggers(
    triggers: SemanticTriggerState[],
  ): SemanticTriggerState[] {
    const next: SemanticTriggerState[] = []

    for (const trigger of triggers) {
      const matchIndex = next.findIndex(candidate => this.isEquivalentTriggerForCoalescing(candidate, trigger))
      if (matchIndex < 0) {
        next.push(trigger)
        continue
      }

      next[matchIndex] = this.mergeEquivalentTrigger(next[matchIndex]!, trigger)
    }

    return next
  }

  private isEquivalentTriggerForCoalescing(
    left: SemanticTriggerState,
    right: SemanticTriggerState,
  ): boolean {
    if (this.isEquivalentBollingerBoundaryTrigger(left, right)) {
      return true
    }

    if (
      left.id !== right.id
      && left.source === 'user_explicit'
      && right.source === 'user_explicit'
    ) {
      return false
    }

    if (left.phase !== right.phase || left.key !== right.key) {
      return false
    }

    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
      return false
    }

    return this.haveCompatibleParamValues(
      this.omitTriggerConfirmationParam(left.params),
      this.omitTriggerConfirmationParam(right.params),
    )
  }

  private mergeEquivalentTrigger(
    existing: SemanticTriggerState,
    incoming: SemanticTriggerState,
  ): SemanticTriggerState {
    const preferIncoming = this.compareNodeStrength(incoming, existing) > 0
    const stronger = preferIncoming ? incoming : existing
    const weaker = preferIncoming ? existing : incoming
    const confirmationMode = this.resolvePreferredConfirmationMode(
      stronger.params.confirmationMode,
      weaker.params.confirmationMode,
    )

    return {
      ...weaker,
      ...stronger,
      id: stronger.id,
      sideScope: stronger.sideScope ?? weaker.sideScope,
      params: {
        ...weaker.params,
        ...stronger.params,
        ...(confirmationMode ? { confirmationMode } : {}),
      },
      contracts: this.mergeContracts(existing.contracts, incoming.contracts),
      openSlots: this.mergeOpenSlots(existing.openSlots, incoming.openSlots),
      evidence: stronger.evidence ?? weaker.evidence,
    }
  }

  private isEquivalentBollingerBoundaryTrigger(
    left: SemanticTriggerState,
    right: SemanticTriggerState,
  ): boolean {
    if (left.phase !== right.phase) {
      return false
    }
    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
      return false
    }

    const leftBoundary = this.readBollingerBoundaryIdentity(left)
    const rightBoundary = this.readBollingerBoundaryIdentity(right)
    if (!leftBoundary || !rightBoundary) {
      return false
    }

    return leftBoundary.role === rightBoundary.role
      && this.sameOptionalNumber(leftBoundary.period, rightBoundary.period)
      && this.sameOptionalNumber(leftBoundary.stdDev, rightBoundary.stdDev)
  }

  private readBollingerBoundaryIdentity(
    trigger: SemanticTriggerState,
  ): { role: string, period: number | null, stdDev: number | null } | null {
    if (
      trigger.key === 'bollinger.touch_upper'
      || trigger.key === 'bollinger.touch_lower'
      || trigger.key === 'bollinger.touch_middle'
    ) {
      return {
        role: trigger.key === 'bollinger.touch_upper'
          ? 'upper'
          : trigger.key === 'bollinger.touch_lower'
            ? 'lower'
            : 'middle',
        period: this.readFiniteNumber(trigger.params.period),
        stdDev: this.readFiniteNumber(trigger.params.stdDev),
      }
    }

    if (trigger.key !== 'price.detect.indicator_boundary') {
      return null
    }

    const indicator = trigger.params.indicator
    if (!indicator || typeof indicator !== 'object' || Array.isArray(indicator)) {
      return null
    }
    const indicatorRecord = indicator as Record<string, unknown>
    if (indicatorRecord.name !== 'bollinger') {
      return null
    }

    const role = typeof trigger.params.boundaryRole === 'string' ? trigger.params.boundaryRole : null
    if (role !== 'upper' && role !== 'lower' && role !== 'middle') {
      return null
    }

    return {
      role,
      period: this.readFiniteNumber(indicatorRecord.period),
      stdDev: this.readFiniteNumber(indicatorRecord.stdDev),
    }
  }

  private sameOptionalNumber(left: number | null, right: number | null): boolean {
    return left === null || right === null || left === right
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private omitTriggerConfirmationParam(params: Record<string, unknown>): Record<string, unknown> {
    const { confirmationMode: _confirmationMode, ...rest } = params
    return rest
  }

  private resolvePreferredConfirmationMode(
    left: unknown,
    right: unknown,
  ): string | null {
    const rank = (value: unknown): number => {
      if (value === 'close_confirm') return 3
      if (value === 'touch') return 2
      if (value === 'ambiguous_touch_or_close_confirm') return 1
      return 0
    }

    if (rank(left) >= rank(right)) {
      return typeof left === 'string' && left ? left : null
    }
    return typeof right === 'string' && right ? right : null
  }

  private scoreTriggerMatch(left: SemanticTriggerState, right: SemanticTriggerState): number {
    let score = 0

    if (left.sideScope && right.sideScope && left.sideScope === right.sideScope) {
      score += 5
    }

    const candidateKeys = new Set([
      ...Object.keys(left.params),
      ...Object.keys(right.params),
    ])
    for (const key of candidateKeys) {
      if (left.params[key] !== undefined && left.params[key] === right.params[key]) {
        score += 1
      }
    }

    const leftSlotKeys = new Set(left.openSlots.map(slot => slot.slotKey))
    for (const slot of right.openSlots) {
      if (leftSlotKeys.has(slot.slotKey)) {
        score += 3
      }
    }

    return score
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
