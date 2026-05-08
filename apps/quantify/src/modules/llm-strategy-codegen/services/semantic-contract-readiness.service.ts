import { Injectable } from '@nestjs/common'

import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticNodeStatus,
  SemanticOrderRequirement,
  SemanticPositionConstraintState,
  SemanticPositionState,
  SemanticPriority,
  SemanticRequirement,
  SemanticRuntimeRequirement,
  SemanticOrchestrationNode,
  SemanticSlotState,
  SemanticState,
  SemanticStateRequirement,
} from '../types/semantic-state'
import type { SemanticAtomSupportMetadata } from '../types/semantic-atom-support'
import { buildSemanticSlotId } from '../types/semantic-state'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { SemanticAtomContractService } from './semantic-atom-contract.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'
import { isBlockingSemanticOpenSlot } from './semantic-open-slot-blocking'

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'
type SemanticSubstrateRequirement =
  | SemanticRuntimeRequirement
  | SemanticStateRequirement
  | SemanticOrderRequirement
type SemanticSubstrateRequirementKind =
  | 'runtime_requirement'
  | 'state_requirement'
  | 'order_requirement'

interface Phase0OrchestrationNormalizationResult {
  state: SemanticState['orchestration']
  hasBlockingSlots: boolean
}

export interface MissingSemanticContractRequirement extends SemanticRequirement {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  contractId: string
}

export interface SemanticContractReadinessNormalizationResult {
  state: SemanticState
  ready: boolean
  missingRequirements: MissingSemanticContractRequirement[]
}

interface SemanticContractOwnerRef {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  atomKey: string
  params: Record<string, unknown>
  support?: SemanticAtomSupportMetadata
  status: SemanticNodeStatus
  openSlots: SemanticSlotState[]
  contracts: SemanticAtomContract[]
}

interface NormalizedProviderContracts {
  contracts: SemanticAtomContract[]
  shapeSlotsByOwnerKey: Map<string, SemanticSlotState[]>
}

@Injectable()
export class SemanticContractReadinessService {
  constructor(
    private readonly semanticAtomContractService: SemanticAtomContractService = new SemanticAtomContractService(),
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly semanticAtomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
  ) {}

