/**
 * Fixture builders for PerTradeSizingResolver tests (PR2) and downstream (PR3).
 *
 * All fixtures construct minimal but type-valid SemanticState objects.
 * Use `as const` for literal status values per codebase convention (PR1 critic Minor m3).
 */

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticNodeStatus,
  SemanticPositionConstraintState,
  SemanticPositionSizingContract,
  SemanticState,
} from '../../../types/semantic-state'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
  }
}

function makePerOrderBudgetCapability(
  value: number,
  unitOrKind: 'quote' | 'base' | 'ratio' | 'risk_budget',
): SemanticCapability {
  const shape: Record<string, unknown> = { value, kind: unitOrKind }
  if (unitOrKind === 'quote') {
    shape['asset'] = 'USDT'
  }
  else if (unitOrKind === 'base') {
    shape['asset'] = 'BTC'
  }

  return {
    domain: 'capital',
    verb: 'allocate',
    object: 'per_order_budget',
    shape,
  }
}

function makeContract(id: string, capabilities: SemanticCapability[]): SemanticAtomContract {
  return {
    id,
    kind: 'action',
    capabilities,
    requires: [],
    params: {},
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
}

// ---------------------------------------------------------------------------
// Public fixture builders
// ---------------------------------------------------------------------------

export function buildStateWithActionPerOrderBudget(opts: {
  actionId: string
  value: number
  unit: 'quote' | 'base' | 'ratio' | 'risk_budget'
  status?: SemanticNodeStatus
  hasOpenSlots?: boolean
}): SemanticState {
  const status = opts.status ?? ('locked' as const)
  const openSlots = opts.hasOpenSlots
    ? [{
        slotKey: 'action.buy.sizing',
        fieldPath: 'actions[0].params.sizing',
        status: 'open' as const,
        priority: 'risk' as const,
        questionHint: '请确认每单仓位大小。',
        affectsExecution: true,
      }]
    : []

  const action: SemanticActionState = {
    id: opts.actionId,
    key: 'action.buy',
    status,
    source: 'user_explicit' as const,
    openSlots,
    contracts: [
      makeContract(`contract-action-${opts.actionId}`, [
        makePerOrderBudgetCapability(opts.value, opts.unit),
      ]),
    ],
  }

  return {
    ...baseState(),
    actions: [action],
  }
}

export function buildStateWithDcaPerOrderSizing(opts: {
  ownerKey: 'position.dca_schedule'
  /** Value used for both capability shape and params when viaCapability=false, or params when viaCapability=true and paramsValue not provided */
  value: number
  unit: 'quote' | 'base'
  viaCapability: boolean
  status?: SemanticNodeStatus
  hasOpenSlots?: boolean
  /** Override capability shape value independently (only relevant when viaCapability=true) */
  capabilityValue?: number
  /** Override params.perOrderSizing.value independently */
  paramsValue?: number
}): SemanticState {
  const status = opts.status ?? ('locked' as const)
  const openSlots = opts.hasOpenSlots
    ? [{
        slotKey: 'position.dca_schedule.per_order_sizing',
        fieldPath: 'position.constraints[position.dca_schedule].params.perOrderSizing',
        status: 'open' as const,
        priority: 'risk' as const,
        questionHint: '请确认每次 DCA 补仓多少。',
        affectsExecution: true,
      }]
    : []

  const capValue = opts.capabilityValue ?? opts.value
  const paramsVal = opts.paramsValue ?? opts.value

  function makeShape(value: number): Record<string, unknown> {
    return opts.unit === 'quote'
      ? { kind: 'quote', value, asset: 'USDT' }
      : { kind: 'base', value, asset: 'BTC' }
  }

  const capabilityShape = makeShape(capValue)
  const paramsShape = makeShape(paramsVal)

  const contracts: SemanticAtomContract[] = opts.viaCapability
    ? [
        {
          id: `contract-dca-${opts.ownerKey}`,
          kind: 'position',
          capabilities: [
            {
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: capabilityShape,
            },
          ],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        },
      ]
    : []

  const constraint: SemanticPositionConstraintState = {
    id: `pc-${opts.ownerKey}`,
    key: opts.ownerKey,
    params: { perOrderSizing: paramsShape },
    status,
    source: 'user_explicit' as const,
    openSlots,
    contracts,
  }

  return {
    ...baseState(),
    position: {
      mode: 'long',
      value: 0,
      positionMode: 'one_way',
      status: 'locked' as const,
      source: 'user_explicit' as const,
      constraints: [constraint],
    },
  }
}

export function buildStateWithChecklistPositionPct(opts: {
  positionPct: number
}): { state: SemanticState; checklist: { riskRules: { positionPct: number } } } {
  return {
    state: baseState(),
    checklist: { riskRules: { positionPct: opts.positionPct } },
  }
}

export function buildMultiLegState(opts: {
  legs: Array<{ actionId: string; value: number; unit: 'quote' | 'base' }>
}): SemanticState {
  const actions: SemanticActionState[] = opts.legs.map((leg, idx) => ({
    id: leg.actionId,
    key: `action.buy_leg_${idx + 1}`,
    status: 'locked' as const,
    source: 'user_explicit' as const,
    openSlots: [],
    contracts: [
      makeContract(`contract-leg-${leg.actionId}`, [
        makePerOrderBudgetCapability(leg.value, leg.unit),
      ]),
    ],
  }))

  return {
    ...baseState(),
    actions,
  }
}

export function buildEmptyState(): SemanticState {
  return baseState()
}

export function buildAmbiguousSizingState(): SemanticState {
  // State that has text evidence but no parseable sizing values — resolver should return empty map
  return {
    ...baseState(),
    position: {
      mode: 'long',
      value: 0,
      positionMode: 'one_way',
      status: 'open' as const,
      source: 'inferred' as const,
      // No sizing contract; open status means not locked => unanchored
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
      source: 'user_explicit' as const,
      sizing: opts.sizing,
      openSlots,
    },
  }
}

export function buildStateWithActionAndConstraint(opts: {
  actionId: string
  actionValue: number
  actionUnit: 'quote' | 'base' | 'ratio' | 'risk_budget'
  constraintKey: 'position.dca_schedule'
  constraintValue: number
  constraintUnit: 'quote' | 'base'
  constraintViaCapability: boolean
}): SemanticState {
  if (opts.constraintUnit === ('ratio' as unknown as string)) {
    throw new Error('ratio is not supported as constraintUnit in buildStateWithActionAndConstraint — use constraintUnit: \'quote\' | \'base\' or build the state manually')
  }

  const actionState = buildStateWithActionPerOrderBudget({
    actionId: opts.actionId,
    value: opts.actionValue,
    unit: opts.actionUnit,
  })

  const constraintState = buildStateWithDcaPerOrderSizing({
    ownerKey: opts.constraintKey,
    value: opts.constraintValue,
    unit: opts.constraintUnit,
    viaCapability: opts.constraintViaCapability,
  })

  return {
    ...actionState,
    position: constraintState.position,
  }
}
