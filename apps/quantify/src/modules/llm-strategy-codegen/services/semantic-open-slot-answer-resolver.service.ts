import { Injectable } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { MarketInstrumentQuote, MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticContextSlotState,
  SemanticEvidence,
  SemanticPositionState,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { buildSemanticSlotId } from '../types/semantic-state'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
import { GenericSeedDispatcher } from './generic-seed-dispatcher.service'
import { pickPendingClarificationTarget } from './strategy-clarification-question.service'
import {
  readFlatActions,
  readFlatPositionConstraints,
  readFlatRisks,
  readFlatTriggers,
} from '../types/semantic-state-flat-readers'

const ENTRY_TRIGGER_SLOT_KEY = 'trigger.entry'
const EXIT_TRIGGER_SLOT_KEY = 'trigger.exit'
const MARKET_INSTRUMENT_QUOTES: readonly MarketInstrumentQuote[] = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD']

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position' | 'positionConstraint'
type FulfilledTriggerPhase = 'entry' | 'exit'
type FragmentTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type FragmentAction = NonNullable<CodegenSemanticPatch['actions']>[number]
type PatchContextSlotValue = NonNullable<CodegenSemanticPatch['contextSlots']>[keyof SemanticContextSlotState]

interface SemanticOpenSlotAnswerResolverInput {
  currentState: SemanticState
  message: string
  clarificationState?: unknown
}

export type SemanticOpenSlotAnswerResolverResult =
  | {
    consumed: true
    nextState: SemanticState
    answer: Record<string, unknown>
    closedSlotKeys: string[]
    closedSlots: Array<Pick<SemanticSlotState, 'slotKey' | 'fieldPath'>>
  }
  | {
    consumed: false
    nextState: SemanticState
  }

interface ActiveOpenSlotRef {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  slot: SemanticSlotState
}

@Injectable()
export class SemanticOpenSlotAnswerResolverService {
  constructor(
    private readonly seedExtractor: GenericSeedDispatcher = new GenericSeedDispatcher(),
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
  ) {}

  resolve(input: SemanticOpenSlotAnswerResolverInput): SemanticOpenSlotAnswerResolverResult {
    // 通用通道（#1409）：active pending slot 含 atomKey+paramSlotKey 时走 atom-driven 抽参
    const generic = this.resolveSingleSlotViaAtom(input.currentState, input.message, input.clarificationState)
    if (generic) {
      return generic
    }

    const positionSizingAnswer = resolvePositionSizingAnswer(input.currentState, input.message, input.clarificationState)
    if (positionSizingAnswer) {
      return positionSizingAnswer
    }

    const symbolAnswer = this.resolveSymbolAnswer(input.currentState, input.message, input.clarificationState)
    if (symbolAnswer) {
      return symbolAnswer
    }

    return fulfillSemanticFragment(input.currentState, this.seedExtractor.dispatch(input.message), this.symbolResolver)
  }

  private resolveSingleSlotViaAtom(
    state: SemanticState,
    message: string,
    clarificationState: unknown,
  ): SemanticOpenSlotAnswerResolverResult | null {
    const pendingItems = readPendingClarificationItems(clarificationState)
    const activeTarget = pickPendingClarificationTarget(pendingItems)
    if (!activeTarget) {
      return null
    }

    const slotRef = findActiveOpenSlotRef(state, activeTarget)
    if (!slotRef) {
      return null
    }

    const atomKey = slotRef.slot.atomKey
    const paramSlotKey = slotRef.slot.paramSlotKey
    if (!atomKey || !paramSlotKey) {
      return null
    }

    const result = this.seedExtractor.extractSingleSlot(atomKey, paramSlotKey, message)
    if (!result.ok) {
      return null
    }

    const nextState = applyExtractedValueToOwner(state, slotRef, paramSlotKey, result.value)
    if (nextState === state) {
      return null
    }

    return {
      consumed: true,
      nextState,
      answer: { [paramSlotKey]: result.value },
      closedSlotKeys: [slotRef.slot.slotKey],
      closedSlots: [{ slotKey: slotRef.slot.slotKey, fieldPath: slotRef.slot.fieldPath }],
    }
  }

  private resolveSymbolAnswer(
    state: SemanticState,
    message: string,
    clarificationState: unknown,
  ): SemanticOpenSlotAnswerResolverResult | null {
    const symbolSlot = state.contextSlots.symbol
    if (symbolSlot?.status !== 'open') {
      return null
    }
    if (!canConsumeSymbolAnswer(symbolSlot, clarificationState)) {
      return null
    }

    const resolution = this.symbolResolver.resolve(message)
    if (!resolution) {
      return null
    }

    return {
      consumed: true,
      nextState: {
        ...state,
        contextSlots: {
          ...state.contextSlots,
          symbol: createLockedSymbolContextSlot(resolution, this.symbolResolver),
        },
      },
      answer: {},
      closedSlotKeys: ['symbol'],
      closedSlots: [{ slotKey: 'symbol', fieldPath: 'contextSlots.symbol' }],
    }
  }
}

function findActiveOpenSlotRef(
  state: SemanticState,
  activeTarget: { slotId?: unknown; slotKey?: unknown; fieldPath?: unknown },
): ActiveOpenSlotRef | null {
  const matchSlot = (slot: SemanticSlotState): boolean => {
    if (slot.status !== 'open') return false
    if (typeof activeTarget.slotId === 'string' && buildSemanticSlotId(slot) === activeTarget.slotId) {
      return true
    }
    if (typeof activeTarget.slotKey === 'string' && typeof activeTarget.fieldPath === 'string') {
      return slot.slotKey === activeTarget.slotKey && slot.fieldPath === activeTarget.fieldPath
    }
    return false
  }

  for (const trigger of readFlatTriggers(state)) {
    const slot = trigger.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'trigger', ownerId: trigger.id, slot }
  }
  for (const action of readFlatActions(state)) {
    const slot = (action.openSlots ?? []).find(matchSlot)
    if (slot) return { ownerKind: 'action', ownerId: action.id, slot }
  }
  for (const risk of readFlatRisks(state)) {
    const slot = risk.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'risk', ownerId: risk.id, slot }
  }
  if (state.position?.openSlots?.length) {
    const slot = state.position.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'position', ownerId: 'position', slot }
  }
  // #1395 扁平桶（grid.range_rebalance 等 bucket=positionConstraint 的 atom 由 seed-builder 放这）
  for (const constraint of readFlatPositionConstraints(state)) {
    const slot = constraint.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'positionConstraint', ownerId: constraint.id, slot }
  }
  // 旧嵌套桶残留 fallback（legacy state 反序列化 / 部分 reader 仍查询）
  for (const constraint of state.position?.constraints ?? []) {
    const slot = constraint.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'positionConstraint', ownerId: constraint.id, slot }
  }
  return null
}

