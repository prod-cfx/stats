import { Injectable } from '@nestjs/common'

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityShape,
  SemanticPositionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { buildSemanticSlotId } from '../types/semantic-state'
import { renderSemanticClarificationQuestion } from './semantic-clarification-question-renderer.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'

const DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const REQUIREMENT_LEVEL_SET_SLOT_KEY = 'contract.requirement.price.define.level_set'
const SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'

type LevelSetDensityAnswer = Partial<{
  gridIntervals: number
  gridCount: number
  absoluteSpacing: number
  spacingPct: number
}>

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'

interface SemanticOpenSlotAnswerResolverInput {
  currentState: SemanticState
  message: string
  clarificationState?: unknown
}

export type SemanticOpenSlotAnswerResolverResult =
  | {
    consumed: true
    nextState: SemanticState
    answer: LevelSetDensityAnswer
    closedSlotKeys: string[]
    closedSlots: Array<Pick<SemanticSlotState, 'slotKey' | 'fieldPath'>>
  }
  | {
    consumed: false
    nextState: SemanticState
  }

interface OpenLevelSetSlotRef {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  slot: SemanticSlotState
}

interface OwnerSlotUpdateResult<T> {
  owner: T
  updated: boolean
}

@Injectable()
export class SemanticOpenSlotAnswerResolverService {
  constructor(
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
  ) {}

  resolve(input: SemanticOpenSlotAnswerResolverInput): SemanticOpenSlotAnswerResolverResult {
    const answer = parseLevelSetDensityAnswer(input.message)
    if (!answer) {
      return { consumed: false, nextState: input.currentState }
    }

    const openSlot = findOpenLevelSetSlot(input.currentState, input.clarificationState)
    if (!openSlot) {
      return { consumed: false, nextState: input.currentState }
    }

    const nextState = applyLevelSetDensityAnswer(input.currentState, openSlot, answer, this.shapeNormalizer)
    if (nextState === input.currentState) {
      return { consumed: false, nextState: input.currentState }
    }

    return {
      consumed: true,
      nextState,
      answer,
      closedSlotKeys: [openSlot.slot.slotKey],
      closedSlots: [{ slotKey: openSlot.slot.slotKey, fieldPath: openSlot.slot.fieldPath }],
    }
  }
}

function parseLevelSetDensityAnswer(message: string): LevelSetDensityAnswer | null {
  const text = message.trim()
  if (!text) {
    return null
  }

  const answer: LevelSetDensityAnswer = {}
  const gridIntervals = matchPositiveInteger(text, /(?<![-.\d])(\d{1,4})(?![\d.])\s*(?:个\s*)?(?:间隔|段)/u)
  const gridCount = matchPositiveInteger(text, /(?:网格数量|格数)\s*(?<![-.\d])(\d{1,4})(?![\d.])|(?<![-.\d])(\d{1,4})(?![\d.])\s*(?:个\s*)?(?:网格|格)/u)
  const absoluteSpacing = matchPositiveNumber(
    text,
    /(?:每\s*格|间距|步长)\s*(?<![-.\d])(\d+(?:\.\d+)?)(?![\d.])\s*(?:USDT|USDC|USD|U|刀)?/iu,
  )
  const spacingPct = matchPositiveNumber(
    text,
    /(?:(?:每\s*格|间距|步长)\s*)?(?<![-.\d])(\d+(?:\.\d+)?)(?![\d.])\s*%\s*(?:间距|步长)?/iu,
  )

  if (gridIntervals !== null) {
    answer.gridIntervals = gridIntervals
    answer.gridCount = gridIntervals + 1
  }
  else if (gridCount !== null) {
    answer.gridCount = gridCount
  }

  if (spacingPct !== null) {
    answer.spacingPct = spacingPct
  }
  else if (absoluteSpacing !== null) {
    answer.absoluteSpacing = absoluteSpacing
  }

  return hasDensityAnswer(answer) ? answer : null
}

