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
import { renderSemanticClarificationQuestion } from './semantic-clarification-question-renderer.service'

const DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const REQUIREMENT_LEVEL_SET_SLOT_KEY = 'contract.requirement.price.define.level_set'
const SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'

type LevelSetDensityAnswer = Partial<{
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
  resolve(input: SemanticOpenSlotAnswerResolverInput): SemanticOpenSlotAnswerResolverResult {
    const answer = parseLevelSetDensityAnswer(input.message)
    if (!answer) {
      return { consumed: false, nextState: input.currentState }
    }

    const openSlot = findOpenLevelSetSlot(input.currentState)
    if (!openSlot) {
      return { consumed: false, nextState: input.currentState }
    }

    const nextState = applyLevelSetDensityAnswer(input.currentState, openSlot, answer)
    if (nextState === input.currentState) {
      return { consumed: false, nextState: input.currentState }
    }

    return {
      consumed: true,
      nextState,
      answer,
      closedSlotKeys: [openSlot.slot.slotKey],
    }
  }
}

function parseLevelSetDensityAnswer(message: string): LevelSetDensityAnswer | null {
  const text = message.trim()
  if (!text) {
    return null
  }

  const answer: LevelSetDensityAnswer = {}
  const gridCount = matchPositiveNumber(text, /(\d{1,4})\s*(?:个\s*)?(?:网格|格)/u)
  const absoluteSpacing = matchPositiveNumber(
    text,
    /(?:每\s*格|间距|步长)\s*(\d+(?:\.\d+)?)\s*(?:USDT|USDC|USD|U|刀)?/iu,
  )
  const spacingPct = matchPositiveNumber(
    text,
    /(?:(?:每\s*格|间距|步长)\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:间距|步长)?/iu,
  )

  if (gridCount !== null) {
    answer.gridCount = Math.trunc(gridCount)
  }

  if (spacingPct !== null) {
    answer.spacingPct = spacingPct
  }
  else if (absoluteSpacing !== null) {
    answer.absoluteSpacing = absoluteSpacing
  }

  return hasDensityAnswer(answer) ? answer : null
}

function matchPositiveNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  const value = match?.[1] ? Number(match[1]) : null

  return value !== null && Number.isFinite(value) && value > 0 ? value : null
}

function hasDensityAnswer(answer: LevelSetDensityAnswer): boolean {
  return answer.gridCount !== undefined
    || answer.absoluteSpacing !== undefined
    || answer.spacingPct !== undefined
}

function findOpenLevelSetSlot(state: SemanticState): OpenLevelSetSlotRef | null {
  for (const trigger of state.triggers) {
    const slot = findOpenSlot(trigger.openSlots)
    if (slot) {
      return { ownerKind: 'trigger', ownerId: trigger.id, slot }
    }
  }

  for (const action of state.actions) {
    const slot = findOpenSlot(action.openSlots ?? [])
    if (slot) {
      return { ownerKind: 'action', ownerId: action.id, slot }
    }
  }

  for (const risk of state.risk) {
    const slot = findOpenSlot(risk.openSlots)
    if (slot) {
      return { ownerKind: 'risk', ownerId: risk.id, slot }
    }
  }

  if (state.position?.openSlots?.length) {
    const slot = findOpenSlot(state.position.openSlots)
    if (slot) {
      return { ownerKind: 'position', ownerId: 'position', slot }
    }
  }

  return null
}

function findOpenSlot(slots: readonly SemanticSlotState[]): SemanticSlotState | null {
  return slots.find(slot =>
    slot.status === 'open'
    && (slot.slotKey === DENSITY_SLOT_KEY || slot.slotKey === REQUIREMENT_LEVEL_SET_SLOT_KEY),
  ) ?? null
}

