import { Injectable } from '@nestjs/common'

import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type {
  SemanticSlotIdentity,
  SemanticActionState,
  SemanticOrchestrationContractKind,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import type { StrategyVersionInfo } from '../nl-gateway/version-gate/version-gate.types'
import { buildSemanticSlotId } from '../types/semantic-state'
import type {
  SemanticAtomDefinition,
  SemanticAtomReplacementStrategy,
  SemanticAtomSupportMetadata,
  SemanticAtomUnsupportedMetadata,
} from '../types/semantic-atom-support'
import { toSemanticSupportOpenSlot } from '../types/semantic-atom-support'
import { isAtomExecutableForStrategy } from '../nl-gateway/version-gate/version-gate'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { SemanticOrchestrationRegistryService } from './semantic-orchestration-registry.service'

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

// 不变量 D — orchestration 节点的 support 判定必须经 orchestration registry
//   当前所有 SemanticOrchestrationContractKind 都走 orchestrationRegistry.getContractByKey；
//   未来若需要按 atom registry 解析某 kind，此处改为 union 即可，TS exhaustive 会守住。
const ORCHESTRATION_KIND_SUPPORT_SOURCE: Record<SemanticOrchestrationContractKind, 'orchestration_registry'> = {
  scope: 'orchestration_registry',
  gate: 'orchestration_registry',
  program: 'orchestration_registry',
  portfolioRisk: 'orchestration_registry',
}

@Injectable()
export class SemanticSupportClassifierService {
  constructor(
    private readonly registry: SemanticAtomRegistryService,
    private readonly orchestrationRegistry?: SemanticOrchestrationRegistryService,
  ) {}

  classify(state: SemanticState, strategyVersion?: StrategyVersionInfo): SemanticSupportClassification {
    const unsupportedAtoms: SemanticSupportClassification['unsupportedAtoms'] = []
    const unknownAtoms: string[] = []

    const triggers = state.trigger.map((trigger) => {
      if (trigger.status === 'superseded') {
        return { ...trigger }
      }

      const resolved = this.applyRuntimeVersionGate(this.resolveTriggerSupport(trigger), strategyVersion)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(trigger, resolved), resolved)
    })

    const position = this.classifyPosition(state.position, unsupportedAtoms, unknownAtoms, strategyVersion)

    const actions = state.action.map((action) => {
      if (action.status === 'superseded') {
        return { ...action }
      }

      const resolved = this.applyRuntimeVersionGate(this.registry.resolve(action.key), strategyVersion)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withAddPositionConstraintOpenSlot(
        withRegistryOpenSlots(withSupportMetadata(action, resolved), resolved),
        position,
      )
    })

    const risk = state.risk.map((riskState) => {
      if (riskState.status === 'superseded') {
        return { ...riskState }
      }

      const riskParams = 'params' in riskState && riskState.params !== undefined
        ? riskState.params as Record<string, unknown>
        : {}
      const resolved = this.applyRuntimeVersionGate(this.registry.resolve(riskState.key, riskParams), strategyVersion)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(riskState, resolved), resolved)
    })

    const orchestrationNodes = this.classifyOrchestrationNodes(state, unknownAtoms)

    const nextState: SemanticState = {
      ...state,
      trigger: triggers,
      action: actions,
      risk,
      position,
      orchestration: [...orchestrationNodes],
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
    strategyVersion?: StrategyVersionInfo,
  ): SemanticPositionState | null {
    if (!position) {
      return null
    }

    if (position.status === 'superseded') {
      return { ...position }
    }

    // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
    const constraints = (position as { constraints?: SemanticPositionConstraintState[] }).constraints?.map((constraint) => {
      if (constraint.status === 'superseded') {
        return { ...constraint }
      }

      const resolved = this.applyRuntimeVersionGate(this.registry.resolve(constraint.key, constraint.params), strategyVersion)
      this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
      return withRegistryOpenSlots(withSupportMetadata(constraint, resolved), resolved)
    })

    if (position.mode === 'constraint_only') {
      return {
        ...position,
        ...(constraints ? { constraints } : {}),
      }
    }

    const resolved = this.applyRuntimeVersionGate(this.registry.resolve(toPositionAtomKey(position.mode)), strategyVersion)
    this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
    return {
      ...withRegistryOpenSlots(withSupportMetadata(position, resolved), resolved),
      ...(constraints ? { constraints } : {}),
    }
  }

  // INVARIANT-D：orchestration 节点必须由 classifier 全量遍历
  //   仅对 status==='locked' 的节点判 unknown；非 locked 节点透传不进 unknownAtoms
  //   （open slot 走 collectOpenSlots 分支；superseded/pending 不参与 support 判定）。
  //   未来新增 SemanticOrchestrationContractKind 由 TS exhaustive 静态守住。
  private classifyOrchestrationNodes(
    state: SemanticState,
    unknownAtoms: string[],
  ): readonly SemanticOrchestrationNode[] {
    const nodes = state.orchestration ?? []
    if (!this.orchestrationRegistry || nodes.length === 0) {
      return nodes
    }
    for (const node of nodes) {
      if (node.status !== 'locked' || !node.key) {
        continue
      }
      const source = ORCHESTRATION_KIND_SUPPORT_SOURCE[node.kind]
      if (source !== 'orchestration_registry') {
        continue
      }
      const contract = this.orchestrationRegistry.getContractByKey(node.key)
      if (contract === null) {
        unknownAtoms.push(node.key)
      }
    }
    return nodes
  }

  private resolveTriggerSupport(trigger: SemanticTriggerState): ResolvedSemanticAtom {
    if (isExecutableIndicatorReferenceAlias(trigger)) {
      const resolved = this.registry.get(toExecutableIndicatorReferenceAliasRegistryKey(trigger))

      return {
        ...resolved,
        key: trigger.key,
        requiredParams: ['indicator', 'referenceRole', 'reference.period'],
        defaultableParams: ['confirmationMode'],
        executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
        openSlots: [],
      }
    }

    return this.registry.resolve(trigger.key)
  }

  private applyRuntimeVersionGate(
    resolved: ResolvedSemanticAtom,
    strategyVersion: StrategyVersionInfo | undefined,
  ): ResolvedSemanticAtom {
    if (!strategyVersion || !isSupportedAtom(resolved) || resolved.executableSinceVersion === undefined) {
      return resolved
    }

    if (isAtomExecutableForStrategy(resolved, strategyVersion)) {
      return resolved
    }

    return {
      key: resolved.key,
      category: resolved.category,
      supportStatus: 'recognized_unsupported',
      requiredParams: [...resolved.requiredParams],
      defaultableParams: [...resolved.defaultableParams],
      executableProjection: [],
      openSlots: [],
      unsupported: {
        displayName: resolved.key,
        reasonCode: 'runtime_version_unsupported',
        publicReason: '当前策略部署版本暂不支持该语义原子，请重新发布策略或改用替代方案。',
      },
    }
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

function toExecutableIndicatorReferenceAliasRegistryKey(trigger: SemanticTriggerState): 'indicator.threshold_gte' | 'indicator.threshold_lte' {
  return trigger.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
}

// MA/SMA/EMA price-vs-reference aliases are projection-supported; non-MA static compares remain recognized unsupported.
function isExecutableIndicatorReferenceAlias(trigger: SemanticTriggerState): boolean {
  if (trigger.key !== ATOM_CONTRACT_REGISTRY['indicator.above'].key && trigger.key !== ATOM_CONTRACT_REGISTRY['indicator.below'].key) {
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
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState,
>(node: T, resolved: ResolvedSemanticAtom): T {
  return isSupportedAtom(resolved)
    ? withoutSupportMetadata(node)
    : { ...node, support: toSupportMetadata(resolved) }
}

function isSupportedAtom(
  resolved: ResolvedSemanticAtom,
): resolved is Extract<ResolvedSemanticAtom, { supportStatus: 'supported_executable' | 'supported_requires_slot' }> {
  return resolved.supportStatus === 'supported_executable' || resolved.supportStatus === 'supported_requires_slot'
}

function withoutSupportMetadata<
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState,
>(node: T): T {
  const { support: _support, ...nextNode } = node
  return nextNode as T
}

function withRegistryOpenSlots<
  T extends SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState,
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

function withAddPositionConstraintOpenSlot(
  action: SemanticActionState,
  position: SemanticPositionState | null,
): SemanticActionState {
  if (action.key !== ATOM_CONTRACT_REGISTRY['action.add_position'].key || action.status === 'superseded') {
    return action
  }

  const currentOpenSlots = action.openSlots ?? []
  const hasConstraint = hasActiveAddPositionConstraint(position)
  const openSlots = hasConstraint
    ? currentOpenSlots.filter(slot => slot.slotKey !== 'action.add_position.constraint')
    : currentOpenSlots

  if (hasConstraint) {
    return openSlots.length === currentOpenSlots.length
      ? action
      : { ...action, openSlots }
  }

  const slot: SemanticSlotState = {
    slotKey: 'action.add_position.constraint',
    fieldPath: `actions[${action.id}].params.constraint`,
    status: 'open',
    priority: 'risk',
    questionHint: '请确认加仓的约束，例如最大加仓次数或最大总敞口比例。',
    affectsExecution: true,
  }

  if (openSlots.some(item => buildSemanticSlotId(item) === buildSemanticSlotId(slot))) {
    return action
  }

  return {
    ...action,
    openSlots: [...openSlots, slot],
  }
}

function hasActiveAddPositionConstraint(position: SemanticPositionState | null): boolean {
  // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
  return (position as { constraints?: SemanticPositionConstraintState[] } | null)?.constraints?.some(constraint =>
    constraint.status !== 'superseded'
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.max_exposure_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    && (constraint.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key || constraint.key === 'position.max_exposure_pct'),
  ) ?? false
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
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState,
  requiredParams: string[],
): boolean {
  if (requiredParams.length === 0 || !hasParams(node)) {
    return false
  }

  return requiredParams.some(paramKey => isMissingRequiredParamValue(readParamValue(node.params, paramKey)))
}

function hasParams(
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState,
): node is SemanticTriggerState | SemanticRiskState | SemanticPositionConstraintState | (SemanticActionState & { params: Record<string, unknown> }) {
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

  if (isPositionLifecycleConstraintKey(mode)) {
    return `position.main_mode.${mode}`
  }

  if (mode === 'constraint_only') {
    return 'position.main_mode.constraint_only'
  }

  return mode
}

function isPositionLifecycleConstraintKey(mode: string): boolean {
  return mode === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.max_exposure_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    || mode === 'position.max_exposure_pct'
    || mode === ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key
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
    ...state.trigger.flatMap(trigger => readNodeOpenSlots(trigger)),
    ...state.action.flatMap(action => readNodeOpenSlots(action)),
    ...state.risk.flatMap(risk => readNodeOpenSlots(risk)),
    ...readNodeOpenSlots(state.position),
    ...(state.positionConstraint ?? []).flatMap(constraint => readNodeOpenSlots(constraint)),
    ...(state.orchestration ?? []).flatMap(node =>
      node.status === 'superseded' ? [] : node.openSlots.filter(isOpenSlot),
    ),
    ...Object.values(state.contextSlots).filter(isOpenSlot),
  ]
}

function readNodeOpenSlots(
  node: SemanticTriggerState | SemanticActionState | SemanticRiskState | SemanticPositionState | SemanticPositionConstraintState | null,
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
