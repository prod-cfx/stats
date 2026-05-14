/**
 * #1186 PR2: canonical-spec-builder 多锚 sizing 反填 legScopes spec.
 *
 * 覆盖 plan PR2 Task 3 的 7 个红绿 case：
 *   1. 双 leg quote 100/200 → legScopes.length===2、fixed_quote/USDT、spec.sizing===null
 *   2. 三 leg
 *   3. 单腿（isMultiLeg=false）→ 走旧路径，spec.sizing 非 null
 *   4. axis 异构 quote+ratio → fixed_quote / fixed_pct
 *   5. 互斥 assert：isMultiLeg + grid orderProgram → throw
 *   6. risk_budget skip 哨兵：log.warn + legSizing 缺失
 *   7. base_qty 哨兵 (NC2)：fixed_base mode + asset='BTC'，禁止静默归 fixed_quote
 */

import type { CanonicalOrderProgramIntent } from '../../types/canonical-strategy-spec'
import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import {
  MULTI_LEG_CASE_A,
  MULTI_LEG_CASE_BASE_QTY,
  MULTI_LEG_CASE_HETERO_AXIS,
  MULTI_LEG_CASE_RISK_BUDGET,
} from './fixtures/multi-leg-with-per-order-budget'

function makeSymbolNode(symbol = 'BTCUSDT'): SemanticOrchestrationNode {
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

function makeLegNode(legId: string, direction: 'long' | 'short', instrumentRef: string): SemanticOrchestrationNode {
  return {
    id: `scope-leg-${legId}`,
    kind: 'scope',
    key: 'scope.leg',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    legScopeKind: 'leg',
    legId,
    direction,
    instrumentRef,
  }
}

function makeLockedLegAction(id: string, value: number, unit: 'quote' | 'base' | 'ratio' = 'quote', asset?: string) {
  const shape =
    unit === 'quote' ? { kind: 'quote', value, asset: asset ?? 'USDT' }
      : unit === 'base' ? { kind: 'base', value, asset: asset ?? 'BTC' }
        : { kind: 'ratio', value, unit: 'ratio' }
  return {
    id,
    key: `action.buy_${id}`,
    status: 'locked' as const,
    source: 'user_explicit' as const,
    openSlots: [],
    contracts: [{
      id: `contract-${id}`,
      kind: 'action' as const,
      capabilities: [{
        domain: 'capital' as const,
        verb: 'allocate' as const,
        object: 'per_order_budget' as const,
        shape,
      }],
      requires: [],
      params: {},
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }],
  }
}

function emptyBaseState(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
  }
}