  normalize(state: SemanticState): SemanticContractReadinessNormalizationResult {
    const activeOwners = collectActiveContractOwners(state)
    const orchestrationResult = normalizePhase0Orchestration(state.orchestration)
    const unsupportedOrUnknownOwnerKeys = new Set(
      activeOwners
        .filter(owner => this.isUnsupportedOrUnknownOwner(owner))
        .map(owner => ownerKey(owner.ownerKind, owner.ownerId)),
    )
    const supportedOwners = activeOwners.filter(owner =>
      !unsupportedOrUnknownOwnerKeys.has(ownerKey(owner.ownerKind, owner.ownerId)),
    )
    const providerNormalization = this.normalizeProviderContracts(supportedOwners)
    const providerContracts = providerNormalization.contracts
    const resolution = this.semanticAtomContractService.resolve(providerContracts)
    const missingRequirements = this.collectMissingRequirements(supportedOwners, resolution.capabilities)
    const slotsByOwnerKey = mergeSlotMaps(
      providerNormalization.shapeSlotsByOwnerKey,
      buildMissingRequirementSlots(missingRequirements),
      buildMissingSubstrateSlots(supportedOwners),
      buildUnsupportedSubstrateRequirementSlots(supportedOwners),
      buildContractOpenSlotMap(supportedOwners),
      buildAddPositionConstraintRelationshipSlots(state),
    )
    const nextState: SemanticState = {
      ...state,
      triggers: state.triggers.map(trigger =>
        mergeOwnerOpenSlots(trigger, slotsByOwnerKey.get(ownerKey('trigger', trigger.id))),
      ),
      actions: state.actions.map(action =>
        mergeOwnerOpenSlots(action, slotsByOwnerKey.get(ownerKey('action', action.id))),
      ),
      risk: state.risk.map(risk =>
        mergeOwnerOpenSlots(risk, slotsByOwnerKey.get(ownerKey('risk', risk.id))),
      ),
      position: mergePositionOpenSlots(state.position, slotsByOwnerKey),
      orchestration: orchestrationResult.state,
    }

    return {
      state: nextState,
      ready: unsupportedOrUnknownOwnerKeys.size === 0
        && missingRequirements.length === 0
        && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey)
        && !hasBlockingOwnerOpenSlots(nextState)
        && !orchestrationResult.hasBlockingSlots,
      missingRequirements,
    }
  }

  private normalizeProviderContracts(
    activeOwners: readonly SemanticContractOwnerRef[],
  ): NormalizedProviderContracts {
    const shapeSlotsByOwnerKey = new Map<string, SemanticSlotState[]>()
    const contracts: SemanticAtomContract[] = []

    for (const owner of activeOwners) {
      for (const contract of owner.contracts) {
        const capabilities = contract.capabilities.flatMap((capability) => {
          const normalizedCapability = this.normalizeProviderCapability(owner, contract, capability)

          if (normalizedCapability.openSlots.length) {
            const key = ownerKey(owner.ownerKind, owner.ownerId)
            const slots = shapeSlotsByOwnerKey.get(key) ?? []
            slots.push(...normalizedCapability.openSlots)
            shapeSlotsByOwnerKey.set(key, slots)
          }

          return normalizedCapability.capability ? [normalizedCapability.capability] : []
        })

        if (owner.status === 'locked') {
          contracts.push({
            ...contract,
            capabilities,
          })
        }
      }
    }

    return { contracts, shapeSlotsByOwnerKey }
  }

  private normalizeProviderCapability(
    owner: SemanticContractOwnerRef,
    contract: SemanticAtomContract,
    capability: SemanticCapability,
  ): { capability: SemanticCapability | null; openSlots: SemanticSlotState[] } {
    if (capability.domain === 'price' && capability.verb === 'define' && capability.object === 'level_set') {
      const result = this.shapeNormalizer.normalizeLevelSetShape(capability.shape, {
        requireDensity: true,
        fieldPath: buildCapabilityShapeFieldPath(owner, contract, capability),
      })

      return {
        capability: result.status === 'valid'
          ? { ...capability, shape: result.shape }
          : null,
        openSlots: result.openSlots,
      }
    }

    return { capability, openSlots: [] }
  }

  private collectMissingRequirements(
    activeOwners: readonly SemanticContractOwnerRef[],
    capabilities: readonly SemanticCapability[],
  ): MissingSemanticContractRequirement[] {
    return activeOwners.flatMap(owner =>
      owner.contracts.flatMap(contract =>
        contract.requires
          .filter(requirement => !this.hasCapability(capabilities, requirement))
          .map(requirement => ({
            ownerKind: owner.ownerKind,
            ownerId: owner.ownerId,
            contractId: contract.id,
            domain: requirement.domain,
            verb: requirement.verb,
            object: requirement.object,
          })),
      ),
    )
  }

  private hasCapability(
    capabilities: readonly SemanticCapability[],
    requirement: SemanticRequirement,
  ): boolean {
    return capabilities.some(capability =>
      capability.domain === requirement.domain
      && capability.verb === requirement.verb
      && capability.object === requirement.object
      && this.hasRequiredCapabilityShape(capability, requirement),
    )
  }

  private hasRequiredCapabilityShape(
    capability: SemanticCapability,
    requirement: SemanticRequirement,
  ): boolean {
    if (requirement.domain === 'price' && requirement.verb === 'define' && requirement.object === 'level_set') {
      return this.shapeNormalizer.normalizeLevelSetShape(capability.shape, { requireDensity: true }).status === 'valid'
    }

    if (requirement.domain === 'capital' && requirement.verb === 'allocate' && requirement.object === 'per_order_budget') {
      return this.shapeNormalizer.isValidPerOrderBudgetShape(capability.shape)
    }

    if (requirement.domain === 'exposure' && requirement.verb === 'set' && requirement.object === 'position_mode') {
      return readShapeString(capability.shape, 'mode') !== null
    }

    if (requirement.domain === 'guard' && requirement.verb === 'enforce' && isBoundaryCancelRequirement(requirement.object)) {
      return this.shapeNormalizer.isValidBoundaryCancelShape(capability.shape)
    }

    return true
  }

  private isUnsupportedOrUnknownOwner(owner: SemanticContractOwnerRef): boolean {
    const resolved = this.resolveOwnerSupport(owner)
    if (isSupportedAtom(resolved)) {
      return false
    }

    if (isUnsupportedOrUnknownSupportStatus(resolved.supportStatus)) {
      return true
    }

    if (
      owner.support?.supportStatus === 'recognized_unsupported'
      || owner.support?.supportStatus === 'unsupported_unknown'
    ) {
      return true
    }

    return false
  }

  private resolveOwnerSupport(owner: SemanticContractOwnerRef): ReturnType<SemanticAtomRegistryService['resolve']> {
    if (isExecutableIndicatorReferenceAlias(owner)) {
      const registryKey = owner.atomKey === 'indicator.above' ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
      return {
        ...this.semanticAtomRegistry.get(registryKey),
        key: owner.atomKey,
      }
    }

    return this.semanticAtomRegistry.resolve(owner.atomKey)
  }
}