function applyExtractedValueToOwner(
  state: SemanticState,
  slotRef: ActiveOpenSlotRef,
  paramSlotKey: string,
  value: unknown,
): SemanticState {
  const removeSlot = (slots: readonly SemanticSlotState[]): SemanticSlotState[] =>
    slots.filter(s => !(s.slotKey === slotRef.slot.slotKey && s.fieldPath === slotRef.slot.fieldPath))
  const nextStatusFor = (slots: readonly SemanticSlotState[]) =>
    slots.some(s => s.status === 'open') ? 'open' as const : 'locked' as const

  if (slotRef.ownerKind === 'trigger') {
    return {
      ...state,
      trigger: state.trigger.map((owner) => {
        if (owner.id !== slotRef.ownerId) return owner
        const openSlots = removeSlot(owner.openSlots)
        return {
          ...owner,
          params: { ...owner.params, [paramSlotKey]: value },
          openSlots,
          status: nextStatusFor(openSlots),
          source: 'user_explicit',
        } satisfies SemanticTriggerState
      }),
    }
  }
  if (slotRef.ownerKind === 'action') {
    return {
      ...state,
      action: state.action.map((owner) => {
        if (owner.id !== slotRef.ownerId) return owner
        const openSlots = removeSlot(owner.openSlots ?? [])
        return {
          ...owner,
          params: { ...(owner.params ?? {}), [paramSlotKey]: value },
          openSlots,
          status: nextStatusFor(openSlots),
          source: 'user_explicit',
        } satisfies SemanticActionState
      }),
    }
  }
  if (slotRef.ownerKind === 'risk') {
    return {
      ...state,
      risk: state.risk.map((owner) => {
        if (owner.id !== slotRef.ownerId) return owner
        const openSlots = removeSlot(owner.openSlots)
        return {
          ...owner,
          params: { ...owner.params, [paramSlotKey]: value },
          openSlots,
          status: nextStatusFor(openSlots),
          source: 'user_explicit',
        } satisfies SemanticRiskState
      }),
    }
  }
  if (slotRef.ownerKind === 'position') {
    // M1: position 顶层 SemanticPositionState 没有通用 `params` 字段
    //   （sizing/mode/value 由 resolvePositionSizingAnswer 独立路径处理）。
    //   若未来在 state.position.openSlots 注册 atom-driven slot，需要先扩
    //   SemanticPositionState 字段；当前直接拒绝通用通道，避免静默吞值。
    return state
  }
  if (slotRef.ownerKind === 'positionConstraint') {
    // #1395 扁平桶 + 旧嵌套桶都同步写——以 owner.id 匹配的桶为准；另一桶 noop。
    //
    // M2 invariant：两桶若同时存在同 slotId 但不同 ownerId 的 open slot 视为 state corruption；
    //   当前 dispatcher / seed-builder 一次写入只产 1 个 grid constraint，不会触发该场景。
    //   若未来出现需开 follow-up issue 跟踪（#1422 收口扁平桶 SoT）。
    //
    // m1 引用稳定：仅当桶里存在 owner.id 匹配项时才 map 出新数组，否则保持原引用避免下游 memo 失效。
    const updateConstraint = (owner: SemanticPositionConstraintState): SemanticPositionConstraintState => {
      if (owner.id !== slotRef.ownerId) return owner
      const openSlots = removeSlot(owner.openSlots)
      return {
        ...owner,
        params: { ...owner.params, [paramSlotKey]: value },
        openSlots,
        status: nextStatusFor(openSlots),
        source: 'user_explicit',
      } satisfies SemanticPositionConstraintState
    }
    const flatConstraints = readFlatPositionConstraints(state)
    const nestedConstraints = state.position?.constraints ?? []
    const flatHasOwner = flatConstraints.some(c => c.id === slotRef.ownerId)
    const nestedHasOwner = nestedConstraints.some(c => c.id === slotRef.ownerId)
    const nextFlatConstraints = flatHasOwner ? flatConstraints.map(updateConstraint) : flatConstraints
    const nextNestedConstraints = nestedHasOwner ? nestedConstraints.map(updateConstraint) : nestedConstraints
    const nextState: SemanticState = nextFlatConstraints === flatConstraints
      ? state
      : { ...state, positionConstraint: nextFlatConstraints }
    if (state.position && nextNestedConstraints !== nestedConstraints) {
      return {
        ...nextState,
        position: { ...state.position, constraints: nextNestedConstraints },
      }
    }
    return nextState
  }
  return state
}