function applyLevelSetDensityAnswer(
  state: SemanticState,
  openSlot: OpenLevelSetSlotRef,
  answer: LevelSetDensityAnswer,
): SemanticState {
  if (openSlot.ownerKind === 'trigger') {
    const updates = state.triggers.map(owner =>
      owner.id === openSlot.ownerId ? updateTriggerOwner(owner, openSlot.slot, answer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, triggers: updates.map(update => update.owner) }
      : state
  }

  if (openSlot.ownerKind === 'action') {
    const updates = state.actions.map(owner =>
      owner.id === openSlot.ownerId ? updateActionOwner(owner, openSlot.slot, answer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, actions: updates.map(update => update.owner) }
      : state
  }

  if (openSlot.ownerKind === 'risk') {
    const updates = state.risk.map(owner =>
      owner.id === openSlot.ownerId ? updateRiskOwner(owner, openSlot.slot, answer) : { owner, updated: false },
    )
    return hasOwnerUpdate(updates)
      ? { ...state, risk: updates.map(update => update.owner) }
      : state
  }

  if (!state.position) {
    return state
  }

  const positionUpdate = updatePositionOwner(state.position, openSlot.slot, answer)

  return positionUpdate.updated ? { ...state, position: positionUpdate.owner } : state
}

function updateTriggerOwner(
  owner: SemanticTriggerState,
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
): OwnerSlotUpdateResult<SemanticTriggerState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots, consumedSlot, answer, contracts.fieldPath)

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
): OwnerSlotUpdateResult<SemanticActionState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots ?? [], consumedSlot, answer, contracts.fieldPath)

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
): OwnerSlotUpdateResult<SemanticRiskState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots, consumedSlot, answer, contracts.fieldPath)

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
): OwnerSlotUpdateResult<SemanticPositionState> {
  const contracts = updateLevelSetContracts(owner.contracts, consumedSlot, answer)
  if (!contracts.updated) {
    return { owner, updated: false }
  }

  const openSlots = resolveOwnerOpenSlots(owner.openSlots ?? [], consumedSlot, answer, contracts.fieldPath)

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
): { contracts?: SemanticAtomContract[]; updated: boolean; fieldPath: string } {
  if (!contracts?.length) {
    return { contracts, updated: false, fieldPath: consumedSlot.fieldPath }
  }

  let updated = false
  let updatedFieldPath = consumedSlot.fieldPath
  const nextContracts = contracts.map((contract) => {
    const capabilityIndex = contract.capabilities.findIndex(isLevelSetCapability)
    if (capabilityIndex < 0) {
      return contract
    }

    updated = true
    updatedFieldPath = consumedSlot.slotKey === REQUIREMENT_LEVEL_SET_SLOT_KEY
      ? buildCapabilityFieldPathFromRequirement(consumedSlot.fieldPath)
      : consumedSlot.fieldPath

    return {
      ...contract,
      capabilities: contract.capabilities.map((capability, index) =>
        index === capabilityIndex
          ? { ...capability, shape: mergeDensityAnswer(capability.shape, answer) }
          : capability,
      ),
    }
  })

  return { contracts: nextContracts, updated, fieldPath: updatedFieldPath }
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
    ...(answer.gridCount !== undefined ? { gridCount: answer.gridCount } : {}),
    ...(answer.absoluteSpacing !== undefined ? { absoluteSpacing: answer.absoluteSpacing } : {}),
    ...(answer.spacingPct !== undefined ? { spacingPct: answer.spacingPct } : {}),
  }
}

function resolveOwnerOpenSlots(
  openSlots: readonly SemanticSlotState[],
  consumedSlot: SemanticSlotState,
  answer: LevelSetDensityAnswer,
  levelSetFieldPath: string,
): SemanticSlotState[] {
  const slots = openSlots.filter(slot => slot !== consumedSlot && slot.slotKey !== consumedSlot.slotKey)

  if (!hasDensityConflict(answer)) {
    return slots
  }

  if (slots.some(slot => slot.slotKey === SPACING_CONFLICT_SLOT_KEY && slot.status === 'open')) {
    return slots
  }

  return [
    ...slots,
    createSpacingConflictSlot(levelSetFieldPath),
  ]
}

function hasDensityConflict(answer: LevelSetDensityAnswer): boolean {
  return answer.gridCount !== undefined
    && (answer.absoluteSpacing !== undefined || answer.spacingPct !== undefined)
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

function hasOwnerUpdate<T>(updates: readonly OwnerSlotUpdateResult<T>[]): boolean {
  return updates.some(update => update.updated)
}
