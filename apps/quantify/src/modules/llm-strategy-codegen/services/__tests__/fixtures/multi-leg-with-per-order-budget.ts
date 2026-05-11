/**
 * Multi-leg SemanticState fixtures.
 *
 * CASE_A: 两 leg 都携带 capital.allocate.per_order_budget capability（locked），
 *         sizing 守门应不追问任一腿的 position.sizing。
 *
 * CASE_B: leg-1 locked（含 capability），leg-2 缺 per_order_budget capability
 *         且 openSlots 显式标记 per_order_sizing open —— 守门只问 leg-2 缺的那一腿。
 *
 * #1186 PR2 (decision 4 — 路 A): 扩 CASE_A/CASE_B 加 state.orchestration.nodes 的
 *         scope.leg 节点（含 legId/direction/instrumentRef）+ isMultiLeg=true，
 *         以触发 canonical-spec-builder 的多锚反填路径。新增 4 cases：
 *         - HETERO_AXIS    leg-A quote / leg-B ratio
 *         - BASE_QTY       leg 用 base_qty axis（fixed_base mode 哨兵）
 *         - RISK_BUDGET    leg 用 risk_budget axis（skip+warn 哨兵）
 *         - WITH_GRID_PROGRAM  isMultiLeg + grid orderProgram 互斥触发
 */

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticOrchestrationNode,
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

function makePerOrderBudgetCap(value: number, unit: 'quote' | 'base' | 'ratio' | 'risk_budget' = 'quote', asset?: string): SemanticCapability {
  if (unit === 'quote') {
    return {
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
      shape: { kind: 'quote', value, asset: asset ?? 'USDT' },
    }
  }
  if (unit === 'base') {
    return {
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
      shape: { kind: 'base', value, asset: asset ?? 'BTC' },
    }
  }
  if (unit === 'ratio') {
    return {
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
      shape: { kind: 'ratio', value, unit: 'ratio' },
    }
  }
  return {
    domain: 'capital',
    verb: 'allocate',
    object: 'per_order_budget',
    shape: { kind: 'risk_budget', value },
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
  unit?: 'quote' | 'base' | 'ratio' | 'risk_budget'
  asset?: string
}): SemanticActionState {
  return {
    id: opts.id,
    key: `action.buy_leg_${opts.keyIndex}`,
    status: 'locked' as const,
    source: 'user_explicit' as const,
    openSlots: [],
    contracts: [
      makeLockedContract(`contract-leg-${opts.id}`, [
        makePerOrderBudgetCap(opts.value, opts.unit, opts.asset),
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

/**
 * #1186 PR2 (decision 4 — 路 A): 构造 scope.leg orchestration node。
 * legId 与 actionId 显式映射 — actionId 即 legId（fixture 约束）。
 * scope.symbol orchestration node 由 fixture 提供（locked），instrumentRef 引用其 id。
 */
function makeSymbolScopeNode(symbol: string): SemanticOrchestrationNode {
  return {
    id: `scope-symbol-${symbol.toLowerCase()}`,
    kind: 'scope',
    key: 'scope.symbol',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    symbolScopeKind: 'symbol',
    symbols: [symbol],
    primarySymbol: symbol,
  }
}

function makeLegScopeNode(opts: {
  legId: string
  direction: 'long' | 'short'
  instrumentRef: string
}): SemanticOrchestrationNode {
  return {
    id: `scope-leg-${opts.legId}`,
    kind: 'scope',
    key: 'scope.leg',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    legScopeKind: 'leg',
    legId: opts.legId,
    direction: opts.direction,
    instrumentRef: opts.instrumentRef,
  }
}

// ---------------------------------------------------------------------------
// Public fixtures
// ---------------------------------------------------------------------------

const SYMBOL_NODE = makeSymbolScopeNode('BTCUSDT')

/**
 * CASE_A: 两 leg 都 locked，各含 capital.allocate.per_order_budget capability。
 * leg-1 = 100 USDT，leg-2 = 200 USDT。
 * 双 leg orchestration scope node + isMultiLeg=true → builder 多锚反填路径触发。
 */
export const MULTI_LEG_CASE_A: SemanticState = {
  ...baseState(),
  isMultiLeg: true,
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 100 }),
    makeLockedLeg({ id: 'leg-2', keyIndex: 2, value: 200 }),
  ],
  orchestration: {
    nodes: [
      SYMBOL_NODE,
      makeLegScopeNode({ legId: 'leg-1', direction: 'long', instrumentRef: SYMBOL_NODE.id }),
      makeLegScopeNode({ legId: 'leg-2', direction: 'short', instrumentRef: SYMBOL_NODE.id }),
    ],
    contracts: [],
  },
}

/**
 * CASE_B: leg-1 locked（含 capability），leg-2 缺 per_order_budget capability。
 * 守门应只针对 leg-2 的缺口产生 open slot；orchestration 仍声明双 leg。
 */
export const MULTI_LEG_CASE_B: SemanticState = {
  ...baseState(),
  isMultiLeg: true,
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 100 }),
    makeOpenLeg({ id: 'leg-2', keyIndex: 2 }),
  ],
  orchestration: {
    nodes: [
      SYMBOL_NODE,
      makeLegScopeNode({ legId: 'leg-1', direction: 'long', instrumentRef: SYMBOL_NODE.id }),
      makeLegScopeNode({ legId: 'leg-2', direction: 'short', instrumentRef: SYMBOL_NODE.id }),
    ],
    contracts: [],
  },
}

