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
import { buildSemanticSlotId } from '../types/semantic-state'
import { SemanticAtomContractService } from './semantic-atom-contract.service'

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
  status: SemanticNodeStatus
  contracts: SemanticAtomContract[]
}

@Injectable()
export class SemanticContractReadinessService {
  constructor(
    private readonly semanticAtomContractService: SemanticAtomContractService = new SemanticAtomContractService(),
  ) {}

  normalize(state: SemanticState): SemanticContractReadinessNormalizationResult {
    const activeOwners = collectActiveContractOwners(state)
    const providerContracts = activeOwners
      .filter(owner => owner.status === 'locked')
      .flatMap(owner => owner.contracts)
    const resolution = this.semanticAtomContractService.resolve(providerContracts)
    const missingRequirements = this.collectMissingRequirements(activeOwners, resolution.capabilities)
    const slotsByOwnerKey = buildMissingRequirementSlots(missingRequirements)

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
      ready: missingRequirements.length === 0,
      missingRequirements,
    }
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
      const lower = readShapeNumber(capability.shape, 'lower')
      const upper = readShapeNumber(capability.shape, 'upper')
      if (lower !== null && upper !== null && upper > lower) {
        return true
      }

      if (readShapeString(capability.shape, 'mode') === 'centered_percent_range') {
        const halfRangePct = readShapeNumber(capability.shape, 'halfRangePct')
        const gridCount = readShapeNumber(capability.shape, 'gridCount')
        return readShapeString(capability.shape, 'centerSource') !== null
          && (halfRangePct === null || halfRangePct > 0)
          && (gridCount === null || gridCount > 0)
      }

      return false
    }

    if (requirement.domain === 'capital' && requirement.verb === 'allocate' && requirement.object === 'per_order_budget') {
      const value = readShapeNumber(capability.shape, 'value')
      const asset = readShapeString(capability.shape, 'asset')
      return value !== null && value > 0 && asset !== null
    }

    if (requirement.domain === 'exposure' && requirement.verb === 'set' && requirement.object === 'position_mode') {
      return readShapeString(capability.shape, 'mode') !== null
    }

    return true
  }
}

function readShapeNumber(shape: SemanticCapability['shape'], key: string): number | null {
  const value = shape[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readShapeString(shape: SemanticCapability['shape'], key: string): string | null {
  const value = shape[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function collectActiveContractOwners(state: SemanticState): SemanticContractOwnerRef[] {
  const owners: SemanticContractOwnerRef[] = []

  for (const trigger of state.triggers) {
    if (trigger.status !== 'superseded' && trigger.contracts?.length) {
      owners.push({
        ownerKind: 'trigger',
        ownerId: trigger.id,
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
        status: risk.status,
        contracts: risk.contracts,
      })
    }
  }

  if (state.position && state.position.status !== 'superseded' && state.position.contracts?.length) {
    owners.push({
      ownerKind: 'position',
      ownerId: positionOwnerId(),
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
    !isContractRequirementSlot(slot) || missingSlotIds.has(buildSemanticSlotId(slot)),
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

function isContractRequirementSlot(slot: SemanticSlotState): boolean {
  return slot.slotKey.startsWith('contract.requirement.')
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
