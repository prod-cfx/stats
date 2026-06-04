import { Injectable } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { AtomExprAtom, SemanticRule } from '../types/atom-expr'
import type { MarketInstrumentQuote, MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticContextSlotState,
  SemanticEvidence,
  SemanticPositionState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { buildSemanticSlotId } from '../types/semantic-state'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { collectAtomLeaves, listRuleEffects } from '../types/atom-expr'
import { GenericSeedDispatcher } from './generic-seed-dispatcher.service'
import { pickPendingClarificationTarget } from './strategy-clarification-question.service'
import { SemanticStateReducerService } from './semantic-state-reducer.service'
import type { RulesMainflowAtomFact } from './rules-mainflow-reader.service'
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

const ENTRY_TRIGGER_SLOT_KEY = 'trigger.entry'
const EXIT_TRIGGER_SLOT_KEY = 'trigger.exit'
const MARKET_INSTRUMENT_QUOTES: readonly MarketInstrumentQuote[] = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD']
const rulesMainflowReader = new RulesMainflowReaderService()

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position' | 'positionConstraint'
type FulfilledTriggerPhase = 'entry' | 'exit'
type PatchContextSlotValue = NonNullable<CodegenSemanticPatch['contextSlots']>[keyof SemanticContextSlotState]

interface FragmentNode {
  id?: string
  key: string
  phase?: SemanticTriggerState['phase'] | SemanticRule['phase']
  sideScope?: SemanticTriggerState['sideScope']
  params?: Record<string, unknown>
  status?: SemanticTriggerState['status']
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
  contracts?: SemanticAtomContract[]
}

interface SemanticFragmentPatch {
  rules?: readonly SemanticRule[]
  triggers?: FragmentNode[]
  actions?: FragmentNode[]
  contextSlots?: CodegenSemanticPatch['contextSlots']
}

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

interface PendingClarificationItemRef {
  status?: unknown
  key?: unknown
  field?: unknown
  reason?: unknown
  slotId?: unknown
  slotKey?: unknown
  fieldPath?: unknown
}

@Injectable()
export class SemanticOpenSlotAnswerResolverService {
  constructor(
    private readonly seedExtractor: GenericSeedDispatcher = new GenericSeedDispatcher(),
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
    private readonly semanticStateReducer: SemanticStateReducerService = new SemanticStateReducerService(),
  ) {}

  resolve(input: SemanticOpenSlotAnswerResolverInput): SemanticOpenSlotAnswerResolverResult {
    const pendingSlotAnswer = this.resolvePendingSlotAnswer(input.currentState, input.message, input.clarificationState)
    if (pendingSlotAnswer) {
      return pendingSlotAnswer
    }

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

    if (!canConsumeSemanticFragment(input.currentState, input.clarificationState)) {
      return { consumed: false, nextState: input.currentState }
    }

    return fulfillSemanticFragment(input.currentState, this.seedExtractor.dispatch(input.message), this.symbolResolver, input.clarificationState)
  }

  private resolvePendingSlotAnswer(
    state: SemanticState,
    message: string,
    clarificationState: unknown,
  ): SemanticOpenSlotAnswerResolverResult | null {
    const activeTarget = pickPendingClarificationTarget(readPendingClarificationItems(clarificationState))
    if (!activeTarget) {
      return null
    }

    const contextSlot = findActiveOpenContextSlot(state, activeTarget)
    if (contextSlot) {
      const resolved = resolveKnownPendingSlotValue(contextSlot.slot, message)
      if (!resolved) {
        return null
      }

      const nextState = this.semanticStateReducer.applyClarificationAnswer({
        currentState: state,
        targetSlotKey: contextSlot.slot.slotKey,
        targetFieldPath: contextSlot.slot.fieldPath,
        targetSlotId: buildSemanticSlotId(contextSlot.slot),
        answer: message,
      })
      if (nextState === state) {
        return null
      }

      return {
        consumed: true,
        nextState,
        answer: { [contextSlot.contextKey]: resolved.value },
        closedSlotKeys: [contextSlot.slot.slotKey],
        closedSlots: [{ slotKey: contextSlot.slot.slotKey, fieldPath: contextSlot.slot.fieldPath }],
      }
    }

    const slotRef = findActiveOpenSlotRef(state, activeTarget)
    if (!slotRef) {
      return null
    }

    const resolved = resolveKnownPendingSlotValue(slotRef.slot, message)
    if (!resolved) {
      return null
    }

    const paramSlotKey = slotRef.slot.paramSlotKey ?? inferParamSlotKey(slotRef.slot)
    if (!paramSlotKey) {
      return null
    }

    const nextState = this.semanticStateReducer.applyClarificationAnswer({
      currentState: state,
      targetSlotKey: slotRef.slot.slotKey,
      targetFieldPath: slotRef.slot.fieldPath,
      targetSlotId: buildSemanticSlotId(slotRef.slot),
      answer: message,
    })
    if (nextState === state) {
      return null
    }

    return {
      consumed: true,
      nextState,
      answer: { [paramSlotKey]: resolved.value },
      closedSlotKeys: [slotRef.slot.slotKey],
      closedSlots: [{ slotKey: slotRef.slot.slotKey, fieldPath: slotRef.slot.fieldPath }],
    }
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

    const nextState = this.semanticStateReducer.applyClarificationAnswer({
      currentState: state,
      targetSlotKey: slotRef.slot.slotKey,
      targetFieldPath: slotRef.slot.fieldPath,
      targetSlotId: buildSemanticSlotId(slotRef.slot),
      answer: String(result.value),
    })
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

function findActiveOpenContextSlot(
  state: SemanticState,
  activeTarget: { slotId?: unknown; slotKey?: unknown; fieldPath?: unknown },
): { contextKey: keyof SemanticContextSlotState, slot: SemanticSlotState } | null {
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

  for (const contextKey of ['exchange', 'symbol', 'marketType', 'timeframe'] as const) {
    const slot = state.contextSlots[contextKey]
    if (slot && matchSlot(slot)) {
      return { contextKey, slot }
    }
  }

  return null
}

function resolveKnownPendingSlotValue(
  slot: SemanticSlotState,
  answer: string,
): { value: string | boolean, status: 'locked' } | null {
  const normalized = answer.trim()
  const slotLabel = `${slot.slotKey} ${slot.fieldPath}`.toLowerCase()
  if (!normalized) {
    return null
  }

  if (slotLabel.includes('exchange') && /^okx$/iu.test(normalized)) {
    return { value: 'okx', status: 'locked' }
  }

  if (slotLabel.includes('timeframe') && /^(1m|3m|5m|15m|30m|1h|4h|1d)$/iu.test(normalized)) {
    return { value: normalized.toLowerCase(), status: 'locked' }
  }

  if (slotLabel.includes('markettype') || slotLabel.includes('market_type') || slotLabel.includes('market type')) {
    if (/现货|spot/iu.test(normalized)) {
      return { value: 'spot', status: 'locked' }
    }
    if (/合约|永续|perp|\bcontract\b/iu.test(normalized)) {
      return { value: 'perp', status: 'locked' }
    }
  }

  if (slotLabel.includes('reverse') && /不需要|不用|否|no/iu.test(normalized)) {
    return { value: false, status: 'locked' }
  }

  if (slotLabel.includes('add_position') && /不加仓|不需要|不用|否|no/iu.test(normalized)) {
    return { value: 'none', status: 'locked' }
  }

  return null
}

function inferParamSlotKey(slot: SemanticSlotState): string | null {
  const paramsPath = slot.fieldPath.match(/(?:^|\.)params\.([A-Za-z0-9_]+)$/u)
  if (paramsPath?.[1]) {
    return paramsPath[1]
  }

  const slotKeyPath = slot.slotKey.match(/\.([A-Za-z0-9_]+)$/u)
  return slotKeyPath?.[1] ?? null
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

  for (const fact of rulesMainflowReader.readFactsByRole(state, 'condition')) {
    const slot = fact.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'trigger', ownerId: fact.id, slot }
  }
  for (const fact of rulesMainflowReader.readFactsByRole(state, 'action')) {
    const slot = fact.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'action', ownerId: fact.id, slot }
  }
  for (const fact of rulesMainflowReader.readFactsByRole(state, 'risk')) {
    const slot = fact.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'risk', ownerId: fact.id, slot }
  }
  if (state.position?.openSlots?.length) {
    const slot = state.position.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'position', ownerId: 'position', slot }
  }
  for (const fact of rulesMainflowReader.readFactsByRole(state, 'position')) {
    const slot = fact.openSlots.find(matchSlot)
    if (slot) return { ownerKind: 'positionConstraint', ownerId: fact.id, slot }
  }
  return null
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
    return !hasRawPendingClarificationItem(clarificationState)
  }

  if (typeof activeItem.slotId === 'string' && buildSemanticSlotId(symbolSlot) === activeItem.slotId) {
    return true
  }

  return activeItem.slotKey === symbolSlot.slotKey && activeItem.fieldPath === symbolSlot.fieldPath
}