function isSupportedAtom(resolved: ReturnType<SemanticAtomRegistryService['resolve']>): boolean {
  return resolved.supportStatus === 'supported_executable' || resolved.supportStatus === 'supported_requires_slot'
}

function normalizePhase0Orchestration(
  orchestration: SemanticState['orchestration'],
): Phase0OrchestrationNormalizationResult {
  if (!orchestration) {
    return { state: orchestration, hasBlockingSlots: false }
  }

  let changed = false
  let hasBlockingSlots = false
  const nodes = orchestration.nodes.map((node) => {
    const nextNode = addPhase0OrchestrationBlocker(node)
    changed ||= nextNode !== node
    hasBlockingSlots ||= ownerHasOpenSlot(nextNode)
    return nextNode
  })

  return {
    state: changed ? { ...orchestration, nodes } : orchestration,
    hasBlockingSlots,
  }
}

function addPhase0OrchestrationBlocker(node: SemanticOrchestrationNode): SemanticOrchestrationNode {
  if (node.status !== 'locked') {
    return node
  }

  const blocker = toPhase0OrchestrationBlocker(node)
  const openSlots = node.openSlots ?? []
  const blockerIndex = openSlots.findIndex(slot => slot.slotKey === blocker.slotKey)
  const nextOpenSlots = blockerIndex === -1
    ? [...openSlots, blocker]
    : openSlots.map((slot, index) => index === blockerIndex ? blocker : slot)

  return {
    ...node,
    status: 'open',
    openSlots: nextOpenSlots,
  }
}

function toPhase0OrchestrationBlocker(node: SemanticOrchestrationNode): SemanticSlotState {
  return {
    slotKey: 'orchestration.phase0.unsupported',
    fieldPath: `orchestration.${node.kind}[${node.id}]`,
    status: 'open',
    priority: 'behavior',
    affectsExecution: true,
    questionHint: 'Phase 0 暂不支持部署 orchestration runtime。',
    evidence: {
      source: 'derived',
      text: `Phase 0 cannot deploy orchestration node ${node.id}`,
    },
  }
}

function isUnsupportedOrUnknownSupportStatus(status: ReturnType<SemanticAtomRegistryService['resolve']>['supportStatus']): boolean {
  return status === 'recognized_unsupported' || status === 'unsupported_unknown'
}

