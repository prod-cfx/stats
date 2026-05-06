import { Injectable } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityShape,
  SemanticContextSlotState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { buildSemanticSlotId } from '../types/semantic-state'
import { renderSemanticClarificationQuestion } from './semantic-clarification-question-renderer.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'
import { SemanticSeedExtractorService } from './semantic-seed-extractor.service'

const DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const REQUIREMENT_LEVEL_SET_SLOT_KEY = 'contract.requirement.price.define.level_set'
const SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'
const ENTRY_TRIGGER_SLOT_KEY = 'trigger.entry'
const EXIT_TRIGGER_SLOT_KEY = 'trigger.exit'
const MISSING_ENTRY_TRIGGER_KEY = 'semantic.missing_entry_atom'
const MISSING_EXIT_TRIGGER_KEY = 'semantic.missing_exit_atom'

type LevelSetDensityAnswer = Partial<{
  gridIntervals: number
  gridCount: number
  absoluteSpacing: number
  spacingPct: number
}>
type LevelSetSpacingConflictAnswer = {
  resolveConflictBy: 'gridCount' | 'spacing'
}
type LevelSetAnswer = LevelSetDensityAnswer | LevelSetSpacingConflictAnswer

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'
type FulfilledTriggerPhase = 'entry' | 'exit'
type FragmentTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type FragmentAction = NonNullable<CodegenSemanticPatch['actions']>[number]

interface SemanticOpenSlotAnswerResolverInput {
  currentState: SemanticState
  message: string
  clarificationState?: unknown
}

export type SemanticOpenSlotAnswerResolverResult =
  | {
    consumed: true
    nextState: SemanticState
    answer: LevelSetAnswer
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
    private readonly seedExtractor: SemanticSeedExtractorService = new SemanticSeedExtractorService(),
  ) {}

  resolve(input: SemanticOpenSlotAnswerResolverInput): SemanticOpenSlotAnswerResolverResult {
    const answer = parseLevelSetAnswer(input.message)
    if (answer) {
      const openSlot = findOpenLevelSetSlot(input.currentState, input.clarificationState)
      if (openSlot) {
        const nextState = applyLevelSetAnswerToOpenSlot(input.currentState, openSlot, answer, this.shapeNormalizer)
        if (nextState !== input.currentState) {
          return {
            consumed: true,
            nextState,
            answer,
            closedSlotKeys: [openSlot.slot.slotKey],
            closedSlots: [{ slotKey: openSlot.slot.slotKey, fieldPath: openSlot.slot.fieldPath }],
          }
        }
      }
    }

    return fulfillSemanticFragment(input.currentState, this.seedExtractor.extract(input.message))
  }
}

function fulfillSemanticFragment(
  state: SemanticState,
  patch: CodegenSemanticPatch,
): SemanticOpenSlotAnswerResolverResult {
  const patchTriggers = patch.triggers ?? []
  const entryTriggers = patchTriggers.filter(trigger => trigger.phase === 'entry')
  const exitTriggers = patchTriggers.filter(trigger => trigger.phase === 'exit')
  const fulfilledPhases: FulfilledTriggerPhase[] = []

  if (hasOpenSlot(state, ENTRY_TRIGGER_SLOT_KEY) && entryTriggers.some(isCompleteFragmentNode)) {
    fulfilledPhases.push('entry')
  }

  if (hasOpenSlot(state, EXIT_TRIGGER_SLOT_KEY) && exitTriggers.some(isCompleteFragmentNode)) {
    fulfilledPhases.push('exit')
  }

  if (fulfilledPhases.length === 0) {
    return { consumed: false, nextState: state }
  }

  return {
    consumed: true,
    nextState: mergeFragmentPatch(state, patch, fulfilledPhases),
    answer: {},
    closedSlotKeys: fulfilledPhases.map(triggerPhaseSlotKey),
    closedSlots: fulfilledPhases.map(phase => ({
      slotKey: triggerPhaseSlotKey(phase),
      fieldPath: triggerPhaseFieldPath(phase),
    })),
  }
}