describe('CanonicalSpecBuilderService — #1186 PR2 multi-leg legScopes 反填', () => {
  let builder: CanonicalSpecBuilderService
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    builder = new CanonicalSpecBuilderService()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Case 1: 双 leg quote 100/200 USDT
  // -------------------------------------------------------------------------
  it('case 1 — 双 leg + 双 action quote sizing 100/200 → legScopes.length===2，spec.sizing===null', () => {
    const spec = builder.buildFromSemanticState(MULTI_LEG_CASE_A)
    const legScopes = spec.orchestration?.legScopes ?? []
    expect(legScopes).toHaveLength(2)
    expect(spec.sizing).toBeNull()

    const leg1 = legScopes.find(s => s.legId === 'leg-1')
    const leg2 = legScopes.find(s => s.legId === 'leg-2')
    expect(leg1?.legSizing).toEqual({ mode: 'fixed_quote', value: 100, asset: 'USDT' })
    expect(leg2?.legSizing).toEqual({ mode: 'fixed_quote', value: 200, asset: 'USDT' })
    expect(leg1?.direction).toBe('long')
    expect(leg2?.direction).toBe('short')
  })

  // -------------------------------------------------------------------------
  // Case 2: 三 leg
  // -------------------------------------------------------------------------
  it('case 2 — 三 leg 各 quote sizing → legScopes.length===3', () => {
    const sym = makeSymbolNode()
    const state: SemanticState = {
      ...emptyBaseState(),
      isMultiLeg: true,
      action: [
        makeLockedLegAction('leg-1', 50),
        makeLockedLegAction('leg-2', 100),
        makeLockedLegAction('leg-3', 150),
      ],
      orchestration: [
          sym,
          makeLegNode('leg-1', 'long', sym.id),
          makeLegNode('leg-2', 'short', sym.id),
          makeLegNode('leg-3', 'long', sym.id),
        ],
      orchestrationContracts: [],
    }
    const spec = builder.buildFromSemanticState(state)
    const legScopes = spec.orchestration?.legScopes ?? []
    expect(legScopes).toHaveLength(3)
    expect(spec.sizing).toBeNull()
    expect(legScopes.map(s => s.legSizing?.value).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([50, 100, 150])
  })

  // -------------------------------------------------------------------------
  // Case 3: 单腿 isMultiLeg=false → 走旧路径，spec.sizing 非 null
  // -------------------------------------------------------------------------
  it('case 3 — 单腿 isMultiLeg=false → 走旧路径（无 legScopes 反填，spec.sizing 非 null）', () => {
    const state: SemanticState = {
      ...emptyBaseState(),
      // isMultiLeg 缺省
      action: [makeLockedLegAction('only-action', 100)],
      // 不声明 orchestration.nodes → buildOrchestrationLegScopes 早返
    }
    const spec = builder.buildFromSemanticState(state)
    expect(spec.orchestration?.legScopes ?? []).toHaveLength(0)
    expect(spec.sizing).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  // Case 4: axis 异构 quote + ratio → fixed_quote / fixed_pct
  // -------------------------------------------------------------------------
  it('case 4 — axis 异构 leg-A quote 100 + leg-B ratio 0.1 → fixed_quote / fixed_pct', () => {
    const spec = builder.buildFromSemanticState(MULTI_LEG_CASE_HETERO_AXIS)
    const legScopes = spec.orchestration?.legScopes ?? []
    const leg1 = legScopes.find(s => s.legId === 'leg-1')
    const leg2 = legScopes.find(s => s.legId === 'leg-2')
    expect(leg1?.legSizing?.mode).toBe('fixed_quote')
    expect(leg1?.legSizing?.value).toBe(100)
    expect(leg2?.legSizing?.mode).toBe('fixed_pct')
    expect(leg2?.legSizing?.value).toBeCloseTo(0.1)
  })

  // -------------------------------------------------------------------------
  // Case 5: 互斥 assert — isMultiLeg + grid orderProgram → throw
  // -------------------------------------------------------------------------
  it('case 5 — isMultiLeg + grid orderProgram 共存 → throw MultiLegMutuallyExclusiveWithOrderProgram', () => {
    const fakeGridProgram: CanonicalOrderProgramIntent = {
      kind: 'order_program',
      programKind: 'fixed_grid_gated',
    } as unknown as CanonicalOrderProgramIntent
    jest.spyOn(builder as unknown as { buildContractOrderPrograms: (s: SemanticState) => CanonicalOrderProgramIntent[] }, 'buildContractOrderPrograms')
      .mockReturnValue([fakeGridProgram])
    expect(() => builder.buildFromSemanticState(MULTI_LEG_CASE_A))
      .toThrow(/MultiLegMutuallyExclusiveWithOrderProgram/)
  })

  // -------------------------------------------------------------------------
  // Case 6: risk_budget skip 哨兵 — log.warn + legSizing 缺失
  // -------------------------------------------------------------------------
  it('case 6 — leg axis=risk_budget → 跳过反填 + log.warn 触发 + legSizing 缺失', () => {
    const spec = builder.buildFromSemanticState(MULTI_LEG_CASE_RISK_BUDGET)
    const legScopes = spec.orchestration?.legScopes ?? []
    const leg1 = legScopes.find(s => s.legId === 'leg-1')
    const leg2 = legScopes.find(s => s.legId === 'leg-2')
    // leg-1 risk_budget → 反填 skip
    expect(leg1?.legSizing).toBeUndefined()
    // leg-2 quote → 正常反填
    expect(leg2?.legSizing).toEqual({ mode: 'fixed_quote', value: 200, asset: 'USDT' })
    // warn 必触发
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/risk_budget/))
  })

  // -------------------------------------------------------------------------
  // Case 7: base_qty 哨兵 (NC2) — fixed_base mode + asset='BTC'
  // -------------------------------------------------------------------------
  it('case 7 — leg axis=base_qty 0.001 BTC → mode=fixed_base value=0.001 asset=BTC（禁止静默归 fixed_quote）', () => {
    const spec = builder.buildFromSemanticState(MULTI_LEG_CASE_BASE_QTY)
    const legScopes = spec.orchestration?.legScopes ?? []
    const leg1 = legScopes.find(s => s.legId === 'leg-1')
    expect(leg1?.legSizing?.mode).toBe('fixed_base')
    expect(leg1?.legSizing?.value).toBe(0.001)
    expect(leg1?.legSizing?.asset).toBe('BTC')
    // 关键反向断言：禁止静默归 fixed_quote
    expect(leg1?.legSizing?.mode).not.toBe('fixed_quote')
  })
})