function readShapeString(shape: SemanticCapability['shape'], key: string): string | null {
  const value = shape[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function isBoundaryCancelRequirement(object: string): boolean {
  return /boundary|breakout|breach|cancel|halt|stop|order|grid/u.test(object)
}

function collectActiveContractOwners(state: SemanticState): SemanticContractOwnerRef[] {
  const owners: SemanticContractOwnerRef[] = []

  for (const trigger of state.triggers) {
    if (trigger.status !== 'superseded' && trigger.contracts?.length) {
      owners.push({
        ownerKind: 'trigger',
        ownerId: trigger.id,
        atomKey: trigger.key,
        params: trigger.params,
        support: trigger.support,
        status: trigger.status,
        openSlots: trigger.openSlots,
        contracts: trigger.contracts,
      })
    }
  }

  for (const action of state.actions) {
    if (action.status !== 'superseded' && action.contracts?.length) {
      owners.push({
        ownerKind: 'action',
        ownerId: action.id,
        atomKey: action.key,
        params: {},
        support: action.support,
        status: action.status,
        openSlots: action.openSlots ?? [],
        contracts: action.contracts,
      })
    }
  }

  for (const risk of state.risk) {
    if (risk.status !== 'superseded' && risk.contracts?.length) {
      owners.push({
        ownerKind: 'risk',
        ownerId: risk.id,
        atomKey: risk.key,
        params: risk.params,
        support: risk.support,
        status: risk.status,
        openSlots: risk.openSlots,
        contracts: risk.contracts,
      })
    }
  }

  if (state.position && state.position.status !== 'superseded' && state.position.contracts?.length) {
    owners.push({
      ownerKind: 'position',
      ownerId: positionOwnerId(),
      atomKey: toPositionAtomKey(state.position.mode),
      params: {
        mode: state.position.mode,
        value: state.position.value,
        positionMode: state.position.positionMode,
        sizing: state.position.sizing,
      },
      support: state.position.support,
      status: state.position.status,
      openSlots: state.position.openSlots ?? [],
      contracts: state.position.contracts,
    })
  }

  for (const constraint of state.position?.constraints ?? []) {
    if (constraint.status !== 'superseded' && constraint.contracts?.length) {
      owners.push({
        ownerKind: 'position',
        ownerId: positionConstraintOwnerId(constraint),
        atomKey: constraint.key,
        params: constraint.params,
        support: constraint.support,
        status: constraint.status,
        openSlots: constraint.openSlots,
        contracts: constraint.contracts,
      })
    }
  }

  return owners
}

function isExecutableIndicatorReferenceAlias(owner: SemanticContractOwnerRef): boolean {
  if (owner.ownerKind !== 'trigger' || (owner.atomKey !== 'indicator.above' && owner.atomKey !== 'indicator.below')) {
    return false
  }

  const indicator = readParamString(owner.params, 'indicator')?.toLowerCase() ?? ''
  const referenceRole = readParamString(owner.params, 'referenceRole') ?? ''
  const referencePeriod = owner.params['reference.period']
  const hasReferencePeriod = typeof referencePeriod === 'number' && Number.isFinite(referencePeriod) && referencePeriod > 0
  const hasReferencePeriodOpenSlot = owner.openSlots.some(slot =>
    slot.status === 'open'
    && slot.affectsExecution
    && /reference\.period/u.test(`${slot.slotKey}.${slot.fieldPath}`),
  )

  return (indicator === 'ma' || indicator === 'sma' || indicator === 'ema')
    && referenceRole.length > 0
    && (hasReferencePeriod || hasReferencePeriodOpenSlot)
}

function readParamString(params: Record<string, unknown>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildMissingRequirementSlots(
  requirements: readonly MissingSemanticContractRequirement[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const requirement of requirements) {
    const key = ownerKey(requirement.ownerKind, requirement.ownerId)
    const slots = slotsByOwnerKey.get(key) ?? []

    slots.push(toOpenSlot(requirement))
    slotsByOwnerKey.set(key, slots)
  }

  return slotsByOwnerKey
}

function buildMissingSubstrateSlots(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (hasContractSubstrate(contract)) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      const slots = slotsByOwnerKey.get(key) ?? []
      slots.push({
        slotKey: 'contract.substrate.missing',
        fieldPath: buildContractFieldPath(owner, contract.id),
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '请补齐该语义合约的执行 substrate。',
        evidence: {
          source: 'derived',
          text: `Missing semantic contract substrate ${contract.id}`,
        },
      })
      slotsByOwnerKey.set(key, slots)
    }
  }

  return slotsByOwnerKey
}

const SUPPORTED_SUBSTRATE_REQUIREMENT_KEYS = new Set([
  'runtime.provide.bar_ohlcv',
  'runtime.provide.indicator_helper',
  'runtime.provide.compiled_predicate_runtime',
  'runtime.provide.position_pnl_pct',
  'runtime.provide.position_snapshot',
  'state.read.none',
  'state.write.none',
  'state.read.sequence_state',
  'state.write.sequence_state',
  'state.read.remembered_level',
  'state.write.remembered_level',
  'state.read_write.pyramiding_layer_count',
  'state.read_write.dca_fired_count',
  'order.support.market_order',
  'order.support.close_position',
  'order.support.reduce_position',
  'order.support.reduce_only',
  'order.enforce.no_exposure_increase',
])

const SUPPORTED_SUBSTRATE_REQUIREMENT_KEY_PREFIXES: readonly string[] = [
  // partial_take_profit allocates a per-strategy state slot whose object is the
  // dynamic memoryKey (`partial_tp_<hash>`); accept the family wholesale.
  'state.read_write.partial_tp_',
]

function buildUnsupportedSubstrateRequirementSlots(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (!hasContractSubstrate(contract)) {
        continue
      }

      const unsupportedRequirements = [
        ...contract.runtimeRequirements.map(requirement => ({
          kind: 'runtime_requirement' as const,
          requirement,
        })),
        ...contract.stateRequirements.map(requirement => ({
          kind: 'state_requirement' as const,
          requirement,
        })),
        ...contract.orderRequirements.map(requirement => ({
          kind: 'order_requirement' as const,
          requirement,
        })),
      ].filter(({ requirement }) => !isSupportedSubstrateRequirement(requirement))

      if (!unsupportedRequirements.length) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      const slots = slotsByOwnerKey.get(key) ?? []
      slots.push(...unsupportedRequirements.map(({ kind, requirement }) =>
        toUnsupportedSubstrateRequirementSlot(owner, contract, kind, requirement),
      ))
      slotsByOwnerKey.set(key, slots)
    }
  }

  return slotsByOwnerKey
}