function hasRawPendingClarificationItem(clarificationState: unknown): boolean {
  return isRecord(clarificationState)
    && Array.isArray(clarificationState.items)
    && clarificationState.items.some(item => isRecord(item) && item.status === 'pending')
}

function canConsumeSemanticFragment(state: SemanticState, clarificationState: unknown): boolean {
  const activeTarget = pickPendingClarificationTarget(readPendingClarificationItems(clarificationState))
  if (!activeTarget) {
    return true
  }

  const slotRef = findActiveOpenSlotRef(state, activeTarget)
  if (slotRef?.ownerKind === 'trigger'
    && (slotRef.slot.slotKey === ENTRY_TRIGGER_SLOT_KEY || slotRef.slot.slotKey === EXIT_TRIGGER_SLOT_KEY)
  ) {
    return true
  }

  return requestedTriggerPhaseFromClarificationItem(activeTarget) !== null
}

function fulfillSemanticFragment(
  state: SemanticState,
  patch: CodegenSemanticPatch,
  symbolResolver: MarketInstrumentSymbolResolverService,
  clarificationState?: unknown,
): SemanticOpenSlotAnswerResolverResult {
  const fragmentPatch = projectTypedRulesToFragmentPatch(patch)
  const patchTriggers = fragmentPatch.triggers ?? []
  const entryTriggers = patchTriggers.filter(trigger => trigger.phase === 'entry')
  const exitTriggers = patchTriggers.filter(trigger => trigger.phase === 'exit')
  const requestedPhases = readRequestedTriggerPhases(state, clarificationState)
  const fulfilledPhases: FulfilledTriggerPhase[] = []

  if (shouldFulfillTriggerPhase(state, 'entry', requestedPhases) && entryTriggers.some(isCompleteFragmentNode)) {
    fulfilledPhases.push('entry')
  }

  if (shouldFulfillTriggerPhase(state, 'exit', requestedPhases) && exitTriggers.some(isCompleteFragmentNode)) {
    fulfilledPhases.push('exit')
  }

  if (fulfilledPhases.length === 0) {
    return { consumed: false, nextState: state }
  }

  return {
    consumed: true,
    nextState: mergeFragmentPatch(state, fragmentPatch, fulfilledPhases, symbolResolver),
    answer: {},
    closedSlotKeys: fulfilledPhases.map(triggerPhaseSlotKey),
    closedSlots: fulfilledPhases.map(phase => ({
      slotKey: triggerPhaseSlotKey(phase),
      fieldPath: triggerPhaseFieldPath(phase),
    })),
  }
}