function resolvePositionSizingAnswer(
  state: SemanticState,
  message: string,
  clarificationState: unknown,
): SemanticOpenSlotAnswerResolverResult | null {
  const position = state.position
  const slot = position?.openSlots?.find(item => item.slotKey === 'position.sizing' && item.status === 'open')
  if (!position || !slot || !canConsumePositionSizingAnswer(slot, clarificationState)) {
    return null
  }

  const sizing = parsePositionSizingAnswer(message)
  if (!sizing) {
    return null
  }

  const nextOpenSlots = (position.openSlots ?? []).filter(item =>
    !(item.slotKey === slot.slotKey && item.fieldPath === slot.fieldPath),
  )
  return {
    consumed: true,
    nextState: {
      ...state,
      position: {
        ...position,
        mode: sizing.mode,
        value: sizing.value,
        sizing: sizing.sizing,
        status: nextOpenSlots.some(item => item.status === 'open') ? 'open' : 'locked',
        source: 'user_explicit',
        openSlots: nextOpenSlots,
      },
    },
    answer: {},
    closedSlotKeys: [slot.slotKey],
    closedSlots: [{ slotKey: slot.slotKey, fieldPath: slot.fieldPath }],
  }
}

function canConsumePositionSizingAnswer(slot: SemanticSlotState, clarificationState: unknown): boolean {
  const activeItem = pickPendingClarificationTarget(readPendingClarificationItems(clarificationState))
  if (!activeItem) {
    return true
  }

  if (typeof activeItem.slotId === 'string' && buildSemanticSlotId(slot) === activeItem.slotId) {
    return true
  }

  return activeItem.slotKey === slot.slotKey && activeItem.fieldPath === slot.fieldPath
}

function parsePositionSizingAnswer(message: string): {
  mode: string
  value: number
  sizing: NonNullable<SemanticPositionState['sizing']>
} | null {
  const text = message.trim().replace(/％/gu, '%')
  if (!text) {
    return null
  }

  const quoteMatch = text.match(/(?<![-.\d])(\d+(?:\.\d+)?)(?![\d.])\s*(USDT|USDC|USD|U|刀)(?=$|[\s,，。；;.!！?？])/iu)
  if (quoteMatch?.[1]) {
    const value = Number(quoteMatch[1])
    if (Number.isFinite(value) && value > 0) {
      const rawAsset = (quoteMatch[2] ?? 'USDT').toUpperCase()
      const asset = rawAsset === 'USDC' || rawAsset === 'USD' ? rawAsset : 'USDT'
      return { mode: 'fixed_quote', value, sizing: { kind: 'quote', value, asset } }
    }
  }

  const percentMatch = text.match(/(?<![-.\d])(\d+(?:\.\d+)?)(?![\d.])\s*%/u)
    ?? text.match(/(?:百分之?|percent)\s*(\d+(?:\.\d+)?)/iu)
  if (percentMatch?.[1]) {
    const pct = Number(percentMatch[1])
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
      const value = pct / 100
      return { mode: 'fixed_ratio', value, sizing: { kind: 'ratio', value, unit: 'ratio' } }
    }
  }

  return null
}

