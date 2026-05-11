/**
 * Multi-leg SemanticState fixtures for PR3test EC5.
 *
 * CASE_A: 两 leg 都携带 capital.allocate.per_order_budget capability（locked），
 *         sizing 守门应不追问任一腿的 position.sizing。
 *
 * CASE_B: leg-1 locked（含 capability），leg-2 缺 per_order_budget capability
 *         且 openSlots 显式标记 per_order_sizing open —— 守门只问 leg-2 缺的那一腿。
 */

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticState,
} from '../../../types/semantic-state'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function baseState(): SemanticState {
  return {
    version: 1,
    families: ['multi-leg'],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
  }
}

function makePerOrderBudgetCap(value: number): SemanticCapability {
  return {
    domain: 'capital',
    verb: 'allocate',
    object: 'per_order_budget',
    shape: { kind: 'quote', value, asset: 'USDT' },
  }
}

function makeLockedContract(id: string, capabilities: SemanticCapability[]): SemanticAtomContract {
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

function makeLockedLeg(opts: {
  id: string
  keyIndex: number
  value: number
}): SemanticActionState {
  return {
    id: opts.id,
    key: `action.buy_leg_${opts.keyIndex}`,
    status: 'locked' as const,
    source: 'user_explicit' as const,
    openSlots: [],
    contracts: [
      makeLockedContract(`contract-leg-${opts.id}`, [
        makePerOrderBudgetCap(opts.value),
      ]),
    ],
  }
}

function makeOpenLeg(opts: {
  id: string
  keyIndex: number
}): SemanticActionState {
  return {
    id: opts.id,
    key: `action.buy_leg_${opts.keyIndex}`,
    status: 'open' as const,
    source: 'derived' as const,
    openSlots: [
      {
        slotKey: `action.buy_leg_${opts.keyIndex}.per_order_sizing`,
        fieldPath: `actions[${opts.id}].params.sizing`,
        status: 'open' as const,
        priority: 'risk' as const,
        questionHint: `请确认第 ${opts.keyIndex} 腿每单仓位大小。`,
        affectsExecution: true,
      },
    ],
    contracts: [
      makeLockedContract(`contract-leg-${opts.id}`, []),
    ],
  }
}

// ---------------------------------------------------------------------------
// Public fixtures
// ---------------------------------------------------------------------------

/**
 * CASE_A: 两 leg 都 locked，各含 capital.allocate.per_order_budget capability。
 * leg-1 = 100 USDT，leg-2 = 200 USDT。
 * sizing 守门（PerTradeSizingResolver）识别双锚，不应产生 position.sizing open slot。
 */
export const MULTI_LEG_CASE_A: SemanticState = {
  ...baseState(),
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 100 }),
    makeLockedLeg({ id: 'leg-2', keyIndex: 2, value: 200 }),
  ],
}

/**
 * CASE_B: leg-1 locked（含 capability），leg-2 缺 per_order_budget capability，
 * 显式有 open slot 表示 per_order_sizing 未填。
 * 守门应只针对 leg-2 的缺口产生 open slot，不问 position.sizing，不追问 leg-1。
 */
export const MULTI_LEG_CASE_B: SemanticState = {
  ...baseState(),
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 100 }),
    makeOpenLeg({ id: 'leg-2', keyIndex: 2 }),
  ],
}