function isSupportedSubstrateRequirement(requirement: SemanticSubstrateRequirement): boolean {
  const key = requirementKey(requirement)
  if (SUPPORTED_SUBSTRATE_REQUIREMENT_KEYS.has(key)) {
    return true
  }
  return SUPPORTED_SUBSTRATE_REQUIREMENT_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
}

function requirementKey(requirement: SemanticSubstrateRequirement): string {
  return `${requirement.domain}.${requirement.verb}.${requirement.object}`
}

function toUnsupportedSubstrateRequirementSlot(
  owner: SemanticContractOwnerRef,
  contract: SemanticAtomContract,
  requirementKind: SemanticSubstrateRequirementKind,
  requirement: SemanticSubstrateRequirement,
): SemanticSlotState {
  const key = requirementKey(requirement)

  return {
    slotKey: `contract.${requirementKind}.${key}`,
    fieldPath: `${buildContractFieldPath(owner, contract.id)}.${requirementKind}.${key}`,
    status: 'open',
    priority: requirementKind === 'order_requirement' ? 'risk' : 'behavior',
    affectsExecution: true,
    questionHint: `请补齐 ${requirement.domain} ${requirement.verb} ${requirement.object} 的执行 substrate。`,
    evidence: {
      source: 'derived',
      text: `Unsupported semantic contract ${requirementKind} ${contract.id}: ${key}`,
    },
  }
}

function buildContractOpenSlotMap(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (!Array.isArray(contract.openSlots) || !contract.openSlots.length) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      slotsByOwnerKey.set(key, [
        ...(slotsByOwnerKey.get(key) ?? []),
        ...contract.openSlots,
      ])
    }
  }

  return slotsByOwnerKey
}

function buildAddPositionConstraintRelationshipSlots(state: SemanticState): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()
  if (hasActiveAddPositionConstraint(state.position)) {
    return slotsByOwnerKey
  }

  for (const action of state.actions) {
    if (action.status === 'superseded' || action.key !== 'action.add_position') {
      continue
    }

    slotsByOwnerKey.set(ownerKey('action', action.id), [{
      slotKey: 'action.add_position.constraint',
      fieldPath: `actions[${action.id}].params.constraint`,
      status: 'open',
      priority: 'risk',
      affectsExecution: true,
      questionHint: '请确认加仓的约束，例如最大加仓次数或最大总敞口比例。',
      evidence: {
        source: 'derived',
        text: `Missing exposure guard for add_position action ${action.id}`,
      },
    }])
  }

  return slotsByOwnerKey
}

function hasActiveAddPositionConstraint(position: SemanticPositionState | null): boolean {
  return position?.constraints?.some(constraint =>
    constraint.status !== 'superseded'
    && (constraint.key === 'position.pyramiding_limit' || constraint.key === 'position.max_exposure_pct'),
  ) ?? false
}