function hasOpenSlot(state: SemanticState, slotKey: string): boolean {
  return state.triggers.some(trigger => trigger.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || state.actions.some(action => (action.openSlots ?? []).some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || state.risk.some(risk => risk.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || Boolean(state.position?.openSlots?.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
}

function mergeFragmentPatch(
  state: SemanticState,
  patch: CodegenSemanticPatch,
  fulfilledPhases: readonly FulfilledTriggerPhase[],
): SemanticState {
  const missingTriggerKeys = new Set<string>(fulfilledPhases.map(missingTriggerKeyForPhase))
  const fulfilledPhaseSet = new Set<FulfilledTriggerPhase>(fulfilledPhases)
  const existingTriggerIds = new Set(state.triggers.map(trigger => trigger.id))
  const existingActionIds = new Set(state.actions.map(action => action.id))
  const nextTriggers = [
    ...state.triggers.filter(trigger => !(missingTriggerKeys.has(trigger.key) && trigger.status === 'open')),
    ...(patch.triggers ?? [])
      .filter(trigger => shouldMergeFragmentTrigger(trigger, fulfilledPhaseSet))
      .map((trigger, index): SemanticTriggerState => {
        const id = ensureUniqueId(
          trigger.id ?? `semantic-fragment-trigger-${trigger.phase}-${slugifyFragmentId(trigger.key)}-${index + 1}`,
          existingTriggerIds,
        )

        return {
          id,
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope,
          params: trigger.params ?? {},
          status: resolveFragmentNodeStatus(trigger),
          source: 'user_explicit',
          evidence: trigger.evidence,
          openSlots: trigger.openSlots ?? [],
          contracts: trigger.contracts,
          support: trigger.support,
        }
      }),
  ]
  const existingActionKeys = new Set(state.actions.map(action => action.key))
  const nextActions = [
    ...state.actions,
    ...(patch.actions ?? [])
      .filter(action => !existingActionKeys.has(action.key))
      .filter(action => actionMatchesFulfilledPhases(action, fulfilledPhaseSet))
      .map((action, index): SemanticActionState => {
        const id = ensureUniqueId(
          action.id ?? `semantic-fragment-action-${slugifyFragmentId(action.key)}-${index + 1}`,
          existingActionIds,
        )

        return {
          id,
          key: action.key,
          params: action.params,
          status: resolveFragmentNodeStatus(action),
          source: 'user_explicit',
          evidence: action.evidence,
          openSlots: action.openSlots ?? [],
          contracts: action.contracts,
          support: action.support,
        }
      }),
  ]

  return {
    ...state,
    triggers: nextTriggers,
    actions: nextActions,
    contextSlots: mergeFragmentContextSlots(state.contextSlots, patch.contextSlots),
  }
}

function shouldMergeFragmentTrigger(
  trigger: FragmentTrigger,
  fulfilledPhases: ReadonlySet<FulfilledTriggerPhase>,
): boolean {
  if (isFulfilledTriggerPhase(trigger.phase)) {
    return fulfilledPhases.has(trigger.phase)
  }
  if (trigger.phase === 'gate') {
    return fulfilledPhases.size > 0 && isCompleteFragmentNode(trigger)
  }

  return false
}

function actionMatchesFulfilledPhases(
  action: FragmentAction,
  fulfilledPhases: ReadonlySet<FulfilledTriggerPhase>,
): boolean {
  if (isEntryActionKey(action.key)) {
    return fulfilledPhases.has('entry')
  }
  if (isExitActionKey(action.key)) {
    return fulfilledPhases.has('exit')
  }

  return true
}

function isFulfilledTriggerPhase(phase: SemanticTriggerState['phase']): phase is FulfilledTriggerPhase {
  return phase === 'entry' || phase === 'exit'
}

function isEntryActionKey(key: string): boolean {
  return key === 'open_long' || key === 'open_short'
}

function isExitActionKey(key: string): boolean {
  return key === 'close_long' || key === 'close_short'
}

function triggerPhaseSlotKey(phase: FulfilledTriggerPhase): typeof ENTRY_TRIGGER_SLOT_KEY | typeof EXIT_TRIGGER_SLOT_KEY {
  return phase === 'entry' ? ENTRY_TRIGGER_SLOT_KEY : EXIT_TRIGGER_SLOT_KEY
}

function triggerPhaseFieldPath(phase: FulfilledTriggerPhase): 'triggers[entry]' | 'triggers[exit]' {
  return phase === 'entry' ? 'triggers[entry]' : 'triggers[exit]'
}

function missingTriggerKeyForPhase(phase: FulfilledTriggerPhase): typeof MISSING_ENTRY_TRIGGER_KEY | typeof MISSING_EXIT_TRIGGER_KEY {
  return phase === 'entry' ? MISSING_ENTRY_TRIGGER_KEY : MISSING_EXIT_TRIGGER_KEY
}

function isCompleteFragmentNode(node: FragmentTrigger | FragmentAction): boolean {
  return !hasOpenStatusSlot(node.openSlots ?? [])
}

function resolveFragmentNodeStatus(node: FragmentTrigger | FragmentAction): SemanticTriggerState['status'] {
  if (hasOpenStatusSlot(node.openSlots ?? [])) {
    return node.status === 'open' ? node.status : 'open'
  }

  return node.status ?? 'locked'
}

function hasOpenStatusSlot(slots: readonly SemanticSlotState[]): boolean {
  return slots.some(slot => slot.status === 'open')
}

function mergeFragmentContextSlots(
  current: SemanticContextSlotState,
  patchContextSlots: CodegenSemanticPatch['contextSlots'],
): SemanticContextSlotState {
  if (!patchContextSlots) {
    return current
  }

  return {
    exchange: mergeFragmentContextSlot('exchange', current.exchange, patchContextSlots.exchange),
    symbol: mergeFragmentContextSlot('symbol', current.symbol, patchContextSlots.symbol),
    marketType: mergeFragmentContextSlot('marketType', current.marketType, patchContextSlots.marketType),
    timeframe: mergeFragmentContextSlot('timeframe', current.timeframe, patchContextSlots.timeframe),
  }
}

function mergeFragmentContextSlot(
  field: keyof SemanticContextSlotState,
  current: SemanticSlotState | null,
  value: string | number | boolean | null | undefined,
): SemanticSlotState | null {
  if (current?.status === 'locked' || value === undefined || value === null) {
    return current
  }

  return createLockedContextSlot(field, value)
}

function createLockedContextSlot(
  field: keyof SemanticContextSlotState,
  value: string | number | boolean | null | undefined,
): SemanticSlotState | null {
  if (value === undefined || value === null) {
    return null
  }

  return {
    slotKey: field,
    fieldPath: `contextSlots.${field}`,
    value,
    status: 'locked',
    priority: 'context',
    questionHint: contextQuestionHint(field),
    affectsExecution: true,
    evidence: {
      text: String(value),
      source: 'user_explicit',
    },
  }
}

function contextQuestionHint(field: keyof SemanticContextSlotState): string {
  const hints = {
    exchange: '请选择交易所。',
    symbol: '请选择标的。',
    marketType: '请选择市场类型。',
    timeframe: '请选择时间周期。',
  } satisfies Record<keyof SemanticContextSlotState, string>

  return hints[field]
}

function ensureUniqueId(baseId: string, existingIds: Set<string>): string {
  let id = baseId
  let suffix = 2
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  existingIds.add(id)
  return id
}

function slugifyFragmentId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    || 'atom'
}

function parseLevelSetAnswer(message: string): LevelSetAnswer | null {
  return parseLevelSetSpacingConflictAnswer(message) ?? parseLevelSetDensityAnswer(message)
}

function parseLevelSetSpacingConflictAnswer(message: string): LevelSetSpacingConflictAnswer | null {
  const text = message.trim()
  if (/保留|按|用|使用|选择|选/u.test(text) && /网格数量|格数|格子数|多少格/u.test(text)) {
    return { resolveConflictBy: 'gridCount' }
  }
  if (/保留|按|用|使用|选择|选/u.test(text) && /每格|间距|步长/u.test(text)) {
    return { resolveConflictBy: 'spacing' }
  }
  if (/^(?:每格间距|每格|间距|步长)$/u.test(text)) {
    return { resolveConflictBy: 'spacing' }
  }

  return null
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

function isSpacingConflictAnswer(answer: LevelSetAnswer): answer is LevelSetSpacingConflictAnswer {
  return 'resolveConflictBy' in answer
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
    && (slot.slotKey === DENSITY_SLOT_KEY
      || slot.slotKey === REQUIREMENT_LEVEL_SET_SLOT_KEY
      || slot.slotKey === SPACING_CONFLICT_SLOT_KEY),
  )
}

function findClarificationTargetSlot(
  slots: readonly OpenLevelSetSlotRef[],
  pendingItems: ReturnType<typeof readPendingClarificationItems>,
): OpenLevelSetSlotRef | null {
  const activeItem = pendingItems[0]
  if (!activeItem) {
    return null
  }

  const bySlotId = typeof activeItem.slotId === 'string'
    ? slots.find(ref => buildSemanticSlotId(ref.slot) === activeItem.slotId)
    : undefined
  if (bySlotId) {
    return bySlotId
  }

  const byIdentity = typeof activeItem.slotKey === 'string' && typeof activeItem.fieldPath === 'string'
    ? slots.find(ref => ref.slot.slotKey === activeItem.slotKey && ref.slot.fieldPath === activeItem.fieldPath)
    : undefined
  if (byIdentity) {
    return byIdentity
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

function applyLevelSetAnswerToOpenSlot(
  state: SemanticState,
  openSlot: OpenLevelSetSlotRef,
  answer: LevelSetAnswer,
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
  answer: LevelSetAnswer,
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
  answer: LevelSetAnswer,
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
  answer: LevelSetAnswer,
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
  answer: LevelSetAnswer,
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
  answer: LevelSetAnswer,
  shapeNormalizer: SemanticContractShapeNormalizerService,
): { contracts?: SemanticAtomContract[]; updated: boolean; fieldPath: string; hasConflict: boolean } {
  if (!contracts?.length) {
    return { contracts: contracts ? [...contracts] : undefined, updated: false, fieldPath: consumedSlot.fieldPath, hasConflict: false }
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

    const nextShape = applyLevelSetAnswer(contract.capabilities[capabilityIndex].shape, consumedSlot, answer)
    if (nextShape === contract.capabilities[capabilityIndex].shape) {
      return contract
    }

    updated = true
    updatedFieldPath = target.fieldPath
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

function applyLevelSetAnswer(
  shape: SemanticCapabilityShape,
  consumedSlot: SemanticSlotState,
  answer: LevelSetAnswer,
): SemanticCapabilityShape {
  if (isSpacingConflictAnswer(answer)) {
    if (consumedSlot.slotKey !== SPACING_CONFLICT_SLOT_KEY) {
      return shape
    }

    return answer.resolveConflictBy === 'gridCount'
      ? omitShapeKeys(shape, ['absoluteSpacing', 'spacingPct'])
      : omitShapeKeys(shape, ['gridIntervals', 'gridCount'])
  }

  return {
    ...shape,
    ...(answer.gridIntervals !== undefined ? { gridIntervals: answer.gridIntervals } : {}),
    ...(answer.gridCount !== undefined ? { gridCount: answer.gridCount } : {}),
    ...(answer.absoluteSpacing !== undefined ? { absoluteSpacing: answer.absoluteSpacing } : {}),
    ...(answer.spacingPct !== undefined ? { spacingPct: answer.spacingPct } : {}),
  }
}

function omitShapeKeys(shape: SemanticCapabilityShape, keys: readonly string[]): SemanticCapabilityShape {
  const next = { ...shape }
  for (const key of keys) {
    delete next[key]
  }

  return next
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
