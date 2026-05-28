/**
 * Fixture builders for PerTradeSizingResolver tests.
 *
 * Issue #1633 Stage3: SemanticState is rules-only. Executable sizing comes from
 * `state.rules[].effects` (action atoms carry `params.sizing`; position atoms carry
 * `params.perOrderSizing`) or from `state.position.sizing`. There are no flat
 * trigger/action/risk/positionConstraint buckets and no contract-backed capability
 * mounts for position constraints — the rules-only reader emits facts that are always
 * `locked` with empty `openSlots`, so action/position-constraint anchors cannot express
 * open status or partial slots (only `state.position` can, since it is a real node).
 */

import type {
  SemanticNodeStatus,
  SemanticPositionSizingContract,
  SemanticState,
} from '../../../types/semantic-state'
import type { AtomExpr, SemanticRule } from '../../../types/atom-expr'

type SizingUnit = 'quote' | 'base' | 'ratio' | 'risk_budget'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    position: null,
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
  }
}

/** Minimal valid predicate so the rules reader keeps the rule's leaves. */
const COND: AtomExpr = { kind: 'atom', key: 'price.threshold', params: { value: 1 } }

function sizingShape(unit: SizingUnit, value: number): Record<string, unknown> {
  switch (unit) {
    case 'quote':
      return { kind: 'quote', value, asset: 'USDT' }
    case 'base':
      return { kind: 'base', value, asset: 'BTC' }
    case 'ratio':
      return { kind: 'ratio', value }
    case 'risk_budget':
      return { kind: 'risk_budget', value }
  }
}

function entryRule(id: string, effects: SemanticRule['effects']): SemanticRule {
  return {
    id,
    phase: 'entry',
    sideScope: 'long',
    condition: COND,
    effects,
  }
}

function emptyEffects(): { actions: AtomExpr[]; risks: AtomExpr[]; positions: AtomExpr[]; orchestration: AtomExpr[]; programs: AtomExpr[] } {
  return { actions: [], risks: [], positions: [], orchestration: [], programs: [] }
}

// ---------------------------------------------------------------------------
// Scope-key helpers (rules-only fact ids encode the rule + effect path)
// ---------------------------------------------------------------------------

/** scope.id for an action effect leaf: `${ruleId}:rules-${ruleIndex}-effects-actions-${effectIndex}` */
export function actionScopeId(ruleId: string, ruleIndex = 0, effectIndex = 0): string {
  return `${ruleId}:rules-${ruleIndex}-effects-actions-${effectIndex}`
}

/** Full scope key for an action effect leaf. */
export function actionScopeKey(ruleId: string, ruleIndex = 0, effectIndex = 0): string {
  return `action:${actionScopeId(ruleId, ruleIndex, effectIndex)}`
}

// ---------------------------------------------------------------------------
// Public fixture builders
// ---------------------------------------------------------------------------

export function buildStateWithActionPerOrderBudget(opts: {
  actionId: string
  value: number
  unit: SizingUnit
}): SemanticState {
  const effects = emptyEffects()
  effects.actions = [{
    kind: 'atom',
    key: 'action.open_long',
    params: { sizing: sizingShape(opts.unit, opts.value) },
  }]
  return { ...baseState(), rules: [entryRule(opts.actionId, effects)] }
}

/** Action sizing from an explicit shape (e.g. percent-unit ratio). */
export function buildStateWithActionSizingShape(actionId: string, shape: Record<string, unknown>): SemanticState {
  const effects = emptyEffects()
  effects.actions = [{ kind: 'atom', key: 'action.open_long', params: { sizing: shape } }]
  return { ...baseState(), rules: [entryRule(actionId, effects)] }
}

export function buildStateWithDcaPerOrderSizing(opts: {
  ownerKey: 'position.dca_schedule'
  value: number
  unit: 'quote' | 'base'
}): SemanticState {
  const effects = emptyEffects()
  effects.positions = [{
    kind: 'atom',
    key: opts.ownerKey,
    params: { perOrderSizing: sizingShape(opts.unit, opts.value) },
  }]
  return { ...baseState(), rules: [entryRule('dca-rule', effects)] }
}

export function buildStateWithChecklistPositionPct(_opts: {
  positionPct: number
}): { state: SemanticState; checklist: { riskRules: { positionPct: number } } } {
  return {
    state: baseState(),
    checklist: { riskRules: { positionPct: _opts.positionPct } },
  }
}

export function buildMultiLegState(opts: {
  legs: Array<{ actionId: string; value: number; unit: 'quote' | 'base' }>
}): SemanticState {
  const rules: SemanticRule[] = opts.legs.map((leg) => {
    const effects = emptyEffects()
    effects.actions = [{
      kind: 'atom',
      key: 'action.open_long',
      params: { sizing: sizingShape(leg.unit, leg.value) },
    }]
    return entryRule(leg.actionId, effects)
  })
  return { ...baseState(), rules }
}

export function buildEmptyState(): SemanticState {
  return baseState()
}

export function buildAmbiguousSizingState(): SemanticState {
  // Open position with no sizing contract and no rules → resolver returns empty map.
  return {
    ...baseState(),
    position: {
      mode: 'long',
      value: 0,
      positionMode: 'one_way',
      status: 'open',
      source: 'inferred',
    },
  }
}

export function buildStateWithPositionSizing(opts: {
  sizing: SemanticPositionSizingContract
  status?: SemanticNodeStatus
  hasOpenSlots?: boolean
}): SemanticState {
  const status = opts.status ?? ('locked' as const)
  const openSlots = opts.hasOpenSlots
    ? [{
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
        status: 'open' as const,
        priority: 'risk' as const,
        questionHint: '请确认仓位大小。',
        affectsExecution: true,
      }]
    : []

  return {
    ...baseState(),
    position: {
      mode: 'long',
      value: 0,
      positionMode: 'one_way',
      status,
      source: 'user_explicit',
      sizing: opts.sizing,
      openSlots,
    },
  }
}

export function buildStateWithActionAndConstraint(opts: {
  actionId: string
  actionValue: number
  actionUnit: SizingUnit
  constraintKey: 'position.dca_schedule'
  constraintValue: number
  constraintUnit: 'quote' | 'base'
}): SemanticState {
  const effects = emptyEffects()
  effects.actions = [{
    kind: 'atom',
    key: 'action.open_long',
    params: { sizing: sizingShape(opts.actionUnit, opts.actionValue) },
  }]
  effects.positions = [{
    kind: 'atom',
    key: opts.constraintKey,
    params: { perOrderSizing: sizingShape(opts.constraintUnit, opts.constraintValue) },
  }]
  return { ...baseState(), rules: [entryRule(opts.actionId, effects)] }
}