function matchPositiveInteger(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  const rawValue = match?.[1] ?? match?.[2] ?? null
  const value = rawValue ? Number(rawValue) : null

  if (value === null || !Number.isInteger(value) || value <= 1 || value > 1000) {
    return null
  }

  return value
}

function matchPositiveNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  const value = match?.[1] ? Number(match[1]) : null

  return value !== null && Number.isFinite(value) && value > 0 ? value : null
}

function hasDensityAnswer(answer: LevelSetDensityAnswer): boolean {
  return answer.gridIntervals !== undefined
    || answer.gridCount !== undefined
    || answer.absoluteSpacing !== undefined
    || answer.spacingPct !== undefined
}

function findOpenLevelSetSlot(state: SemanticState, clarificationState: unknown): OpenLevelSetSlotRef | null {
  const slots = collectOpenLevelSetSlots(state)
  const pendingItems = readPendingClarificationItems(clarificationState)
  const clarificationTarget = findClarificationTargetSlot(slots, pendingItems)
  if (clarificationTarget) {
    return clarificationTarget
  }

  if (pendingItems.length > 0) {
    return null
  }

  return slots.length === 1 ? slots[0] : null
}

function collectOpenLevelSetSlots(state: SemanticState): OpenLevelSetSlotRef[] {
  const slots: OpenLevelSetSlotRef[] = []

  for (const trigger of state.triggers) {
    for (const slot of findOpenSlots(trigger.openSlots)) {
      slots.push({ ownerKind: 'trigger', ownerId: trigger.id, slot })
    }
  }

  for (const action of state.actions) {
    for (const slot of findOpenSlots(action.openSlots ?? [])) {
      slots.push({ ownerKind: 'action', ownerId: action.id, slot })
    }
  }

  for (const risk of state.risk) {
    for (const slot of findOpenSlots(risk.openSlots)) {
      slots.push({ ownerKind: 'risk', ownerId: risk.id, slot })
    }
  }

  if (state.position?.openSlots?.length) {
    for (const slot of findOpenSlots(state.position.openSlots)) {
      slots.push({ ownerKind: 'position', ownerId: 'position', slot })
    }
  }

  return slots
}

function findOpenSlots(slots: readonly SemanticSlotState[]): SemanticSlotState[] {
  return slots.filter(slot =>
    slot.status === 'open'
    && (slot.slotKey === DENSITY_SLOT_KEY || slot.slotKey === REQUIREMENT_LEVEL_SET_SLOT_KEY),
  )
}

function findClarificationTargetSlot(
  slots: readonly OpenLevelSetSlotRef[],
  pendingItems: ReturnType<typeof readPendingClarificationItems>,
): OpenLevelSetSlotRef | null {
  for (const item of pendingItems) {
    const bySlotId = typeof item.slotId === 'string'
      ? slots.find(ref => buildSemanticSlotId(ref.slot) === item.slotId)
      : undefined
    if (bySlotId) {
      return bySlotId
    }

    const byIdentity = typeof item.slotKey === 'string' && typeof item.fieldPath === 'string'
      ? slots.find(ref => ref.slot.slotKey === item.slotKey && ref.slot.fieldPath === item.fieldPath)
      : undefined
    if (byIdentity) {
      return byIdentity
    }
  }

  return null
}