function hasContractSubstrate(contract: Partial<SemanticAtomContract>): boolean {
  return Array.isArray(contract.runtimeRequirements)
    && Array.isArray(contract.stateRequirements)
    && Array.isArray(contract.orderRequirements)
    && Array.isArray(contract.openSlots)
}

function mergeSlotMaps(
  ...slotMaps: readonly Map<string, SemanticSlotState[]>[]
): Map<string, SemanticSlotState[]> {
  const merged = new Map<string, SemanticSlotState[]>()

  for (const slotMap of slotMaps) {
    for (const [key, slots] of slotMap) {
      merged.set(key, [
        ...(merged.get(key) ?? []),
        ...slots,
      ])
    }
  }

  return merged
}

function hasOpenSlots(slotsByOwnerKey: Map<string, SemanticSlotState[]>): boolean {
  for (const slots of slotsByOwnerKey.values()) {
    if (slots.length) {
      return true
    }
  }

  return false
}

function hasBlockingOwnerOpenSlots(state: SemanticState): boolean {
  return state.triggers.some(ownerHasOpenSlot)
    || state.actions.some(ownerHasOpenSlot)
    || state.risk.some(ownerHasOpenSlot)
    || ownerHasOpenSlot(state.position)
    || (state.position?.constraints ?? []).some(ownerHasOpenSlot)
}

function ownerHasOpenSlot(owner: { openSlots?: readonly SemanticSlotState[] } | null): boolean {
  return owner?.openSlots?.some(isBlockingSemanticOpenSlot) ?? false
}

function toOpenSlot(requirement: MissingSemanticContractRequirement): SemanticSlotState {
  const capabilityKey = `${requirement.domain}.${requirement.verb}.${requirement.object}`

  return {
    slotKey: `contract.requirement.${capabilityKey}`,
    fieldPath: buildRequirementFieldPath(requirement, capabilityKey),
    status: 'open',
    priority: toPriority(requirement.domain),
    affectsExecution: true,
    questionHint: `请补充 ${requirement.domain} ${requirement.verb} ${requirement.object} 的执行语义。`,
    evidence: {
      source: 'derived',
      text: `Missing semantic contract requirement ${requirement.contractId}: ${capabilityKey}`,
    },
  }
}

function mergePositionOpenSlots(
  position: SemanticPositionState | null,
  slotsByOwnerKey: Map<string, SemanticSlotState[]>,
): SemanticPositionState | null {
  if (!position) {
    return null
  }

  const constraints = position.constraints?.map(constraint =>
    mergeOwnerOpenSlots(
      constraint,
      slotsByOwnerKey.get(ownerKey('position', positionConstraintOwnerId(constraint))),
    ),
  )
  const nextPosition = mergeOwnerOpenSlots(position, slotsByOwnerKey.get(ownerKey('position', positionOwnerId())))
  return constraints
    ? { ...nextPosition, constraints }
    : nextPosition
}

function mergeOwnerOpenSlots<T extends { openSlots?: SemanticSlotState[]; status?: SemanticNodeStatus }>(
  owner: T,
  slotsToAdd: readonly SemanticSlotState[] | undefined,
): T {
  const missingSlots = slotsToAdd ?? []
  const missingSlotIds = new Set(missingSlots.map(slot => buildSemanticSlotId(slot)))
  const currentOpenSlots = owner.openSlots ?? []
  const openSlots = currentOpenSlots.filter(slot =>
    !isManagedContractReadinessSlot(slot) || missingSlotIds.has(buildSemanticSlotId(slot)),
  )

  if (!missingSlots.length) {
    const nextStatus = openSlots.some(slot => slot.status === 'open')
      ? 'open'
      : owner.status === 'open'
        ? 'locked'
        : owner.status
    if (openSlots.length === currentOpenSlots.length && nextStatus === owner.status) {
      return owner
    }

    return {
      ...owner,
      openSlots,
      ...(nextStatus ? { status: nextStatus } : {}),
    }
  }

  const slotIndexById = new Map(openSlots.map((slot, index) => [buildSemanticSlotId(slot), index]))

  for (const slot of missingSlots) {
    const slotId = buildSemanticSlotId(slot)
    const existingIndex = slotIndexById.get(slotId)

    if (existingIndex === undefined) {
      openSlots.push(slot)
      slotIndexById.set(slotId, openSlots.length - 1)
      continue
    }

    if (openSlots[existingIndex].status !== 'open' && isManagedContractReadinessSlot(slot)) {
      openSlots[existingIndex] = slot
    }
  }

  const nextStatus = openSlots.some(slot => slot.status === 'open')
    ? 'open'
    : owner.status === 'open'
      ? 'locked'
      : owner.status

  return {
    ...owner,
    openSlots,
    ...(nextStatus ? { status: nextStatus } : {}),
  }
}