function readRequestedTriggerPhases(
  state: SemanticState,
  clarificationState: unknown,
): ReadonlySet<FulfilledTriggerPhase> | null {
  const activeTarget = pickPendingClarificationTarget(readPendingClarificationItems(clarificationState))
  if (!activeTarget) return null

  const slotRef = findActiveOpenSlotRef(state, activeTarget)
  if (slotRef?.ownerKind === 'trigger') {
    if (slotRef.slot.slotKey === ENTRY_TRIGGER_SLOT_KEY) return new Set(['entry'])
    if (slotRef.slot.slotKey === EXIT_TRIGGER_SLOT_KEY) return new Set(['exit'])
  }

  const phase = requestedTriggerPhaseFromClarificationItem(activeTarget)
  return phase ? new Set([phase]) : null
}

function requestedTriggerPhaseFromClarificationItem(item: PendingClarificationItemRef): FulfilledTriggerPhase | null {
  const field = String(item.field ?? '')
  const key = String(item.key ?? '')
  if (field === 'rules.entry' || key === 'rulesTree.entry' || key === 'rulesMainflow.missing_entry_rules') return 'entry'
  if (field === 'rules.exit' || key === 'rulesTree.exit' || key === 'rulesMainflow.missing_exit_rules') return 'exit'
  return null
}

