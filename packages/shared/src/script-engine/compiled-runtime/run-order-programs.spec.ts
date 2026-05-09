import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type {
  CompiledFixedGridGatedProgram,
  CompiledOrchestrationProgram,
} from './compiled-orchestration-program'
import type { CompiledGuardState } from './evaluate-guards'
import type { ProgramLifecycleState } from './program-lifecycle-state'
import { runOrderPrograms } from './run-order-programs'

const ctx = {} as unknown as StrategyExecutionContextV1
const guard: CompiledGuardState = Object.freeze({
  forceExit: false,
  blockNewEntry: false,
  strategyHalt: false,
  cancelOrderPrograms: false,
  triggered: Object.freeze([] as string[]),
}) as CompiledGuardState

const guardCancelAll: CompiledGuardState = Object.freeze({
  forceExit: false,
  blockNewEntry: false,
  strategyHalt: false,
  cancelOrderPrograms: true,
  triggered: Object.freeze([] as string[]),
}) as CompiledGuardState

function makeProgram(overrides: Partial<CompiledFixedGridGatedProgram> = {}): CompiledFixedGridGatedProgram {
  return {
    id: 'orch_grid_1',
    programKind: 'fixed_grid_gated',
    activeWhenExprId: 'expr_gate_regime',
    onDeactivate: 'cancel',
    rebuildPolicy: 'static',
    gridParams: {
      anchorPrice: 50000,
      levelCount: 3,
      stepPct: 5,
    },
    sizing: { mode: 'fixed_quote', value: 100 },
    ...overrides,
  }
}

