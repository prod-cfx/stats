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