function shouldFulfillTriggerPhase(
  state: SemanticState,
  phase: FulfilledTriggerPhase,
  requestedPhases: ReadonlySet<FulfilledTriggerPhase> | null,
): boolean {
  if (requestedPhases) return requestedPhases.has(phase)
  return hasOpenSlot(state, triggerPhaseSlotKey(phase))
}

function projectTypedRulesToFragmentPatch(patch: CodegenSemanticPatch): SemanticFragmentPatch {
  const rules = patch.rules
  if (!rules || rules.length === 0) return { contextSlots: patch.contextSlots }

  const triggers: FragmentNode[] = []
  const actions: FragmentNode[] = []
  for (const rule of rules) {
    for (const leaf of collectAtomLeaves(rule.condition)) {
      if (readAtomBucket(leaf.key) !== 'trigger') continue
      triggers.push({
        key: leaf.key,
        phase: rule.phase,
        sideScope: leaf.sideScope ?? rule.sideScope,
        params: leaf.params ?? {},
        ...ruleLeafEvidence(leaf),
      })
    }
    for (const effect of listRuleEffects(rule.effects)) {
      for (const leaf of collectAtomLeaves(effect)) {
        if (readAtomBucket(leaf.key) !== 'action') continue
        actions.push({
          key: leaf.key,
          phase: readLeafPhase(leaf) ?? rule.phase,
          params: leaf.params ?? {},
          ...ruleLeafEvidence(leaf),
        })
      }
    }
  }
  return {
    rules,
    contextSlots: patch.contextSlots,
    triggers: dedupeFragmentNodes(triggers),
    actions: dedupeFragmentNodes(actions),
  }
}

function readAtomBucket(key: string): string | undefined {
  return (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[key]?.bucket
}

function readLeafPhase(leaf: AtomExprAtom): SemanticRule['phase'] | null {
  const phase = leaf.params.phase
  return phase === 'entry' || phase === 'exit' || phase === 'gate' || phase === 'program' ? phase : null
}

function ruleLeafEvidence(leaf: AtomExprAtom): { evidence?: SemanticEvidence } {
  return leaf.evidence?.text
    ? { evidence: { text: leaf.evidence.text, source: 'user_explicit' } }
    : {}
}

function dedupeFragmentNodes<T extends { key: string, phase?: unknown, sideScope?: unknown, params?: unknown }>(nodes: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const node of nodes) {
    const signature = `${node.key}|${String(node.phase ?? '')}|${String(node.sideScope ?? '')}|${JSON.stringify(node.params ?? {})}`
    if (seen.has(signature)) continue
    seen.add(signature)
    out.push(node)
  }
  return out
}