describe('runOrderPrograms — orchestration program lifecycle (Phase 5 S4 T11)', () => {
  it('empty orchestrationPrograms keeps state shape backwards compatible', () => {
    const state = runOrderPrograms(ctx, [], {}, guard, [])
    expect(state.workingOrders).toEqual([])
    expect(state.activeProgramIds).toEqual([])
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.closeProgramIds).toEqual([])
  })

  it('omitted orchestrationPrograms (undefined) yields empty closeProgramIds', () => {
    const state = runOrderPrograms(ctx, [], {}, guard, [], undefined, undefined)
    expect(state.closeProgramIds).toEqual([])
  })

  it('active=true → workingOrders contains program with levels.length === levelCount', () => {
    const program = makeProgram()
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.closeProgramIds).toEqual([])
    expect(state.workingOrders).toHaveLength(1)
    const wo = state.workingOrders[0]
    expect(wo.id).toBe(program.id)
    expect(wo.sourceRef).toBe('orchestration:program.fixed_grid_gated')
    expect(wo.levels).toBeDefined()
    expect(wo.levels?.length).toBe(3)
  })

  it('active=false + onDeactivate=cancel → cancelledProgramIds contains id, no workingOrders', () => {
    const program = makeProgram({ onDeactivate: 'cancel' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
    expect(state.closeProgramIds).toEqual([])
    expect(state.activeProgramIds).toEqual([])
  })

  it('active=false + onDeactivate=keep → workingOrders still contains program (保单子)', () => {
    const program = makeProgram({ onDeactivate: 'keep' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.workingOrders).toHaveLength(1)
    expect(state.workingOrders[0].id).toBe(program.id)
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.closeProgramIds).toEqual([])
    expect(state.activeProgramIds).toEqual([])
  })

  it('active=false + onDeactivate=close → closeProgramIds contains id, no workingOrders, no cancelled', () => {
    const program = makeProgram({ onDeactivate: 'close' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.closeProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.activeProgramIds).toEqual([])
  })

  it('missing activeWhenExprId → fail-closed cancelledProgramIds', () => {
    const program = makeProgram({ activeWhenExprId: '' })
    const state = runOrderPrograms(ctx, [], {}, guard, [], undefined, [program])
    expect(state.cancelledProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
  })

  it('missing gridParams.anchorPrice (0) → fail-closed cancelledProgramIds', () => {
    const program = makeProgram({
      gridParams: { anchorPrice: 0, levelCount: 3, stepPct: 5 },
    })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
  })

  it('invalid levelCount (1) → fail-closed cancelledProgramIds', () => {
    const program = makeProgram({
      gridParams: { anchorPrice: 50000, levelCount: 1, stepPct: 5 },
    })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toEqual([program.id])
  })

  it('invalid sizing.value (0) → fail-closed cancelledProgramIds', () => {
    const program = makeProgram({ sizing: { mode: 'fixed_quote', value: 0 } })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toEqual([program.id])
  })

  it('exprValues[exprId]=undefined → treated as false → onDeactivate=cancel', () => {
    const program = makeProgram({ onDeactivate: 'cancel' })
    const state = runOrderPrograms(ctx, [], {}, guard, [], undefined, [program])
    expect(state.cancelledProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
  })

  it('exprValues[exprId]=number 1 (non-strict-true) → treated as false → cancelled', () => {
    const program = makeProgram({ onDeactivate: 'cancel' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: 1 as unknown as boolean },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toEqual([program.id])
    expect(state.workingOrders).toEqual([])
  })

  it('guardState.cancelOrderPrograms=true forces cancel even when active=true / onDeactivate=close', () => {
    const programs: readonly CompiledOrchestrationProgram[] = [
      makeProgram({ id: 'orch_a', onDeactivate: 'close' }),
      makeProgram({ id: 'orch_b', onDeactivate: 'keep' }),
    ]
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guardCancelAll,
      [],
      undefined,
      programs,
    )
    expect(state.cancelledProgramIds).toEqual(['orch_a', 'orch_b'])
    expect(state.closeProgramIds).toEqual([])
    expect(state.workingOrders).toEqual([])
  })

  it('levels math: anchorPrice=50000 stepPct=5 levelCount=3 → [47500, 45125, 42868.75]', () => {
    const program = makeProgram({
      gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
    })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.workingOrders[0].levels).toEqual([47500, 45125, 42868.75])
  })

  it('lowerBound clips levels that would underflow', () => {
    const program = makeProgram({
      gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5, lowerBound: 46000 },
    })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    // 47500 kept; 45125 / 42868.75 < 46000 → dropped
    expect(state.workingOrders[0].levels).toEqual([47500])
  })

  it('payload contains activeWhen + gridParams + sizing snapshots', () => {
    const program = makeProgram()
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const payload = state.workingOrders[0].payload as Record<string, unknown>
    expect(payload.activeWhen).toBe('expr_gate_regime')
    expect(payload.gridParams).toEqual(program.gridParams)
    expect(payload.sizing).toEqual(program.sizing)
  })
})

describe('runOrderPrograms — program lifecycle substrate (Phase 5 S0a)', () => {
  it('第 8 参 undefined → 行为与现有完全一致（回归保护）', () => {
    const program = makeProgram()
    const stateA = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const stateB = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      undefined,
    )
    expect(stateB.workingOrders).toEqual(stateA.workingOrders)
    expect(stateB.activeProgramIds).toEqual(stateA.activeProgramIds)
    expect(stateB.cancelledProgramIds).toEqual(stateA.cancelledProgramIds)
    expect(stateB.closeProgramIds).toEqual(stateA.closeProgramIds)
  })

  it('第 8 参传入 {} → 行为与 undefined 一致（state map 为空 → 同样输出）', () => {
    const program = makeProgram()
    const empty: Readonly<Record<string, ProgramLifecycleState>> = {}
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      empty,
    )
    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.workingOrders).toHaveLength(1)
  })

  it('fixed_grid_gated active → programLifecycleStateNext[id] 写入 placeholder', () => {
    const program = makeProgram({ id: 'orch_grid_x' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.programLifecycleStateNext).toBeDefined()
    expect(state.programLifecycleStateNext['orch_grid_x']).toEqual({
      kind: 'fixed_grid_gated',
    })
  })

  it('fixed_grid_gated active=false onDeactivate=cancel → 仍写 placeholder（lifecycle 持续）', () => {
    const program = makeProgram({ id: 'orch_grid_y', onDeactivate: 'cancel' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.programLifecycleStateNext['orch_grid_y']).toEqual({
      kind: 'fixed_grid_gated',
    })
  })

  it('programLifecycleStateNext 顶层 Object.freeze → mutation throws', () => {
    const program = makeProgram({ id: 'orch_grid_z' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(Object.isFrozen(state.programLifecycleStateNext)).toBe(true)
    expect(() => {
      ;(state.programLifecycleStateNext as Record<string, ProgramLifecycleState>).mutated = {
        kind: 'fixed_grid_gated',
      }
    }).toThrow()
  })

  it('ctx.bars 传与不传 → fixed_grid_gated 输出不变（S0a noop placeholder）', () => {
    const program = makeProgram({ id: 'orch_grid_q' })
    const ctxNoBars = {} as unknown as StrategyExecutionContextV1
    const ctxWithBars = {
      bars: [
        { open: 100, high: 110, low: 95, close: 105, volume: 1, timestamp: 1 },
        { open: 105, high: 115, low: 100, close: 112, volume: 1, timestamp: 2 },
      ],
    } as unknown as StrategyExecutionContextV1

    const stateNo = runOrderPrograms(
      ctxNoBars,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const stateWith = runOrderPrograms(
      ctxWithBars,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(stateWith.workingOrders).toEqual(stateNo.workingOrders)
    expect(stateWith.activeProgramIds).toEqual(stateNo.activeProgramIds)
    expect(stateWith.cancelledProgramIds).toEqual(stateNo.cancelledProgramIds)
    expect(stateWith.closeProgramIds).toEqual(stateNo.closeProgramIds)
    expect(stateWith.programLifecycleStateNext).toEqual(stateNo.programLifecycleStateNext)
  })
})
