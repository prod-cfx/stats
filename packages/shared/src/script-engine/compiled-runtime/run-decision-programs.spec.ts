import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import { runDecisionPrograms } from './run-decision-programs'

type Programs = Parameters<typeof runDecisionPrograms>[1]
type Ctx = Parameters<typeof runDecisionPrograms>[0]
type Guard = Parameters<typeof runDecisionPrograms>[3]

const PTP_PROGRAM = {
  id: 'program_ptp_partial_tp_test_tier_0',
  phase: 'exit' as const,
  priority: 100,
  when: 'predicate_threshold_met',
  metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 0, totalTiers: 2 } },
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

  it('W5: blockBoth with existing short position still allows CLOSE_SHORT', () => {
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