function readPendingClarificationItems(clarificationState: unknown): Array<{
  status?: unknown
  slotId?: unknown
  slotKey?: unknown
  fieldPath?: unknown
}> {
  if (!isRecord(clarificationState) || !Array.isArray(clarificationState.items)) {
    return []
  }

  return clarificationState.items.filter((item): item is {
    status?: unknown
    slotId?: unknown
    slotKey?: unknown
    fieldPath?: unknown
  } => isRecord(item) && item.status === 'pending' && (
    typeof item.slotId === 'string'
    || (typeof item.slotKey === 'string' && typeof item.fieldPath === 'string')
  ))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function applyLevelSetDensityAnswer(
  state: SemanticState,
  openSlot: OpenLevelSetSlotRef,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): SemanticState {
  if (openSlot.ownerKind === 'trigger') {
    const updates = state.triggers.map(owner =>
      owner.id === openSlot.ownerId ? updateTriggerOwner(owner, openSlot.slot, answer, shapeNormalizer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, triggers: updates.map(update => update.owner) }
      : state
  }

  if (openSlot.ownerKind === 'action') {
    const updates = state.actions.map(owner =>
      owner.id === openSlot.ownerId ? updateActionOwner(owner, openSlot.slot, answer, shapeNormalizer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, actions: updates.map(update => update.owner) }
      : state
  }

  if (openSlot.ownerKind === 'risk') {
    const updates = state.risk.map(owner =>
      owner.id === openSlot.ownerId ? updateRiskOwner(owner, openSlot.slot, answer, shapeNormalizer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, risk: updates.map(update => update.owner) }
      : state
  }

  if (!state.position) {
    return state
  }

  const positionUpdate = updatePositionOwner(state.position, openSlot.slot, answer, shapeNormalizer)

  return positionUpdate.updated ? { ...state, position: positionUpdate.owner } : state
}

function updateTriggerOwner(
  owner: SemanticTriggerState,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): OwnerSlotUpdateResult<SemanticTriggerState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer, shapeNormalizer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots, consumedSlot, contracts)

  return {
    owner: {
      ...owner,
      status: openSlots.some(slot => slot.status === 'open') ? 'open' : 'locked',
      openSlots,
      contracts: contracts.contracts,
    },
    updated: true,
  }
}

function updateActionOwner(
  owner: SemanticActionState,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): OwnerSlotUpdateResult<SemanticActionState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer, shapeNormalizer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots ?? [], consumedSlot, contracts)

  return {
    owner: {
      ...owner,
      status: openSlots.some(slot => slot.status === 'open') ? 'open' : 'locked',
      openSlots,
      contracts: contracts.contracts,
    },
    updated: true,
  }
}

function updateRiskOwner(
  owner: SemanticRiskState,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): OwnerSlotUpdateResult<SemanticRiskState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer, shapeNormalizer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots, consumedSlot, contracts)

  return {
    owner: {
      ...owner,
      status: openSlots.some(slot => slot.status === 'open') ? 'open' : 'locked',
      openSlots,
      contracts: contracts.contracts,
    },
    updated: true,
  }
}

function updatePositionOwner(
  owner: SemanticPositionState,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): OwnerSlotUpdateResult<SemanticPositionState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer, shapeNormalizer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots ?? [], consumedSlot, contracts)

  return {
    owner: {
      ...owner,
      status: openSlots.some(slot => slot.status === 'open') ? 'open' : 'locked',
      openSlots,
      contracts: contracts.contracts,
    },
    updated: true,
  }
}

function updateLevelSetContracts(
  contracts: readonly SemanticAtomContract[] | undefined,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): { contracts?: SemanticAtomContract[]; updated: boolean; fieldPath: string; hasConflict: boolean } {
  if (!contracts?.length) {
    return { contracts: undefined, updated: false, fieldPath: consumedSlot.fieldPath, hasConflict: false }
  }

  const target = parseTargetCapabilityPath(consumedSlot.fieldPath, consumedSlot.slotKey)
  if (!target) {
    return { contracts: [...contracts], updated: false, fieldPath: consumedSlot.fieldPath, hasConflict: false }
  }

  let updated = false
  let hasConflict = false
  let updatedFieldPath = consumedSlot.fieldPath
  const nextContracts = contracts.map((contract) => {
    if (contract.id !== target.contractId) {
      return contract
    }

    const capabilityIndex = contract.capabilities.findIndex(capability =>
      isLevelSetCapability(capability) && capabilityKey(capability) === target.capabilityKey,
    )
    if (capabilityIndex < 0) {
      return contract
    }

    updated = true
    updatedFieldPath = target.fieldPath
    const nextShape = mergeDensityAnswer(contract.capabilities[capabilityIndex].shape, answer)
    hasConflict = shapeNormalizer.normalizeLevelSetShape(nextShape, {
      requireDensity: true,
      fieldPath: updatedFieldPath,
    }).status === 'conflict'

    return {
      ...contract,
      capabilities: contract.capabilities.map((capability, index) =>
        index === capabilityIndex
          ? { ...capability, shape: nextShape }
          : capability,
      ),
    }
  })

  return { contracts: nextContracts, updated, fieldPath: updatedFieldPath, hasConflict }
}

