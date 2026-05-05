import { Injectable } from '@nestjs/common'

import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticNodeStatus,
  SemanticPriority,
  SemanticRequirement,
  SemanticSlotState,
  SemanticState,
} from '../types/semantic-state'
import type { SemanticAtomSupportMetadata } from '../types/semantic-atom-support'
import { buildSemanticSlotId } from '../types/semantic-state'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { SemanticAtomContractService } from './semantic-atom-contract.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'

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
  support?: SemanticAtomSupportMetadata
  status: SemanticNodeStatus
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
    )

    return {
      state: {
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
        position: state.position
          ? mergeOwnerOpenSlots(state.position, slotsByOwnerKey.get(ownerKey('position', positionOwnerId())))
          : null,
      },
      ready: unsupportedOrUnknownOwnerKeys.size === 0
        && missingRequirements.length === 0
        && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey),
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
    if (
      owner.support?.supportStatus === 'recognized_unsupported'
      || owner.support?.supportStatus === 'unsupported_unknown'
    ) {
      return true
    }

    const resolved = this.semanticAtomRegistry.resolve(owner.atomKey)
    return resolved.supportStatus === 'recognized_unsupported'
      || resolved.supportStatus === 'unsupported_unknown'
  }
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
        support: trigger.support,
        status: trigger.status,
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
        support: action.support,
        status: action.status,
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
        support: risk.support,
        status: risk.status,
        contracts: risk.contracts,
      })
    }
  }

  if (state.position && state.position.status !== 'superseded' && state.position.contracts?.length) {
    owners.push({
      ownerKind: 'position',
      ownerId: positionOwnerId(),
      atomKey: toPositionAtomKey(state.position.mode),
      support: state.position.support,
      status: state.position.status,
      contracts: state.position.contracts,
    })
  }

  return owners
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

    if (openSlots[existingIndex].status !== 'open') {
      openSlots[existingIndex] = slot
    }
  }

  return {
    ...owner,
    openSlots,
    ...(owner.status === 'locked' ? { status: 'open' as const } : {}),
  }
}

function isManagedContractReadinessSlot(slot: SemanticSlotState): boolean {
  return slot.slotKey.startsWith('contract.requirement.') || slot.slotKey.startsWith('contract.shape.')
}

function buildRequirementFieldPath(
  requirement: MissingSemanticContractRequirement,
  capabilityKey: string,
): string {
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

  if (owner.ownerKind === 'position') {
    return `position.contracts[${contract.id}].capabilities[${capabilityKey}].shape`
  }

  return `${ownerCollection(owner.ownerKind)}[${owner.ownerId}].contracts[${contract.id}].capabilities[${capabilityKey}].shape`
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
