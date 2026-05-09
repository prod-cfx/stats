import type { SemanticAtomContract, SemanticRiskState, SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'

import type {
  NormalizedTriggerAtom,
  StrategyNormalizedIntent,
} from '../types/strategy-normalized-intent'
import { createHash } from 'node:crypto'

type TriggerCombinationJoin = 'AND' | 'OR'

interface BuildTriggerCombinationContractInput {
  groupId: string
  join?: TriggerCombinationJoin
  role?: string
  phase: SemanticTriggerState['phase']
  sideScope?: SemanticTriggerState['sideScope']
  actionKey?: string
  actionKeySource?: 'default' | 'explicit'
}

/**
 * Legacy adapter: projects SemanticState into StrategyNormalizedIntent for compatibility paths.
 * New semantic mainline code should build canonical specs from SemanticState contracts directly.
 */
export function buildNormalizedIntentFromSemanticState(state: SemanticState): StrategyNormalizedIntent {
  const normalizedState = normalizeSemanticStateCombinationContracts(state)
  const normalizedTriggers = normalizedState.triggers
  const families = new Set(normalizedState.families)
  if (normalizedTriggers.some(trigger => trigger.phase === 'gate')) {
    families.add('state-gated')
  }
  const grid = buildGridIntent(normalizedTriggers)

  return {
    families: Array.from(families) as StrategyNormalizedIntent['families'],
    triggers: normalizedTriggers
      .filter(trigger => trigger.status !== 'superseded')
      .map(trigger => toNormalizedTrigger(trigger)),
    actions: normalizedState.actions.map(action => ({
      key: action.key,
      ...(action.params ? { params: { ...action.params } } : {}),
    })),
    risk: normalizedState.risk.map(risk => ({
      key: risk.key,
      params: { ...risk.params },
    })),
    position: normalizedState.position
      ? {
          mode: normalizedState.position.mode as StrategyNormalizedIntent['position']['mode'],
          value: normalizedState.position.value,
          positionMode: normalizedState.position.positionMode as StrategyNormalizedIntent['position']['positionMode'],
        }
      : null,
    ...(grid ? { grid } : {}),
    unresolved: [],
    normalizationNotes: [...normalizedState.normalizationNotes],
  }
}

function buildGridIntent(
  triggers: SemanticTriggerState[],
): StrategyNormalizedIntent['grid'] {
  const activeGrid = triggers.find(trigger =>
    trigger.key === 'grid.range_rebalance'
    && trigger.status !== 'superseded'
    && typeof trigger.params.rangeLower === 'number'
    && typeof trigger.params.rangeUpper === 'number'
    && typeof trigger.params.stepPct === 'number',
  )
  if (!activeGrid) {
    return null
  }

  return {
    family: 'grid.range_rebalance',
    range: {
      lower: activeGrid.params.rangeLower as number,
      upper: activeGrid.params.rangeUpper as number,
    },
    stepPct: activeGrid.params.stepPct as number,
    sideMode: (activeGrid.params.sideMode as StrategyNormalizedIntent['grid']['sideMode']) ?? 'bidirectional',
    recycle: activeGrid.params.recycle !== false,
    ...(activeGrid.params.breakoutAction === 'pause' || activeGrid.params.breakoutAction === 'continue'
      ? { breakoutAction: activeGrid.params.breakoutAction }
      : {}),
  }
}

export function buildTriggerCombinationContract(
  input: BuildTriggerCombinationContractInput,
): SemanticAtomContract {
  const join = input.join ?? 'AND'
  const role = input.role ?? 'member'
  const sideScope = input.sideScope ?? 'long'
  const actionKey = input.actionKey ?? defaultTriggerCombinationActionKey(input.phase, sideScope)
  const actionKeySource = input.actionKeySource ?? (input.actionKey ? 'explicit' : 'default')
  const actionBinding = 'single_action'
  const shape = {
    groupId: input.groupId,
    join,
    role,
    actionKey,
    actionKeySource,
    actionBinding,
    phase: input.phase,
    sideScope,
  }

  return {
    id: `contract-trigger-combination-${slugifyContractId(input.groupId)}`,
    kind: 'trigger',
    capabilities: [{
      domain: 'market',
      verb: 'combine',
      object: 'predicate_group',
      shape,
    }],
    requires: [],
    params: {
      groupId: input.groupId,
      join,
      role,
      actionKey,
      actionKeySource,
      actionBinding,
      phase: input.phase,
      sideScope,
    },
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
}

export function isTriggerPredicateGroupContract(contract: SemanticAtomContract): boolean {
  return contract.kind === 'trigger'
    && contract.capabilities.some(capability =>
      capability.domain === 'market'
      && capability.verb === 'combine'
      && capability.object === 'predicate_group',
    )
}

export function normalizeTriggerCombinationContracts(
  triggers: SemanticTriggerState[],
): SemanticTriggerState[] {
  return triggers.map(trigger =>
    normalizeConditionSequenceTrigger(
      normalizeTriggerCombinationContract(normalizePreviousExtremaMemoryKey(trigger)),
    ),
  )
}

// Phase 3 MVP — price.previous_extrema 缺 memoryKey 时仿 risk.partial_take_profit 模式以
// hash 自动补齐：使 contract substrate 的 state.write 始终成立、避免上层 readiness 因为
// "memoryKey 必填"在用户不显式给名时把 atom 卡在 supported_requires_slot；hash 输入只引用
// 与"哪个 remembered level"语义直接相关的 kind/lookback/sourceText，确保等价 trigger 复用同一
// memoryKey（cross-atom remembered level 复用前置）。仅在 trigger.key === 'price.previous_extrema'
// 且 memoryKey 缺失时介入，避免污染其他 trigger 流程。
function normalizePreviousExtremaMemoryKey(trigger: SemanticTriggerState): SemanticTriggerState {
  if (trigger.key !== 'price.previous_extrema') return trigger
  const params = trigger.params ?? {}
  if (typeof params.memoryKey === 'string' && params.memoryKey.trim().length > 0) return trigger
  const kind = typeof params.kind === 'string' ? params.kind : ''
  const lookback = typeof params.lookback === 'number' ? params.lookback : ''
  const sourceText = typeof params.sourceText === 'string' ? params.sourceText : ''
  const hash = createHash('sha256')
    .update(`${kind}|${lookback}|${sourceText}`)
    .digest('hex')
    .slice(0, 16)
  return {
    ...trigger,
    params: { ...params, memoryKey: `previous_extrema_${hash}` },
  }
}

/**
 * Normalize `condition.sequence` triggers for cache/hash key stability.
 *
 * Behaviors:
 * - If `params.memoryKey` is not a non-empty string, auto-generate one based
 *   on a canonical, key-sorted JSON of the relevant params (sequenceKind,
 *   steps, lookbackWindow, threshold, count, direction, lookbackBars, reference).
 *   `steps` are treated as ordered (no resort) but each step's keys are sorted
 *   to make equivalent rewrites collapse to the same hash.
 * - Equivalent rewrites: omitted optional fields equal explicit `undefined`
 *   (already excluded). Empty-string `lookbackWindow` is treated as absent.
 * - User-explicit `memoryKey` always wins.
 */
export function normalizeConditionSequenceTrigger(trigger: SemanticTriggerState): SemanticTriggerState {
  if (trigger.key !== 'condition.sequence') return trigger

  const params = trigger.params as Record<string, unknown>
  const sequenceKind = readString(params.sequenceKind)
  if (!sequenceKind) return trigger

  if (typeof params.memoryKey === 'string' && params.memoryKey.trim().length > 0) {
    return trigger
  }

  const hashInput: Record<string, unknown> = { sequenceKind }
  const lookbackWindow = readString(params.lookbackWindow)
  if (lookbackWindow) hashInput.lookbackWindow = lookbackWindow
  if (typeof params.threshold === 'number' && Number.isFinite(params.threshold)) {
    hashInput.threshold = params.threshold
  }
  if (typeof params.count === 'number' && Number.isFinite(params.count)) {
    hashInput.count = params.count
  }
  const direction = readString(params.direction)
  if (direction) hashInput.direction = direction
  if (typeof params.lookbackBars === 'number' && Number.isFinite(params.lookbackBars)) {
    hashInput.lookbackBars = params.lookbackBars
  }
  if (params.reference && typeof params.reference === 'object') {
    hashInput.reference = canonicalize(params.reference)
  }
  if (Array.isArray(params.steps)) {
    hashInput.steps = params.steps.map(step => canonicalize(step))
  }

  const json = JSON.stringify(hashInput)
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16)

  return {
    ...trigger,
    params: { ...trigger.params, memoryKey: `condseq_${hash}` },
    openSlots: [...trigger.openSlots],
    ...(trigger.contracts ? { contracts: [...trigger.contracts] } : {}),
  }
}

/**
 * Canonicalize an arbitrary value for hashing: sort object keys recursively,
 * preserve array order, drop `undefined` properties.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => canonicalize(item))
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonicalize(v)] as const)
    return Object.fromEntries(entries)
  }
  return value
}

export function normalizeSemanticStateCombinationContracts(state: SemanticState): SemanticState {
  return {
    ...state,
    families: [...state.families],
    triggers: normalizeTriggerCombinationContracts(state.triggers),
    actions: state.actions.map(action => ({
      ...action,
      ...(action.params ? { params: { ...action.params } } : {}),
      ...(action.openSlots ? { openSlots: [...action.openSlots] } : {}),
      ...(action.contracts ? { contracts: [...action.contracts] } : {}),
    })),
    risk: state.risk.map(risk => ({
      ...risk,
      params: { ...risk.params },
      openSlots: [...risk.openSlots],
      ...(risk.contracts ? { contracts: [...risk.contracts] } : {}),
    })),
    position: state.position
      ? {
          ...state.position,
          ...(state.position.openSlots ? { openSlots: [...state.position.openSlots] } : {}),
          ...(state.position.contracts ? { contracts: [...state.position.contracts] } : {}),
        }
      : null,
    contextSlots: { ...state.contextSlots },
    normalizationNotes: [...state.normalizationNotes],
  }
}

export function normalizeTriggerCombinationContract(trigger: SemanticTriggerState): SemanticTriggerState {
  if (trigger.contracts?.some(contract => isCombinationLikeContract(contract))) {
    return {
      ...trigger,
      params: { ...trigger.params },
      openSlots: [...trigger.openSlots],
      contracts: trigger.contracts.map(contract =>
        isCombinationLikeContract(contract)
          ? upgradeTriggerCombinationContract(trigger, contract)
          : contract,
      ),
    }
  }

  const groupId = readFirstString(trigger.params, [
    'groupId',
    'semanticGroupId',
    'logicalGroupId',
    'combinationId',
    'atomicCombinationId',
  ])
  if (!groupId) {
    return {
      ...trigger,
      params: { ...trigger.params },
      openSlots: [...trigger.openSlots],
      ...(trigger.contracts ? { contracts: [...trigger.contracts] } : {}),
    }
  }

  const join = readFirstJoin(trigger.params, ['join', 'logic', 'operator', 'conditionOperator']) ?? 'AND'
  const explicitActionKey = readString(trigger.params.actionKey)
  const role = readString(trigger.params.role) ?? 'member'
  const combinationContract = buildTriggerCombinationContract({
    groupId,
    join,
    role,
    phase: trigger.phase,
    sideScope: trigger.sideScope,
    ...(explicitActionKey ? { actionKey: explicitActionKey } : {}),
  })

  return {
    ...trigger,
    params: { ...trigger.params },
    openSlots: [...trigger.openSlots],
    contracts: [...(trigger.contracts ?? []), combinationContract],
  }
}

function upgradeTriggerCombinationContract(
  trigger: SemanticTriggerState,
  contract: SemanticAtomContract,
): SemanticAtomContract {
  const groupId = readString(contract.params.groupId)
    ?? readFirstString(trigger.params, [
      'groupId',
      'semanticGroupId',
      'logicalGroupId',
      'combinationId',
      'atomicCombinationId',
    ])
  if (!groupId) return contract

  const sideScope = trigger.sideScope ?? 'long'
  const join = readJoin(contract.params.join)
    ?? readFirstJoin(trigger.params, ['join', 'logic', 'operator', 'conditionOperator'])
    ?? 'AND'
  const role = readString(contract.params.role) ?? readString(trigger.params.role) ?? 'member'
  const contractActionKeySource = readString(contract.params.actionKeySource)
  const contractActionKey = readString(contract.params.actionKey)
  const explicitActionKey = contractActionKeySource !== 'default'
    ? (contractActionKey ?? readString(trigger.params.actionKey))
    : readString(trigger.params.actionKey)
  const standard = buildTriggerCombinationContract({
    groupId,
    join,
    role,
    phase: trigger.phase,
    sideScope,
    ...(explicitActionKey ? { actionKey: explicitActionKey } : {}),
  })

  return {
    ...contract,
    capabilities: isTriggerPredicateGroupContract(contract)
      ? [...contract.capabilities]
      : [...contract.capabilities, ...standard.capabilities],
    requires: [...contract.requires],
    params: {
      ...contract.params,
      ...standard.params,
    },
    ...(contract.effects ? { effects: [...contract.effects] } : {}),
  }
}

function toNormalizedTrigger(trigger: SemanticTriggerState): NormalizedTriggerAtom {
  const confirmationMode = typeof trigger.params.confirmationMode === 'string'
    ? trigger.params.confirmationMode
    : null
  const unresolvedSlots = trigger.openSlots.map(slot => toUnresolvedSlot(slot))

  return {
    key: trigger.key as NormalizedTriggerAtom['key'],
    phase: trigger.phase,
    ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
    params: { ...trigger.params } as NormalizedTriggerAtom['params'],
    ...(confirmationMode === 'touch'
      || confirmationMode === 'close_confirm'
      || confirmationMode === 'ambiguous_touch_or_close_confirm'
      ? { resolutionHints: { confirmation: confirmationMode } }
      : {}),
    closureStatus: trigger.status === 'locked' && unresolvedSlots.length === 0 ? 'closed' : 'open',
    unresolvedSlots,
    ...(trigger.evidence?.text ? { evidenceText: trigger.evidence.text } : {}),
  }
}

function toUnresolvedSlot(slot: SemanticSlotState): NormalizedTriggerAtom['unresolvedSlots'][number] {
  return {
    slotKey: slot.slotKey,
    fieldPath: slot.fieldPath,
    reason: 'missing_definition',
    questionHint: slot.questionHint,
    priority: slot.priority,
    affectsExecution: slot.affectsExecution,
    ...(slot.evidence?.text ? { evidenceText: slot.evidence.text } : {}),
  }
}

const RISK_BASIS_OPEN_SLOT_PATTERN = /(?:^|\.)(?:basis|stopLossBasis|takeProfitBasis)$/u
const RISK_BASIS_SLOT_KEYS = new Set([
  'risk.stopLossBasis',
  'risk.takeProfitBasis',
  'risk.stopLoss.basis',
  'risk.takeProfit.basis',
  'risk.stop_loss_pct.basis',
  'risk.take_profit_pct.basis',
])

export function normalizeRiskSemantics(risks: SemanticRiskState[]): SemanticRiskState[] {
  return risks.map((risk, index) => normalizeRiskSemantic(risk, index))
}

export function normalizeRiskSemantic(risk: SemanticRiskState, index = 0): SemanticRiskState {
  const params = { ...risk.params }
  const isStopLoss = risk.key === 'risk.stop_loss_pct'
  const isTakeProfit = risk.key === 'risk.take_profit_pct'

  if (!isStopLoss && !isTakeProfit) {
    if (risk.key === 'risk.condition_expression') {
      return {
        ...risk,
        params: {
          capabilityStatus: 'recognized_unsupported',
          ...params,
        },
        openSlots: risk.openSlots.filter(slot => !isRiskBasisOpenSlot(slot.slotKey, slot.fieldPath)),
      }
    }

    if (risk.key === 'risk.partial_take_profit' && typeof params.memoryKey !== 'string') {
      const rawTiers = Array.isArray(params.tiers) ? params.tiers : []
      // Sort by trigger.threshold so equivalent tier sets — regardless of LLM
      // insertion order — produce identical memoryKey and reuse runtime state.
      const sortedTiers = [...rawTiers].sort((a, b) => {
        const ta = typeof (a as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
          ? (a as { trigger: { threshold: number } }).trigger.threshold
          : 0
        const tb = typeof (b as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
          ? (b as { trigger: { threshold: number } }).trigger.threshold
          : 0
        return ta - tb
      })
      const tiersJson = JSON.stringify(sortedTiers)
      const sourceText = typeof params.sourceText === 'string' ? params.sourceText : ''
      const hash = createHash('sha256').update(`${tiersJson}|${sourceText}`).digest('hex').slice(0, 16)
      return {
        ...risk,
        params: { ...params, memoryKey: `partial_tp_${hash}` },
        openSlots: [...risk.openSlots],
      }
    }

    return {
      ...risk,
      params,
      openSlots: [...risk.openSlots],
    }
  }

  if (typeof params.direction !== 'string') {
    params.direction = isStopLoss ? 'loss' : 'profit'
  }

  if (typeof params.basis !== 'string') {
    params.basis = 'entry_avg_price'
  }

  if (params.basis === 'position_pnl' && params.basisSource == null) {
    params.basisSource = 'user_explicit'
  }

  if (params.basis === 'entry_avg_price' && params.basisSource == null) {
    params.basisSource = 'system_default'
  }

  if (typeof params.effect !== 'string') {
    params.effect = 'close_position'
  }

  if (typeof params.scope !== 'string') {
    params.scope = 'current_position'
  }

  const openSlots = risk.openSlots.filter(slot => !isRiskBasisOpenSlot(slot.slotKey, slot.fieldPath))
  const status = risk.status !== 'superseded'
    && typeof params.valuePct === 'number'
    && Number.isFinite(params.valuePct)
    && params.valuePct > 0
    && openSlots.length === 0
    ? 'locked'
    : risk.status

  return {
    ...risk,
    id: risk.id || `normalized-risk-${index + 1}`,
    params,
    status,
    openSlots,
  }
}

function isRiskBasisOpenSlot(slotKey: string, fieldPath: string): boolean {
  return RISK_BASIS_SLOT_KEYS.has(slotKey) || RISK_BASIS_OPEN_SLOT_PATTERN.test(fieldPath)
}

function isCombinationLikeContract(contract: SemanticAtomContract): boolean {
  return isTriggerPredicateGroupContract(contract)
    || (
      contract.kind === 'trigger'
      && contract.capabilities.length === 0
      && readString(contract.params.groupId) !== null
    )
}

function readFirstString(params: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = readString(params[key])
    if (value) return value
  }

  return null
}

function readFirstJoin(params: Record<string, unknown>, keys: readonly string[]): TriggerCombinationJoin | null {
  for (const key of keys) {
    const value = readJoin(params[key])
    if (value) return value
  }

  return null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readJoin(value: unknown): TriggerCombinationJoin | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toUpperCase()
  return normalized === 'AND' || normalized === 'OR' ? normalized : null
}

function defaultTriggerCombinationActionKey(
  phase: SemanticTriggerState['phase'],
  sideScope: SemanticTriggerState['sideScope'] = 'long',
): string {
  const side = sideScope === 'short' ? 'short' : 'long'
  return phase === 'exit' ? `close_${side}` : `open_${side}`
}

function slugifyContractId(value: string): string {
  return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'combination'
}