function hasOpenSlot(state: SemanticState, slotKey: string): boolean {
  return rulesMainflowReader.readFacts(state).some(fact => fact.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
    || Boolean(state.position?.openSlots?.some(slot => slot.slotKey === slotKey && slot.status === 'open'))
}

function mergeFragmentPatch(
  state: SemanticState,
  patch: SemanticFragmentPatch,
  fulfilledPhases: readonly FulfilledTriggerPhase[],
  symbolResolver: MarketInstrumentSymbolResolverService,
): SemanticState {
  return {
    ...state,
    rules: [
      ...(state.rules ?? []),
      ...(patch.rules ?? []).filter(rule => ruleMatchesFulfilledPhases(rule, fulfilledPhases)),
    ],
    contextSlots: mergeFragmentContextSlots(state.contextSlots, patch.contextSlots, symbolResolver),
  }
}

function ruleMatchesFulfilledPhases(rule: SemanticRule, fulfilledPhases: readonly FulfilledTriggerPhase[]): boolean {
  if (rule.phase === 'gate') return fulfilledPhases.length > 0
  return fulfilledPhases.includes(rule.phase as FulfilledTriggerPhase)
}

function readTriggerStates(state: SemanticState): SemanticTriggerState[] {
  return rulesMainflowReader.readFactsByRole(state, 'condition').map(factToTriggerState)
}

function readActionStates(state: SemanticState): SemanticActionState[] {
  return rulesMainflowReader.readFactsByRole(state, 'action').map(factToActionState)
}

function factToTriggerState(fact: RulesMainflowAtomFact): SemanticTriggerState {
  return {
    id: fact.id,
    key: fact.key,
    phase: fact.phase === 'entry' || fact.phase === 'exit' || fact.phase === 'gate' ? fact.phase : 'gate',
    sideScope: fact.sideScope,
    params: { ...fact.params },
    status: fact.status,
    source: fact.source,
    ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: fact.source } } : {}),
    openSlots: [...fact.openSlots],
    ...optionalAtomContracts(fact),
  }
}

function factToActionState(fact: RulesMainflowAtomFact): SemanticActionState {
  return {
    id: fact.id,
    key: fact.key,
    params: { ...fact.params },
    status: fact.status,
    source: fact.source,
    ...(fact.evidenceText ? { evidence: { text: fact.evidenceText, source: fact.source } } : {}),
    openSlots: [...fact.openSlots],
    ...optionalAtomContracts(fact),
  }
}

function optionalAtomContracts(fact: RulesMainflowAtomFact): { contracts?: SemanticAtomContract[] } {
  const contracts = fact.contracts?.filter((contract): contract is SemanticAtomContract =>
    contract.kind === 'trigger' || contract.kind === 'action' || contract.kind === 'risk' || contract.kind === 'position' || contract.kind === 'context',
  )
  return contracts?.length ? { contracts: [...contracts] } : {}
}

function shouldMergeFragmentTrigger(
  trigger: FragmentNode,
  fulfilledPhases: ReadonlySet<FulfilledTriggerPhase>,
): trigger is FragmentNode & { phase: SemanticTriggerState['phase'] } {
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
  action: FragmentNode,
  fulfilledPhases: ReadonlySet<FulfilledTriggerPhase>,
): boolean {
  if (isFulfilledTriggerPhase(action.phase)) {
    return fulfilledPhases.has(action.phase)
  }
  // phase 未知（'risk'/'gate'/undefined）时保守保留，避免误过滤合法 action。
  return true
}

function isFulfilledTriggerPhase(phase: FragmentNode['phase']): phase is FulfilledTriggerPhase {
  return phase === 'entry' || phase === 'exit'
}

function triggerPhaseSlotKey(phase: FulfilledTriggerPhase): typeof ENTRY_TRIGGER_SLOT_KEY | typeof EXIT_TRIGGER_SLOT_KEY {
  return phase === 'entry' ? ENTRY_TRIGGER_SLOT_KEY : EXIT_TRIGGER_SLOT_KEY
}

function triggerPhaseFieldPath(phase: FulfilledTriggerPhase): 'triggers[entry]' | 'triggers[exit]' {
  return phase === 'entry' ? 'triggers[entry]' : 'triggers[exit]'
}

function isCompleteFragmentNode(node: FragmentNode): boolean {
  return !hasOpenStatusSlot(node.openSlots ?? [])
}

function resolveFragmentNodeStatus(node: FragmentNode): SemanticTriggerState['status'] {
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
  patchContextSlots: SemanticFragmentPatch['contextSlots'],
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

function readPendingClarificationItems(clarificationState: unknown): PendingClarificationItemRef[] {
  if (!isRecord(clarificationState) || !Array.isArray(clarificationState.items)) {
    return []
  }

  return clarificationState.items.filter((item): item is PendingClarificationItemRef => isRecord(item) && item.status === 'pending' && (
    typeof item.slotId === 'string'
    || (typeof item.slotKey === 'string' && typeof item.fieldPath === 'string')
    || requestedTriggerPhaseFromClarificationItem(item) !== null
  ))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