function isLevelSetCapability(capability: SemanticCapability): boolean {
  return capability.domain === 'price'
    && capability.verb === 'define'
    && capability.object === 'level_set'
}

function mergeDensityAnswer(
  shape: SemanticCapabilityShape,
  answer: LevelSetDensityAnswer,
): SemanticCapabilityShape {
  return {
    ...shape,
    ...(answer.gridIntervals !== undefined ? { gridIntervals: answer.gridIntervals } : {}),
    ...(answer.gridCount !== undefined ? { gridCount: answer.gridCount } : {}),
    ...(answer.absoluteSpacing !== undefined ? { absoluteSpacing: answer.absoluteSpacing } : {}),
    ...(answer.spacingPct !== undefined ? { spacingPct: answer.spacingPct } : {}),
  }
}

function resolveOwnerOpenSlots(
  openSlots: readonly SemanticSlotState[],
  consumedSlot: SemanticSlotState,
  contracts: { fieldPath: string; hasConflict: boolean },
): SemanticSlotState[] {
  const slots = openSlots.filter(slot => !isSameSlot(slot, consumedSlot))

  if (!contracts.hasConflict) {
    return slots
  }

  if (slots.some(slot => slot.slotKey === SPACING_CONFLICT_SLOT_KEY && slot.fieldPath === contracts.fieldPath && slot.status === 'open')) {
    return slots
  }

  return [
    ...slots,
    createSpacingConflictSlot(contracts.fieldPath),
  ]
}

function isSameSlot(left: SemanticSlotState, right: SemanticSlotState): boolean {
  return left.slotKey === right.slotKey && left.fieldPath === right.fieldPath
}

function createSpacingConflictSlot(fieldPath: string): SemanticSlotState {
  return {
    slotKey: SPACING_CONFLICT_SLOT_KEY,
    fieldPath,
    status: 'open',
    priority: 'core',
    questionHint: renderSemanticClarificationQuestion({
      slotKey: SPACING_CONFLICT_SLOT_KEY,
      fallback: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
    }),
    affectsExecution: true,
    evidence: {
      source: 'derived',
      text: 'Open slot answer introduced conflicting level set density fields.',
    },
  }
}

function buildCapabilityFieldPathFromRequirement(fieldPath: string): string {
  return fieldPath.replace(/\.requires\.price\.define\.level_set$/u, '.capabilities[price.define.level_set].shape')
}

function parseTargetCapabilityPath(
  fieldPath: string,
  slotKey: string,
): { contractId: string; capabilityKey: string; fieldPath: string } | null {
  const contractId = fieldPath.match(/\.contracts\[([^\]]+)\]/u)?.[1]
  if (!contractId) {
    return null
  }

  if (slotKey === REQUIREMENT_LEVEL_SET_SLOT_KEY) {
    return {
      contractId,
      capabilityKey: 'price.define.level_set',
      fieldPath: buildCapabilityFieldPathFromRequirement(fieldPath),
    }
  }

  const capabilityKeyMatch = fieldPath.match(/\.capabilities\[([^\]]+)\]\.shape$/u)
  const capabilityKey = capabilityKeyMatch?.[1]
  if (capabilityKey !== 'price.define.level_set') {
    return null
  }

  return { contractId, capabilityKey, fieldPath }
}

function capabilityKey(capability: SemanticCapability): string {
  return `${capability.domain}.${capability.verb}.${capability.object}`
}

function hasOwnerUpdate<T>(updates: readonly OwnerSlotUpdateResult<T>[]): boolean {
  return updates.some(update => update.updated)
}
