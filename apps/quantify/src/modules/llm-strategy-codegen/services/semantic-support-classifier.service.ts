import { Injectable } from '@nestjs/common'

import type {
  SemanticSlotIdentity,
  SemanticActionState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { buildSemanticSlotId } from '../types/semantic-state'
import type {
  SemanticAtomDefinition,
  SemanticAtomReplacementStrategy,
  SemanticAtomSupportMetadata,
  SemanticAtomUnsupportedMetadata,
} from '../types/semantic-atom-support'
import { toSemanticSupportOpenSlot } from '../types/semantic-atom-support'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'

export type SemanticSupportRoute =
  | 'projection_gate'
  | 'open_slots'
  | 'unsupported_fallback'
  | 'unknown_unsupported'

export interface SemanticSupportClassification {
  route: SemanticSupportRoute
  state: SemanticState
  unsupportedAtoms: Array<{
    key: string
    displayName: string
    reasonCode: string
    publicReason: string
    replacementStrategyKey?: string
  }>
  unknownAtoms: string[]
  openSlots: SemanticSlotState[]
}

type ResolvedSemanticAtom = ReturnType<SemanticAtomRegistryService['resolve']>

@Injectable()
export class SemanticSupportClassifierService {
  constructor(private readonly registry: SemanticAtomRegistryService) {}

  classify(state: SemanticState): SemanticSupportClassification {
    const unsupportedAtoms: SemanticSupportClassification['unsupportedAtoms'] = []
    const unknownAtoms: string[] = []

    const triggers = state.triggers.map((trigger) => {
      if (trigger.status === 'superseded') {
        return { ...trigger }
      }

      const resolved = this.resolveTriggerSupport(trigger)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(trigger, resolved), resolved)
    })

    const actions = state.actions.map((action) => {
      if (action.status === 'superseded') {
        return { ...action }
      }

      const resolved = this.registry.resolve(action.key)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(action, resolved), resolved)
    })

    const risk = state.risk.map((riskState) => {
      if (riskState.status === 'superseded') {
        return { ...riskState }
      }

      const resolved = this.registry.resolve(riskState.key)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(riskState, resolved), resolved)
    })

    const position = this.classifyPosition(state.position, unsupportedAtoms, unknownAtoms)
    const nextState: SemanticState = {
      ...state,
      triggers,
      actions,
      risk,
      position,
    }

    if (unknownAtoms.length > 0) {
      return {
        route: 'unknown_unsupported',
        state: nextState,
        unsupportedAtoms,
        unknownAtoms,
        openSlots: [],
      }
    }

    if (unsupportedAtoms.length > 0) {
      return {
        route: 'unsupported_fallback',
        state: nextState,
        unsupportedAtoms,
        unknownAtoms: [],
        openSlots: [],
      }
    }

    const openSlots = collectOpenSlots(nextState)
    if (openSlots.length > 0) {
      return {
        route: 'open_slots',
        state: nextState,
        unsupportedAtoms: [],
        unknownAtoms: [],
        openSlots,
      }
    }

    return {
      route: 'projection_gate',
      state: nextState,
      unsupportedAtoms: [],
      unknownAtoms: [],
      openSlots: [],
    }
  }

  private classifyPosition(
    position: SemanticPositionState | null,
    unsupportedAtoms: SemanticSupportClassification['unsupportedAtoms'],
    unknownAtoms: string[],
  ): SemanticPositionState | null {
    if (!position) {
      return null
    }

    if (position.status === 'superseded') {
      return { ...position }
    }

    const resolved = this.registry.resolve(toPositionAtomKey(position.mode))
    this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
    return withRegistryOpenSlots(withSupportMetadata(position, resolved), resolved)
  }

  private resolveTriggerSupport(trigger: SemanticTriggerState): ResolvedSemanticAtom {
    if (isExecutableIndicatorReferenceAlias(trigger)) {
      return {
        key: trigger.key,
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['indicator', 'referenceRole', 'reference.period'],
        defaultableParams: ['confirmationMode'],
        executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
        openSlots: [],
      }
    }

    return this.registry.resolve(trigger.key)
  }

  private collectSupportResult(
    resolved: ResolvedSemanticAtom,
    unsupportedAtoms: SemanticSupportClassification['unsupportedAtoms'],
    unknownAtoms: string[],
  ): void {
    if (resolved.supportStatus === 'recognized_unsupported') {
      const unsupported = readUnsupportedMetadata(resolved)
      unsupportedAtoms.push({
        key: resolved.key,
        displayName: unsupported?.displayName ?? resolved.key,
        reasonCode: unsupported?.reasonCode ?? 'recognized_unsupported',
        publicReason: unsupported?.publicReason ?? '当前语义原子暂未支持生成和回测。',
        replacementStrategyKey: readReplacement(resolved)?.strategyKey,
      })
      return
    }

    if (resolved.supportStatus === 'unsupported_unknown') {
      unknownAtoms.push(resolved.key)
    }
  }
}

