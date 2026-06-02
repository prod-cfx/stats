import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from './evaluate-orchestration-portfolio-risks'
import type { CompiledSubStrategyScope, CompiledOrchestrationScope } from './run-decision-programs'
import { applySubStrategyScopeRouting, runDecisionPrograms } from './run-decision-programs'

type Programs = Parameters<typeof runDecisionPrograms>[1]
type Ctx = Parameters<typeof runDecisionPrograms>[0]
type Guard = Parameters<typeof runDecisionPrograms>[3]

const PTP_PROGRAM = {
  id: 'program_ptp_partial_tp_test_tier_0',
  phase: 'exit' as const,
  priority: 100,
  when: 'predicate_threshold_met',
  metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 0, totalTiers: 2, cumulativeReduceRatio: 0.5 } },
  actions: [{ kind: 'REDUCE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 50 } }],
}

const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

describe('partial take profit decision gate', () => {
  it('skips program whose tier is already fired', () => {
    const ctx = {
      position: { qty: 1 },
      currentPrice: 100,
      __compiledDecisionState: { previousPositionQty: 1, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {
        partial_tp_test: { tier_0_fired: true },
      },
    } as unknown as Ctx
    const decision = runDecisionPrograms(
      ctx,
      [PTP_PROGRAM] as unknown as Programs,
      { predicate_threshold_met: true },
      baseGuard,
      [PTP_PROGRAM.id],
    )
    expect(decision.action).toBe('NOOP')
  })

  it('fires unfired tier and writes tier_fired=true', () => {
    const ctx = {
      position: { qty: 1 },
      currentPrice: 100,
      __compiledDecisionState: { previousPositionQty: 1, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: { partial_tp_test: {} as Record<string, unknown> },
    } as unknown as Ctx
    const decision = runDecisionPrograms(
      ctx,
      [PTP_PROGRAM] as unknown as Programs,
      { predicate_threshold_met: true },
      baseGuard,
      [PTP_PROGRAM.id],
    )
    expect(decision.action).toBe('ADJUST_POSITION')
    const state = (ctx as unknown as { semanticRuntimeState: Record<string, Record<string, unknown>> }).semanticRuntimeState
    expect(state.partial_tp_test.tier_0_fired).toBe(true)
    expect(state.partial_tp_test.firedTiers).toBe(1)
    expect(state.partial_tp_test.lastTierIndex).toBe(0)
    expect(state.partial_tp_test.cumulativeReduceRatio).toBe(0.5)
  })

  it('resets only declared partial_take_profit memoryKeys on entry edge (qty 0 -> non-0)', () => {
    const programA = {
      id: 'program_ptp_a_tier_0',
      phase: 'exit' as const,
      priority: 100,
      when: 'never',
      metadata: { partialTakeProfit: { memoryKey: 'partial_tp_a', tierIndex: 0, totalTiers: 1 } },
      actions: [{ kind: 'REDUCE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 50 } }],
    }
    const programB = {
      id: 'program_ptp_b_tier_0',
      phase: 'exit' as const,
      priority: 100,
      when: 'never',
      metadata: { partialTakeProfit: { memoryKey: 'partial_tp_b', tierIndex: 0, totalTiers: 1 } },
      actions: [{ kind: 'REDUCE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 50 } }],
    }
    const ctx = {
      position: { qty: 1 },
      currentPrice: 100,
      __compiledDecisionState: { previousPositionQty: 0, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {
        partial_tp_a: { tier_0_fired: true, tier_1_fired: true },
        partial_tp_b: { tier_0_fired: true },
        // Sibling-strategy state — must NOT be cleared because no current program declares this key.
        partial_tp_other: { tier_0_fired: true },
        unrelated_state: { foo: 'bar' },
      },
    } as unknown as Ctx
    runDecisionPrograms(ctx, [programA, programB] as unknown as Programs, { never: false }, baseGuard, [programA.id, programB.id])
    const state = (ctx as unknown as { semanticRuntimeState: Record<string, Record<string, unknown>> }).semanticRuntimeState
    const compiled = (ctx as unknown as { __compiledDecisionState: { previousPositionQty: number } }).__compiledDecisionState
    expect(state.partial_tp_a).toEqual({})
    expect(state.partial_tp_b).toEqual({})
    expect(state.partial_tp_other).toEqual({ tier_0_fired: true })
    expect(state.unrelated_state).toEqual({ foo: 'bar' })
    expect(compiled.previousPositionQty).toBe(1)
  })

  it('hot-restart with no prior compiledState resets declared partial_tp keys (defaults previousPositionQty=0)', () => {
    const ctx = {
      position: { qty: 1 },
      currentPrice: 100,
      // no __compiledDecisionState — fresh fallback should default previousPositionQty to 0,
      // so first bar with non-zero qty triggers entry-edge reset.
      semanticRuntimeState: {
        partial_tp_test: { tier_0_fired: true },
      },
    } as unknown as Ctx
    const decision = runDecisionPrograms(
      ctx,
      [PTP_PROGRAM] as unknown as Programs,
      { predicate_threshold_met: true },
      baseGuard,
      [PTP_PROGRAM.id],
    )
    // Stale tier_fired flag was reset, so program is allowed to fire.
    expect(decision.action).toBe('ADJUST_POSITION')
  })

  it('does not reset state on continuing position (prev=1, current=1)', () => {
    const ctx = {
      position: { qty: 1 },
      currentPrice: 100,
      __compiledDecisionState: { previousPositionQty: 1, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {
        partial_tp_a: { tier_0_fired: true },
      },
    } as unknown as Ctx
    runDecisionPrograms(ctx, [] as unknown as Programs, {}, baseGuard, [])
    const state = (ctx as unknown as { semanticRuntimeState: Record<string, Record<string, unknown>> }).semanticRuntimeState
    expect(state.partial_tp_a).toEqual({ tier_0_fired: true })
  })

  it('does not reset state on exit edge (prev=1, current=0)', () => {
    const ctx = {
      position: { qty: 0 },
      currentPrice: 100,
      __compiledDecisionState: { previousPositionQty: 1, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {
        partial_tp_a: { tier_0_fired: true },
      },
    } as unknown as Ctx
    runDecisionPrograms(ctx, [] as unknown as Programs, {}, baseGuard, [])
    const state = (ctx as unknown as { semanticRuntimeState: Record<string, Record<string, unknown>> }).semanticRuntimeState
    const compiled = (ctx as unknown as { __compiledDecisionState: { previousPositionQty: number } }).__compiledDecisionState
    expect(state.partial_tp_a).toEqual({ tier_0_fired: true })
    expect(compiled.previousPositionQty).toBe(0)
  })
})

describe('reverse position decisions', () => {
  it('opens the target side when reverse short fires with no existing long position', () => {
    const program = {
      id: 'program_reverse_short',
      phase: 'entry' as const,
      priority: 100,
      when: 'predicate_reverse_short',
      metadata: {
        reversePosition: {
          fromSide: 'long' as const,
          toSide: 'short' as const,
          sameBarPolicy: 'next_bar_only' as const,
          sizingSource: 'fixed' as const,
        },
      },
      actions: [
        { kind: 'CLOSE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 100 } },
        { kind: 'OPEN_SHORT' as const, quantity: { mode: 'pct_equity' as const, value: 10 } },
      ],
    }
    const ctx = {
      position: { qty: 0 },
      currentPrice: 100,
      accountEquity: 10000,
      __compiledDecisionState: { previousPositionQty: 0, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {},
    } as unknown as Ctx

    const decision = runDecisionPrograms(
      ctx,
      [program] as unknown as Programs,
      { predicate_reverse_short: true },
      baseGuard,
      [program.id],
    )

    expect(decision).toMatchObject({
      action: 'OPEN_SHORT',
      size: { mode: 'RATIO', value: 0.1 },
    })
  })
})

describe('orchestration gate enforcement', () => {
  const OPEN_LONG_PROGRAM = {
    id: 'program_open_long',
    phase: 'entry' as const,
    priority: 100,
    when: 'predicate_open_long',
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
  }
  const OPEN_SHORT_PROGRAM = {
    id: 'program_open_short',
    phase: 'entry' as const,
    priority: 100,
    when: 'predicate_open_short',
    actions: [{ kind: 'OPEN_SHORT' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
  }
  const CLOSE_LONG_PROGRAM = {
    id: 'program_close_long',
    phase: 'exit' as const,
    priority: 100,
    when: 'predicate_close_long',
    actions: [{ kind: 'CLOSE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
  }
  const CLOSE_SHORT_PROGRAM = {
    id: 'program_close_short',
    phase: 'exit' as const,
    priority: 100,
    when: 'predicate_close_short',
    actions: [{ kind: 'CLOSE_SHORT' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
  }
  const REDUCE_LONG_PROGRAM = {
    id: 'program_reduce_long',
    phase: 'exit' as const,
    priority: 100,
    when: 'predicate_reduce_long',
    actions: [{ kind: 'REDUCE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 50 } }],
  }

  function makeCtx(qty: number): Ctx {
    return {
      position: { qty },
      currentPrice: 100,
      accountEquity: 10000,
      __compiledDecisionState: { previousPositionQty: qty, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {},
    } as unknown as Ctx
  }

  const blockLong: OrchestrationGateState = { blockEntryLong: true, blockEntryShort: false }
  const blockShort: OrchestrationGateState = { blockEntryLong: false, blockEntryShort: true }
  const blockBoth: OrchestrationGateState = { blockEntryLong: true, blockEntryShort: true }

  it('blockEntryLong=true converts OPEN_LONG to NOOP with reason', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      blockLong,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.gate.block_entry_long')
  })

  it('blockEntryLong=true does not affect OPEN_SHORT', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_SHORT_PROGRAM] as unknown as Programs,
      { predicate_open_short: true },
      baseGuard,
      [OPEN_SHORT_PROGRAM.id],
      blockLong,
    )
    expect(decision.action).toBe('OPEN_SHORT')
  })

  it('blockEntryShort=true converts OPEN_SHORT to NOOP with reason', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_SHORT_PROGRAM] as unknown as Programs,
      { predicate_open_short: true },
      baseGuard,
      [OPEN_SHORT_PROGRAM.id],
      blockShort,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.gate.block_entry_short')
  })

  it('blockEntryLong=true with existing long position still allows CLOSE_LONG', () => {
    const ctx = makeCtx(1)
    const decision = runDecisionPrograms(
      ctx,
      [CLOSE_LONG_PROGRAM] as unknown as Programs,
      { predicate_close_long: true },
      baseGuard,
      [CLOSE_LONG_PROGRAM.id],
      blockLong,
    )
    expect(decision.action).toBe('CLOSE_LONG')
  })

  it('blockEntryLong=true does not affect REDUCE_LONG (entry block !== reduce block)', () => {
    const ctx = makeCtx(1)
    const decision = runDecisionPrograms(
      ctx,
      [REDUCE_LONG_PROGRAM] as unknown as Programs,
      { predicate_reduce_long: true },
      baseGuard,
      [REDUCE_LONG_PROGRAM.id],
      blockLong,
    )
    expect(decision.action).toBe('ADJUST_POSITION')
  })

  it('w5: blockBoth with existing short position still allows CLOSE_SHORT', () => {
    const ctx = makeCtx(-1)
    const decision = runDecisionPrograms(
      ctx,
      [CLOSE_SHORT_PROGRAM] as unknown as Programs,
      { predicate_close_short: true },
      baseGuard,
      [CLOSE_SHORT_PROGRAM.id],
      blockBoth,
    )
    expect(decision.action).toBe('CLOSE_SHORT')
  })

  it('orchestrationGateState undefined => backward compatible, OPEN_LONG flows', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
    )
    expect(decision.action).toBe('OPEN_LONG')
  })
})

describe('orchestration portfolioRisk enforcement', () => {
  const OPEN_LONG_PROGRAM = {
    id: 'program_open_long',
    phase: 'entry' as const,
    priority: 100,
    when: 'predicate_open_long',
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
  }
  const OPEN_SHORT_PROGRAM = {
    id: 'program_open_short',
    phase: 'entry' as const,
    priority: 100,
    when: 'predicate_open_short',
    actions: [{ kind: 'OPEN_SHORT' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
  }
  const CLOSE_LONG_PROGRAM = {
    id: 'program_close_long',
    phase: 'exit' as const,
    priority: 100,
    when: 'predicate_close_long',
    actions: [{ kind: 'CLOSE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
  }
  const CLOSE_SHORT_PROGRAM = {
    id: 'program_close_short',
    phase: 'exit' as const,
    priority: 100,
    when: 'predicate_close_short',
    actions: [{ kind: 'CLOSE_SHORT' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
  }

  function makeCtx(qty: number): Ctx {
    return {
      position: { qty },
      currentPrice: 100,
      accountEquity: 10000,
      __compiledDecisionState: { previousPositionQty: qty, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {},
    } as unknown as Ctx
  }

  const gateBlockLong: OrchestrationGateState = { blockEntryLong: true, blockEntryShort: false }
  const portfolioBlockLong: OrchestrationPortfolioRiskState = {
    blockEntryLong: true,
    blockEntryShort: false,
    observedBreaches: [],
  }
  const portfolioBlockShort: OrchestrationPortfolioRiskState = {
    blockEntryLong: false,
    blockEntryShort: true,
    observedBreaches: [],
  }
  const portfolioBlockBoth: OrchestrationPortfolioRiskState = {
    blockEntryLong: true,
    blockEntryShort: true,
    observedBreaches: [],
  }
  const portfolioObservedOnly: OrchestrationPortfolioRiskState = {
    blockEntryLong: false,
    blockEntryShort: false,
    observedBreaches: ['risk-1'],
  }

  it('portfolioRiskState undefined => no change (regression)', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      undefined,
      undefined,
    )
    expect(decision.action).toBe('OPEN_LONG')
  })

  it('portfolioRiskState.blockEntryLong=true converts OPEN_LONG to NOOP with portfolioRisk reason', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      undefined,
      portfolioBlockLong,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.portfolio_risk.block_entry_long')
  })

  it('portfolioRiskState.blockEntryShort=true converts OPEN_SHORT to NOOP with portfolioRisk reason', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_SHORT_PROGRAM] as unknown as Programs,
      { predicate_open_short: true },
      baseGuard,
      [OPEN_SHORT_PROGRAM.id],
      undefined,
      portfolioBlockShort,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.portfolio_risk.block_entry_short')
  })

  it('gate blocks long + portfolioRiskState undefined => NOOP gate reason', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      gateBlockLong,
      undefined,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.gate.block_entry_long')
  })

  it('gate blocks long + portfolio blocks long => portfolioRisk reason wins (priority)', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      gateBlockLong,
      portfolioBlockLong,
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toBe('compiled.orchestration.portfolio_risk.block_entry_long')
  })

  it('observedBreaches non-empty + no block + OPEN_LONG => decision flows with observedBreaches in meta', () => {
    const ctx = makeCtx(0)
    const decision = runDecisionPrograms(
      ctx,
      [OPEN_LONG_PROGRAM] as unknown as Programs,
      { predicate_open_long: true },
      baseGuard,
      [OPEN_LONG_PROGRAM.id],
      undefined,
      portfolioObservedOnly,
    )
    expect(decision.action).toBe('OPEN_LONG')
    expect(decision.meta).toBeDefined()
    expect((decision.meta as { observedBreaches?: string[] }).observedBreaches).toEqual(['risk-1'])
  })

  it('w5: gate blocks + portfolio observedBreaches + existing long + CLOSE_LONG flows', () => {
    const ctx = makeCtx(1)
    const decision = runDecisionPrograms(
      ctx,
      [CLOSE_LONG_PROGRAM] as unknown as Programs,
      { predicate_close_long: true },
      baseGuard,
      [CLOSE_LONG_PROGRAM.id],
      gateBlockLong,
      portfolioObservedOnly,
    )
    expect(decision.action).toBe('CLOSE_LONG')
  })

  it('w5: portfolioRiskState.blockEntryShort=true + existing short + CLOSE_SHORT flows', () => {
    const ctx = makeCtx(-1)
    const decision = runDecisionPrograms(
      ctx,
      [CLOSE_SHORT_PROGRAM] as unknown as Programs,
      { predicate_close_short: true },
      baseGuard,
      [CLOSE_SHORT_PROGRAM.id],
      undefined,
      portfolioBlockBoth,
    )
    expect(decision.action).toBe('CLOSE_SHORT')
  })
})

describe('phase 5 S10 — applySubStrategyScopeRouting (routing helper 单测)', () => {
  function makeSub(id: string, subStrategyId: string): CompiledSubStrategyScope {
    return {
      id,
      scopeKind: 'subStrategy',
      subStrategyId,
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    }
  }

  const scopes: readonly CompiledSubStrategyScope[] = [
    makeSub('ss-trend', 'trend'),
    makeSub('ss-range', 'range'),
  ]

  type RoutingProgram = Parameters<typeof applySubStrategyScopeRouting>[0]
  type RoutingCtx = Parameters<typeof applySubStrategyScopeRouting>[1]

  const baseProgramEntry: RoutingProgram = {
    phase: 'entry',
    metadata: { subStrategyScopeRef: 'ss-trend' },
  }
  const baseProgramExit: RoutingProgram = {
    phase: 'exit',
    metadata: { subStrategyScopeRef: 'ss-trend' },
  }
  const baseProgramRebalance: RoutingProgram = {
    phase: 'rebalance',
    metadata: { subStrategyScopeRef: 'ss-trend' },
  }

  it('scopes 缺失 → continue（兜底，旧策略零侵入）', () => {
    const result = applySubStrategyScopeRouting(baseProgramEntry, {} as RoutingCtx, undefined, undefined)
    expect(result).toBe('continue')
  })

  it('scopes.length === 1 → continue（单 sub 走兜底）', () => {
    const result = applySubStrategyScopeRouting(baseProgramEntry, {} as RoutingCtx, [scopes[0]], undefined)
    expect(result).toBe('continue')
  })

  it('length>=2 + ctx.activeSubStrategyScopeId 缺 → NOOP fail_closed.no_active_scope', () => {
    const result = applySubStrategyScopeRouting(baseProgramEntry, {} as RoutingCtx, scopes, undefined)
    expect(typeof result).not.toBe('string')
    if (typeof result === 'string') return
    expect(result.action).toBe('NOOP')
    expect(result.reason).toBe('compiled.orchestration.substrategy.fail_closed.no_active_scope')
  })

  it('activeId ∉ scopes ids → NOOP fail_closed.unknown_active_scope', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-unknown' } as unknown as RoutingCtx
    const result = applySubStrategyScopeRouting(baseProgramEntry, ctx, scopes, undefined)
    if (typeof result === 'string') throw new Error('expected NOOP decision, got string')
    expect(result.reason).toBe('compiled.orchestration.substrategy.fail_closed.unknown_active_scope')
  })

  it('program.metadata.subStrategyScopeRef 缺 → NOOP fail_closed.unbound_program', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as RoutingCtx
    const programNoRef: RoutingProgram = { phase: 'entry', metadata: {} }
    const result = applySubStrategyScopeRouting(programNoRef, ctx, scopes, undefined)
    if (typeof result === 'string') throw new Error('expected NOOP decision, got string')
    expect(result.reason).toBe('compiled.orchestration.substrategy.fail_closed.unbound_program')
  })

  it('program ref ≠ activeId → skip', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-range' } as unknown as RoutingCtx
    const result = applySubStrategyScopeRouting(baseProgramEntry, ctx, scopes, undefined)
    expect(result).toBe('skip')
  })

  it('ref === activeId 非 paused → continue', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as RoutingCtx
    const result = applySubStrategyScopeRouting(baseProgramEntry, ctx, scopes, undefined)
    expect(result).toBe('continue')
  })

  it('ref === activeId paused + entry phase → NOOP paused', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as RoutingCtx
    const gateState: OrchestrationGateState = {
      blockEntryLong: false,
      blockEntryShort: false,
      pausedSubStrategyScopeIds: new Set(['ss-trend']),
    }
    const result = applySubStrategyScopeRouting(baseProgramEntry, ctx, scopes, gateState)
    if (typeof result === 'string') throw new Error('expected NOOP decision, got string')
    expect(result.action).toBe('NOOP')
    expect(result.reason).toBe('compiled.orchestration.substrategy.paused')
  })

  it('ref === activeId paused + exit phase → continue（验收项 6 "能进就能出"）', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as RoutingCtx
    const gateState: OrchestrationGateState = {
      blockEntryLong: false,
      blockEntryShort: false,
      pausedSubStrategyScopeIds: new Set(['ss-trend']),
    }
    const result = applySubStrategyScopeRouting(baseProgramExit, ctx, scopes, gateState)
    expect(result).toBe('continue')
  })

  it('ref === activeId paused + rebalance phase → continue（Missing-3 覆盖）', () => {
    const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as RoutingCtx
    const gateState: OrchestrationGateState = {
      blockEntryLong: false,
      blockEntryShort: false,
      pausedSubStrategyScopeIds: new Set(['ss-trend']),
    }
    const result = applySubStrategyScopeRouting(baseProgramRebalance, ctx, scopes, gateState)
    expect(result).toBe('continue')
  })
})

describe('phase 5 S10 — runDecisionPrograms scope chain order (Missing-2 indirect assertion)', () => {
  // Missing-2: 验证 symbol fail-closed 时不会触发 sub routing。
  // 由于 applySubStrategyScopeRouting 在 runDecisionPrograms 内部以局部引用方式调用，
  // jest.spyOn 无法重写局部引用 → 改用 indirect 断言：
  //   - 若 symbol routing fail-closed → 返回 reason 以 'compiled.orchestration.scope.*' 开头
  //     （而非 'compiled.orchestration.substrategy.*'），证明 sub routing 未执行
  //   - 若 symbol routing continue + sub routing fail-closed → reason 以 substrategy.* 开头
  const PROGRAM = {
    id: 'program_open_long',
    phase: 'entry' as const,
    priority: 100,
    when: 'pred_open',
    metadata: {
      symbolScopeRef: 's-btc',
      subStrategyScopeRef: 'ss-trend',
    },
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
  }
  const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

  function makeCtx(extras: Record<string, unknown> = {}): Ctx {
    return {
      position: { qty: 0 },
      currentPrice: 100,
      accountEquity: 10000,
      __compiledDecisionState: { previousPositionQty: 0, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {},
      ...extras,
    } as unknown as Ctx
  }

  const symbolScopes: readonly CompiledOrchestrationScope[] = [
    { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
    { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'] },
  ]
  const subScopes: readonly CompiledOrchestrationScope[] = [
    {
      id: 'ss-trend',
      scopeKind: 'subStrategy',
      subStrategyId: 'trend',
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    },
    {
      id: 'ss-range',
      scopeKind: 'subStrategy',
      subStrategyId: 'range',
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    },
  ]

  it('symbol routing 多 scope + 缺 activeSymbolScopeId → fail-closed reason scope.*；sub routing 未执行（reason 不是 substrategy.*）', () => {
    const ctx = makeCtx({ activeSubStrategyScopeId: 'ss-trend' })
    const decision = runDecisionPrograms(
      ctx,
      [PROGRAM] as unknown as Programs,
      { pred_open: true },
      baseGuard,
      [PROGRAM.id],
      undefined,
      undefined,
      [...symbolScopes, ...subScopes],
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toMatch(/^compiled\.orchestration\.scope\.fail_closed\./)
    // 关键：必须是 symbol 系 reason，而非 substrategy.* — 证明 symbol fail-closed 短路阻止 sub 路由
    expect(decision.reason).not.toMatch(/^compiled\.orchestration\.substrategy\./)
  })

  it('symbol routing continue（active 匹配）+ sub routing fail-closed（缺 activeSubStrategyScopeId）→ reason 为 substrategy.*', () => {
    const ctx = makeCtx({ activeSymbolScopeId: 's-btc' })
    const decision = runDecisionPrograms(
      ctx,
      [PROGRAM] as unknown as Programs,
      { pred_open: true },
      baseGuard,
      [PROGRAM.id],
      undefined,
      undefined,
      [...symbolScopes, ...subScopes],
    )
    expect(decision.action).toBe('NOOP')
    expect(decision.reason).toMatch(/^compiled\.orchestration\.substrategy\.fail_closed\./)
  })

  it('symbol routing continue + sub routing continue → 正常 OPEN_LONG（双 chain 顺序贯通）', () => {
    const ctx = makeCtx({
      activeSymbolScopeId: 's-btc',
      activeSubStrategyScopeId: 'ss-trend',
    })
    const decision = runDecisionPrograms(
      ctx,
      [PROGRAM] as unknown as Programs,
      { pred_open: true },
      baseGuard,
      [PROGRAM.id],
      undefined,
      undefined,
      [...symbolScopes, ...subScopes],
    )
    expect(decision.action).toBe('OPEN_LONG')
  })
})