/** axis 异构：leg-A quote 100 USDT + leg-B ratio 0.1（10%）→ fixed_quote / fixed_pct 共存 */
export const MULTI_LEG_CASE_HETERO_AXIS: SemanticState = {
  ...baseState(),
  isMultiLeg: true,
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 100, unit: 'quote' }),
    makeLockedLeg({ id: 'leg-2', keyIndex: 2, value: 0.1, unit: 'ratio' }),
  ],
  orchestration: {
    nodes: [
      SYMBOL_NODE,
      makeLegScopeNode({ legId: 'leg-1', direction: 'long', instrumentRef: SYMBOL_NODE.id }),
      makeLegScopeNode({ legId: 'leg-2', direction: 'short', instrumentRef: SYMBOL_NODE.id }),
    ],
    contracts: [],
  },
}

/** base_qty 哨兵：leg 用 base axis 0.001 BTC → fixed_base mode + asset='BTC'；禁止静默归 fixed_quote */
export const MULTI_LEG_CASE_BASE_QTY: SemanticState = {
  ...baseState(),
  isMultiLeg: true,
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 0.001, unit: 'base', asset: 'BTC' }),
    makeLockedLeg({ id: 'leg-2', keyIndex: 2, value: 0.002, unit: 'base', asset: 'BTC' }),
  ],
  orchestration: {
    nodes: [
      SYMBOL_NODE,
      makeLegScopeNode({ legId: 'leg-1', direction: 'long', instrumentRef: SYMBOL_NODE.id }),
      makeLegScopeNode({ legId: 'leg-2', direction: 'short', instrumentRef: SYMBOL_NODE.id }),
    ],
    contracts: [],
  },
}

/** risk_budget 哨兵：leg 用 risk_budget axis → mapAnchorAxisToLegSizingMode 返 null，skip+warn */
export const MULTI_LEG_CASE_RISK_BUDGET: SemanticState = {
  ...baseState(),
  isMultiLeg: true,
  actions: [
    makeLockedLeg({ id: 'leg-1', keyIndex: 1, value: 50, unit: 'risk_budget' }),
    makeLockedLeg({ id: 'leg-2', keyIndex: 2, value: 200, unit: 'quote' }),
  ],
  orchestration: {
    nodes: [
      SYMBOL_NODE,
      makeLegScopeNode({ legId: 'leg-1', direction: 'long', instrumentRef: SYMBOL_NODE.id }),
      makeLegScopeNode({ legId: 'leg-2', direction: 'short', instrumentRef: SYMBOL_NODE.id }),
    ],
    contracts: [],
  },
}