// MA/SMA/EMA price-vs-reference aliases are projection-supported; non-MA static compares remain recognized unsupported.
function isExecutableIndicatorReferenceAlias(trigger: SemanticTriggerState): boolean {
  if (trigger.key !== 'indicator.above' && trigger.key !== 'indicator.below') {
    return false
  }

  const params = trigger.params
  const indicator = typeof params.indicator === 'string' ? params.indicator.trim().toLowerCase() : ''
  const referenceRole = typeof params.referenceRole === 'string' ? params.referenceRole.trim() : ''
  const referencePeriod = params['reference.period']
  const hasReferencePeriod = typeof referencePeriod === 'number' && Number.isFinite(referencePeriod) && referencePeriod > 0
  const hasReferencePeriodOpenSlot = trigger.openSlots.some(slot =>
    slot.status === 'open'
    && slot.affectsExecution
    && /reference\.period/u.test(`${slot.slotKey}.${slot.fieldPath}`),
  )
  return (indicator === 'ma' || indicator === 'sma' || indicator === 'ema')
    && referenceRole.length > 0
    && (hasReferencePeriod || hasReferencePeriodOpenSlot)
}

function withSupportMetadata<
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState,
>(node: T, resolved: ResolvedSemanticAtom): T {
  return isSupportedAtom(resolved)
    ? withoutSupportMetadata(node)
    : { ...node, support: toSupportMetadata(resolved) }
}

function isSupportedAtom(resolved: ResolvedSemanticAtom): boolean {
  return resolved.supportStatus === 'supported_executable' || resolved.supportStatus === 'supported_requires_slot'
}

function withoutSupportMetadata<
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState,
>(node: T): T {
  const { support: _support, ...nextNode } = node
  return nextNode as T
}

function withRegistryOpenSlots<
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState,
>(node: T, resolved: ResolvedSemanticAtom): T {
  if (resolved.supportStatus !== 'supported_requires_slot' || !hasRequiredParamOpenSlotSpecs(resolved)) {
    return node
  }

  if (!hasMissingRequiredParam(node, resolved.requiredParams)) {
    return node
  }

  const existingSlots = node.openSlots ?? []
  const existingSlotIds = new Set(existingSlots.map(slot => buildSemanticSlotId(slot)))
  const registryOpenSlots = resolved.openSlots
    .filter(slot => !existingSlotIds.has(toSlotId(slot)))
    .map(slot => toSemanticSupportOpenSlot(slot))

  if (registryOpenSlots.length === 0) {
    return node
  }

  return {
    ...node,
    openSlots: [...existingSlots, ...registryOpenSlots],
  }
}

function toSlotId(slot: SemanticSlotIdentity): string {
  return buildSemanticSlotId(slot)
}