function isManagedContractReadinessSlot(slot: SemanticSlotState): boolean {
  return slot.slotKey.startsWith('contract.substrate.')
    || slot.slotKey.startsWith('contract.requirement.')
    || slot.slotKey.startsWith('contract.shape.')
    || slot.slotKey.startsWith('contract.runtime_requirement.')
    || slot.slotKey.startsWith('contract.state_requirement.')
    || slot.slotKey.startsWith('contract.order_requirement.')
    || slot.slotKey === 'action.add_position.constraint'
}

function buildRequirementFieldPath(
  requirement: MissingSemanticContractRequirement,
  capabilityKey: string,
): string {
  if (requirement.ownerKind === 'position' && isPositionConstraintOwnerId(requirement.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(requirement.ownerId)}].contracts[${requirement.contractId}].requires.${capabilityKey}`
  }

  if (requirement.ownerKind === 'position') {
    return `position.contracts[${requirement.contractId}].requires.${capabilityKey}`
  }

  return `${ownerCollection(requirement.ownerKind)}[${requirement.ownerId}].contracts[${requirement.contractId}].requires.${capabilityKey}`
}

function buildCapabilityShapeFieldPath(
  owner: SemanticContractOwnerRef,
  contract: SemanticAtomContract,
  capability: SemanticCapability,
): string {
  const capabilityKey = `${capability.domain}.${capability.verb}.${capability.object}`

  if (owner.ownerKind === 'position' && isPositionConstraintOwnerId(owner.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(owner.ownerId)}].contracts[${contract.id}].capabilities[${capabilityKey}].shape`
  }

  if (owner.ownerKind === 'position') {
    return `position.contracts[${contract.id}].capabilities[${capabilityKey}].shape`
  }

  return `${ownerCollection(owner.ownerKind)}[${owner.ownerId}].contracts[${contract.id}].capabilities[${capabilityKey}].shape`
}

function buildContractFieldPath(
  owner: SemanticContractOwnerRef,
  contractId: string,
): string {
  if (owner.ownerKind === 'position' && isPositionConstraintOwnerId(owner.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(owner.ownerId)}].contracts[${contractId}]`
  }

  if (owner.ownerKind === 'position') {
    return `position.contracts[${contractId}]`
  }

  return `${ownerCollection(owner.ownerKind)}[${owner.ownerId}].contracts[${contractId}]`
}

function ownerCollection(ownerKind: Exclude<SemanticContractOwnerKind, 'position'>): 'triggers' | 'actions' | 'risk' {
  if (ownerKind === 'trigger') {
    return 'triggers'
  }

  if (ownerKind === 'action') {
    return 'actions'
  }

  return 'risk'
}

function toPriority(domain: SemanticCapabilityDomain): SemanticPriority {
  if (domain === 'guard') {
    return 'risk'
  }

  if (domain === 'market') {
    return 'context'
  }

  return 'behavior'
}

function ownerKey(ownerKind: SemanticContractOwnerKind, ownerId: string): string {
  return `${ownerKind}:${ownerId}`
}

function positionOwnerId(): string {
  return 'position'
}

function positionConstraintOwnerId(constraint: Pick<SemanticPositionConstraintState, 'id'>): string {
  return `position-constraint:${constraint.id}`
}

function isPositionConstraintOwnerId(ownerId: string): boolean {
  return ownerId.startsWith('position-constraint:')
}

function positionConstraintIdFromOwnerId(ownerId: string): string {
  return ownerId.slice('position-constraint:'.length)
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
