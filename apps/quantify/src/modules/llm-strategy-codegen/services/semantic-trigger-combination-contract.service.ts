import { Injectable } from '@nestjs/common'

import type { SemanticAtomContract, SemanticTriggerState } from '../types/semantic-state'
import { isTriggerPredicateGroupContract } from './semantic-state-normalization'

export type SemanticTriggerCombinationJoin = 'AND' | 'OR'
export type SemanticTriggerCombinationPhase = SemanticTriggerState['phase']
export type SemanticTriggerCombinationSideScope = NonNullable<SemanticTriggerState['sideScope']>

export interface SemanticTriggerCombinationDescriptor {
  groupId: string
  join: SemanticTriggerCombinationJoin
  phase: SemanticTriggerCombinationPhase
  sideScope: SemanticTriggerCombinationSideScope
  actionKey: string
  actionBinding: string
  members: SemanticTriggerState[]
  rolesByTriggerId?: Record<string, string>
}

interface TriggerCombinationContractParams {
  groupId: string
  join: SemanticTriggerCombinationJoin
  phase: SemanticTriggerCombinationPhase
  sideScope: SemanticTriggerCombinationSideScope
  actionKey: string
  actionBinding: string
  role?: string
}

@Injectable()
export class SemanticTriggerCombinationContractService {
  resolveExecutableGroups(triggers: SemanticTriggerState[]): SemanticTriggerCombinationDescriptor[] {
    const groups = new Map<string, SemanticTriggerCombinationDescriptor>()

    for (const trigger of triggers) {
      const contractParams = this.resolveTriggerContractParams(trigger)

      for (const params of contractParams.length ? contractParams : [this.resolveImplicitSingletonParams(trigger)]) {
        const existing = groups.get(params.groupId)

        if (!existing) {
          const nextGroup: SemanticTriggerCombinationDescriptor = {
            groupId: params.groupId,
            join: params.join,
            phase: params.phase,
            sideScope: params.sideScope,
            actionKey: params.actionKey,
            actionBinding: params.actionBinding,
            members: [trigger],
          }
          this.assignRole(nextGroup, trigger, params)
          groups.set(params.groupId, nextGroup)
          continue
        }

        this.assertGroupCompatible(existing, params)
        existing.members.push(trigger)
        this.assignRole(existing, trigger, params)
      }
    }

    return Array.from(groups.values())
  }

  private resolveTriggerContractParams(trigger: SemanticTriggerState): TriggerCombinationContractParams[] {
    const explicitContracts = (trigger.contracts ?? [])
      .filter(contract => this.isTriggerCombinationContract(contract))
      .map(contract => this.resolveContractParams(trigger, contract.params))

    if (explicitContracts.length) return explicitContracts

    const fallback = this.resolveLegacyFallbackParams(trigger)
    return fallback ? [fallback] : []
  }

  private isTriggerCombinationContract(contract: SemanticAtomContract): boolean {
    const runtimeKind = (contract as { kind?: unknown }).kind
    return isTriggerPredicateGroupContract(contract)
      || (
        contract.capabilities.length === 0
        && this.hasStringParam(contract.params, 'groupId')
        && (runtimeKind === 'trigger' || runtimeKind === undefined)
      )
  }

  private resolveContractParams(
    trigger: SemanticTriggerState,
    rawParams: Record<string, unknown>,
  ): TriggerCombinationContractParams {
    const groupId = this.readString(rawParams.groupId)
    if (!groupId) {
      throw new Error(`Invalid trigger combination contract: missing groupId for trigger ${trigger.id}`)
    }

    const phase = this.readExplicitPhase(trigger, groupId, rawParams) ?? trigger.phase
    const sideScope = this.readExplicitSideScope(trigger, groupId, rawParams) ?? trigger.sideScope ?? 'long'
    const actionKey = this.readString(rawParams.actionKey) ?? this.defaultActionKey(phase, sideScope)

    return {
      groupId,
      join: this.readExplicitJoin(trigger, groupId, rawParams) ?? 'AND',
      phase,
      sideScope,
      actionKey,
      actionBinding: this.readString(rawParams.actionBinding) ?? 'single_action',
      role: this.readString(rawParams.role),
    }
  }

  private resolveImplicitSingletonParams(trigger: SemanticTriggerState): TriggerCombinationContractParams {
    const phase = trigger.phase
    const sideScope = trigger.sideScope ?? 'long'
    const actionKey = this.defaultActionKey(phase, sideScope)

    return {
      groupId: `implicit:${phase}:${sideScope}:${actionKey}:${trigger.id}`,
      join: 'AND',
      phase,
      sideScope,
      actionKey,
      actionBinding: 'single_action',
    }
  }