function hasRequiredParamOpenSlotSpecs(
  resolved: ResolvedSemanticAtom,
): resolved is SemanticAtomDefinition & { openSlots: SemanticAtomDefinition['openSlots'] } {
  return 'openSlots' in resolved && resolved.openSlots.length > 0
}

function hasMissingRequiredParam(
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState,
  requiredParams: string[],
): boolean {
  if (requiredParams.length === 0 || !hasParams(node)) {
    return false
  }

  return requiredParams.some(paramKey => isMissingRequiredParamValue(readParamValue(node.params, paramKey)))
}

function hasParams(
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState,
): node is SemanticTriggerState | SemanticRiskState | (SemanticActionState & { params: Record<string, unknown> }) {
  return 'params' in node && node.params !== undefined
}

function readParamValue(params: Record<string, unknown>, paramKey: string): unknown {
  if (paramKey in params) {
    return params[paramKey]
  }

  return paramKey.split('.').reduce<unknown>((value, key) => {
    if (!isRecord(value)) {
      return undefined
    }

    return value[key]
  }, params)
}

function isMissingRequiredParamValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }

  return typeof value === 'string' && (value.trim() === '' || value.trim().toLowerCase() === 'unknown')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPositionAtomKey(mode: string): string {
  if (mode === 'fixed_ratio') {
    return 'position.fixed_pct'
  }

  if (mode === 'fixed_quote') {
    return 'position.fixed_notional'
  }

  if (mode === 'fixed_qty') {
    return 'position.fixed_quantity'
  }

  return mode
}

function toSupportMetadata(resolved: ResolvedSemanticAtom): SemanticAtomSupportMetadata {
  const unsupported = readUnsupportedMetadata(resolved)
  const replacement = readReplacement(resolved)

  return {
    supportStatus: resolved.supportStatus,
    ...(unsupported?.reasonCode ? { unsupportedReasonCode: unsupported.reasonCode } : {}),
    ...(unsupported?.displayName ? { unsupportedDisplayName: unsupported.displayName } : {}),
    ...(replacement?.strategyKey ? { replacementStrategyKey: replacement.strategyKey } : {}),
  }
}

function collectOpenSlots(state: SemanticState): SemanticSlotState[] {
  return [
    ...state.triggers.flatMap(trigger => readNodeOpenSlots(trigger)),
    ...state.actions.flatMap(action => readNodeOpenSlots(action)),
    ...state.risk.flatMap(risk => readNodeOpenSlots(risk)),
    ...readNodeOpenSlots(state.position),
    ...Object.values(state.contextSlots).filter(isOpenSlot),
  ]
}

function readNodeOpenSlots(
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | null,
): SemanticSlotState[] {
  if (!node || node.status === 'superseded') {
    return []
  }

  return (node.openSlots ?? []).filter(isOpenSlot)
}

function isOpenSlot(slot: SemanticSlotState | null): slot is SemanticSlotState {
  return slot?.status === 'open' && slot.affectsExecution === true
}

function readUnsupportedMetadata(resolved: ResolvedSemanticAtom): SemanticAtomUnsupportedMetadata | undefined {
  if (hasUnsupportedMetadata(resolved)) {
    return resolved.unsupported
  }

  return undefined
}

function readReplacement(resolved: ResolvedSemanticAtom): SemanticAtomReplacementStrategy | undefined {
  if (hasReplacement(resolved)) {
    return resolved.replacement
  }

  return undefined
}

function hasUnsupportedMetadata(
  resolved: ResolvedSemanticAtom,
): resolved is SemanticAtomDefinition & { unsupported: SemanticAtomUnsupportedMetadata } {
  return 'unsupported' in resolved && resolved.unsupported !== undefined
}

function hasReplacement(
  resolved: ResolvedSemanticAtom,
): resolved is SemanticAtomDefinition & { replacement: SemanticAtomReplacementStrategy } {
  return 'replacement' in resolved && resolved.replacement !== undefined
}