function canConsumeSymbolAnswer(symbolSlot: SemanticSlotState, clarificationState: unknown): boolean {
  const pendingItems = readPendingClarificationItems(clarificationState)
  const activeItem = pickPendingClarificationTarget(pendingItems)
  if (!activeItem) {
    return true
  }

  if (typeof activeItem.slotId === 'string' && buildSemanticSlotId(symbolSlot) === activeItem.slotId) {
    return true
  }

  return activeItem.slotKey === symbolSlot.slotKey && activeItem.fieldPath === symbolSlot.fieldPath
}

function fulfillSemanticFragment(
  state: SemanticState,
  patch: CodegenSemanticPatch,
  symbolResolver: MarketInstrumentSymbolResolverService,
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
    nextState: mergeFragmentPatch(state, patch, fulfilledPhases, symbolResolver),
    answer: {},
    closedSlotKeys: fulfilledPhases.map(triggerPhaseSlotKey),
    closedSlots: fulfilledPhases.map(phase => ({
      slotKey: triggerPhaseSlotKey(phase),
      fieldPath: triggerPhaseFieldPath(phase),
    })),
  }
}

function hasOpenSlot(state: SemanticState, slotKey: string): boolean {
  return readFlatTriggers(state).some(trigger => trigger.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || readFlatActions(state).some(action => (action.openSlots ?? []).some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || readFlatRisks(state).some(risk => risk.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || Boolean(state.position?.openSlots?.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
}

function mergeFragmentPatch(
  state: SemanticState,
  patch: CodegenSemanticPatch,
  fulfilledPhases: readonly FulfilledTriggerPhase[],
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticState {
  const fulfilledPhaseSet = new Set<FulfilledTriggerPhase>(fulfilledPhases)
  const existingTriggerIds = new Set(readFlatTriggers(state).map(trigger => trigger.id))
  const existingActionIds = new Set(readFlatActions(state).map(action => action.id))
  const nextTriggers = [
    ...readFlatTriggers(state),
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
  const existingActionKeys = new Set(readFlatActions(state).map(action => action.key))
  const nextActions = [
    ...readFlatActions(state),
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
    trigger: nextTriggers,
    action: nextActions,
    contextSlots: mergeFragmentContextSlots(state.contextSlots, patch.contextSlots, symbolResolver),
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

// M1（PR2c-final-1a）：改用 action.phase 字段判定，消除 atom-key 字面量 white-list。
// dispatcher 在解析时通过 surface.phaseResolver 派生 phase 并写入 action 节点；
// 若 phase 缺失（legacy patch 或尚未迁移路径）则保守保留，不过滤。
function actionMatchesFulfilledPhases(
  action: FragmentAction,
  fulfilledPhases: ReadonlySet<FulfilledTriggerPhase>,
): boolean {
  if (isFulfilledTriggerPhase(action.phase)) {
    return fulfilledPhases.has(action.phase)
  }
  // phase 未知（'risk'/'gate'/undefined）时保守保留，避免误过滤合法 action。
  return true
}

function isFulfilledTriggerPhase(phase: FragmentAction['phase']): phase is FulfilledTriggerPhase {
  return phase === 'entry' || phase === 'exit'
}

function triggerPhaseSlotKey(phase: FulfilledTriggerPhase): typeof ENTRY_TRIGGER_SLOT_KEY | typeof EXIT_TRIGGER_SLOT_KEY {
  return phase === 'entry' ? ENTRY_TRIGGER_SLOT_KEY : EXIT_TRIGGER_SLOT_KEY
}

function triggerPhaseFieldPath(phase: FulfilledTriggerPhase): 'triggers[entry]' | 'triggers[exit]' {
  return phase === 'entry' ? 'triggers[entry]' : 'triggers[exit]'
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
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticContextSlotState {
  if (!patchContextSlots) {
    return current
  }

  return {
    exchange: mergeFragmentContextSlot('exchange', current.exchange, patchContextSlots.exchange, symbolResolver),
    symbol: mergeFragmentContextSlot('symbol', current.symbol, patchContextSlots.symbol, symbolResolver),
    marketType: mergeFragmentContextSlot('marketType', current.marketType, patchContextSlots.marketType, symbolResolver),
    timeframe: mergeFragmentContextSlot('timeframe', current.timeframe, patchContextSlots.timeframe, symbolResolver),
  }
}

function mergeFragmentContextSlot(
  field: keyof SemanticContextSlotState,
  current: SemanticSlotState | null,
  value: PatchContextSlotValue | undefined,
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticSlotState | null {
  if (current?.status === 'locked' || value === undefined || value === null) {
    return current
  }

  return createLockedContextSlot(field, value, symbolResolver) ?? current
}

function createLockedContextSlot(
  field: keyof SemanticContextSlotState,
  value: PatchContextSlotValue,
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticSlotState | null {
  if (field === 'symbol' && isMarketInstrumentSymbolResolution(value)) {
    return createLockedSymbolContextSlot(value, symbolResolver)
  }

  if (field === 'symbol' && isStructuredSymbolContextValue(value)) {
    const resolution = symbolResolver.resolve(value.value)
    if (resolution) {
      return createLockedSymbolContextSlot(resolution, symbolResolver)
    }

    const contracts = readSymbolContracts(value)
    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: value.value,
      status: 'locked',
      priority: 'context',
      questionHint: contextQuestionHint(field),
      affectsExecution: true,
      evidence: readSymbolEvidence(value) ?? {
        text: value.value,
        source: 'user_explicit',
      },
      ...(contracts ? { contracts } : {}),
    }
  }

  if (field === 'symbol' && typeof value === 'string') {
    const resolution = symbolResolver.resolve(value)
    return resolution ? createLockedSymbolContextSlot(resolution, symbolResolver) : null
  }

  if (!isPrimitiveContextSlotValue(value)) {
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

function createLockedSymbolContextSlot(
  resolution: MarketInstrumentSymbolResolution,
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticSlotState {
  return {
    slotKey: 'symbol',
    fieldPath: 'contextSlots.symbol',
    value: resolution.value,
    status: 'locked',
    priority: 'context',
    questionHint: contextQuestionHint('symbol'),
    affectsExecution: true,
    evidence: {
      text: resolution.evidenceText,
      source: resolution.source,
    },
    contracts: [symbolResolver.buildContextContract(resolution)],
  }
}

function isPrimitiveContextSlotValue(value: PatchContextSlotValue): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isStructuredSymbolContextValue(value: PatchContextSlotValue): value is Record<string, unknown> & { value: string } {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof value.value === 'string'
}

function isMarketInstrumentSymbolResolution(value: PatchContextSlotValue): value is MarketInstrumentSymbolResolution {
  return isStructuredSymbolContextValue(value)
    && (value.source === 'user_explicit' || value.source === 'inferred')
    && typeof value.evidenceText === 'string'
    && typeof value.base === 'string'
    && isMarketInstrumentQuote(value.quote)
    && (value.quoteSource === 'explicit' || value.quoteSource === 'default_usdt')
    && (value.marketTypeHint === undefined || value.marketTypeHint === 'perp' || value.marketTypeHint === 'spot')
}

function isMarketInstrumentQuote(value: unknown): value is MarketInstrumentQuote {
  return typeof value === 'string' && MARKET_INSTRUMENT_QUOTES.includes(value as MarketInstrumentQuote)
}

function readSymbolEvidence(value: Record<string, unknown>): SemanticEvidence | undefined {
  return isSemanticEvidence(value.evidence) ? value.evidence : undefined
}

function isSemanticEvidence(value: unknown): value is SemanticEvidence {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).text === 'string'
    && typeof (value as Record<string, unknown>).source === 'string'
}

function readSymbolContracts(value: Record<string, unknown>): SemanticAtomContract[] | undefined {
  const contracts = value.contracts
  if (!Array.isArray(contracts) || !contracts.every(isSemanticAtomContract)) {
    return undefined
  }

  return contracts
}

function isSemanticAtomContract(value: unknown): value is SemanticAtomContract {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.kind === 'string'
    && Array.isArray(record.capabilities)
    && Array.isArray(record.requires)
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

function readPendingClarificationItems(clarificationState: unknown): Array<{
  status?: unknown
  key?: unknown
  reason?: unknown
  slotId?: unknown
  slotKey?: unknown
  fieldPath?: unknown
}> {
  if (!isRecord(clarificationState) || !Array.isArray(clarificationState.items)) {
    return []
  }

  return clarificationState.items.filter((item): item is {
    status?: unknown
    key?: unknown
    reason?: unknown
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