  private resolveLegacyFallbackParams(trigger: SemanticTriggerState): TriggerCombinationContractParams | null {
    const groupId = this.readFirstString(trigger.params, [
      'groupId',
      'semanticGroupId',
      'logicalGroupId',
      'combinationId',
      'atomicCombinationId',
    ])
    if (!groupId) return null

    const phase = trigger.phase
    const sideScope = trigger.sideScope ?? 'long'
    const actionKey = this.defaultActionKey(phase, sideScope)

    return {
      groupId,
      join: this.readFirstJoin(trigger.params, ['join', 'logic', 'operator', 'conditionOperator']) ?? 'AND',
      phase,
      sideScope,
      actionKey,
      actionBinding: 'single_action',
    }
  }

  private assignRole(
    group: SemanticTriggerCombinationDescriptor,
    trigger: SemanticTriggerState,
    params: TriggerCombinationContractParams,
  ): void {
    if (!params.role) return

    group.rolesByTriggerId = {
      ...group.rolesByTriggerId,
      [trigger.id]: params.role,
    }
  }

  private assertGroupCompatible(
    group: SemanticTriggerCombinationDescriptor,
    params: TriggerCombinationContractParams,
  ): void {
    this.assertSameField(group, params, 'join')
    this.assertSameField(group, params, 'actionKey')
    this.assertSameField(group, params, 'actionBinding')
    this.assertSameField(group, params, 'phase')
    this.assertSameField(group, params, 'sideScope')
  }

  private assertSameField(
    group: SemanticTriggerCombinationDescriptor,
    params: TriggerCombinationContractParams,
    field: 'join' | 'actionKey' | 'actionBinding' | 'phase' | 'sideScope',
  ): void {
    if (group[field] !== params[field]) {
      throw new Error(`Conflicting trigger combination contract for group ${group.groupId}: ${field}`)
    }
  }

  private defaultActionKey(
    phase: SemanticTriggerCombinationPhase,
    sideScope: SemanticTriggerCombinationSideScope,
  ): string {
    const side = sideScope === 'short' ? 'short' : 'long'
    return phase === 'exit' ? `close_${side}` : `open_${side}`
  }

  private readFirstString(params: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = this.readString(params[key])
      if (value) return value
    }

    return undefined
  }

  private readFirstJoin(
    params: Record<string, unknown>,
    keys: readonly string[],
  ): SemanticTriggerCombinationJoin | undefined {
    for (const key of keys) {
      const value = this.readJoin(params[key])
      if (value) return value
    }

    return undefined
  }

  private readExplicitJoin(
    trigger: SemanticTriggerState,
    groupId: string,
    params: Record<string, unknown>,
  ): SemanticTriggerCombinationJoin | undefined {
    return this.readExplicitEnumField(trigger, groupId, params, 'join', value => this.readJoin(value))
  }

  private readExplicitPhase(
    trigger: SemanticTriggerState,
    groupId: string,
    params: Record<string, unknown>,
  ): SemanticTriggerCombinationPhase | undefined {
    return this.readExplicitEnumField(trigger, groupId, params, 'phase', value => this.readPhase(value))
  }

  private readExplicitSideScope(
    trigger: SemanticTriggerState,
    groupId: string,
    params: Record<string, unknown>,
  ): SemanticTriggerCombinationSideScope | undefined {
    return this.readExplicitEnumField(trigger, groupId, params, 'sideScope', value => this.readSideScope(value))
  }

  private readExplicitEnumField<T>(
    trigger: SemanticTriggerState,
    groupId: string,
    params: Record<string, unknown>,
    field: 'join' | 'phase' | 'sideScope',
    parse: (value: unknown) => T | undefined,
  ): T | undefined {
    if (!Object.prototype.hasOwnProperty.call(params, field)) return undefined

    const parsed = parse(params[field])
    if (parsed !== undefined) return parsed

    throw new Error(`Invalid trigger combination contract for trigger ${trigger.id} in group ${groupId}: ${field}`)
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private readJoin(value: unknown): SemanticTriggerCombinationJoin | undefined {
    if (typeof value !== 'string') return undefined

    const normalized = value.trim().toUpperCase()
    return normalized === 'AND' || normalized === 'OR' ? normalized : undefined
  }

  private readPhase(value: unknown): SemanticTriggerCombinationPhase | undefined {
    return value === 'entry' || value === 'exit' || value === 'risk' || value === 'gate' ? value : undefined
  }

  private readSideScope(value: unknown): SemanticTriggerCombinationSideScope | undefined {
    return value === 'long' || value === 'short' || value === 'both' ? value : undefined
  }

  private hasStringParam(params: Record<string, unknown>, key: string): boolean {
    return this.readString(params[key]) !== undefined
  }
}
