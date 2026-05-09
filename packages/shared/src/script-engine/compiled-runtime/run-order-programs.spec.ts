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

// ============================================================================
// Phase 5 S5（#984）：dynamic_grid 7 路径 evaluator + 锁公式 + 深 freeze + 确定性 now
// ============================================================================

interface DynamicGridProgramOverrides {
  id?: string
  activeWhenExprId?: string
  onDeactivate?: 'cancel' | 'keep' | 'close'
  anchorLookbackBars?: number
  anchorSide?: 'high' | 'low' | 'mid'
  anchorDriftPct?: number
  rebuildMinIntervalSec?: number
  levelCount?: number
  step?: { mode: 'pct' | 'absolute'; value: number }
  sizingValue?: number
}

function makeDynamicGridProgram(overrides: DynamicGridProgramOverrides = {}): import('./compiled-orchestration-program').CompiledDynamicGridProgram {
  return {
    id: overrides.id ?? 'orch_dyn_1',
    programKind: 'dynamic_grid',
    activeWhenExprId: overrides.activeWhenExprId ?? 'expr_gate_regime',
    onDeactivate: overrides.onDeactivate ?? 'cancel',
    rebuildPolicy: 'anchor_on_state_change',
    dynamicGridParams: {
      anchorLookbackBars: overrides.anchorLookbackBars ?? 10,
      anchorSide: overrides.anchorSide ?? 'high',
      anchorDriftPct: overrides.anchorDriftPct ?? 1,
      rebuildMinIntervalSec: overrides.rebuildMinIntervalSec ?? 60,
      levelCount: overrides.levelCount ?? 3,
      step: overrides.step ?? { mode: 'pct', value: 1 },
    },
    sizing: { mode: 'fixed_quote', value: overrides.sizingValue ?? 100 },
  }
}

function makeBars(count: number, recipe: (i: number) => { high: number; low: number; close?: number }): NonNullable<StrategyExecutionContextV1['bars']> {
  const bars: NonNullable<StrategyExecutionContextV1['bars']> = []
  for (let i = 0; i < count; i++) {
    const r = recipe(i)
    bars.push({
      open: r.close ?? r.high,
      high: r.high,
      low: r.low,
      close: r.close ?? (r.high + r.low) / 2,
      volume: 1,
      timestamp: 1_700_000_000_000 + i * 60_000,
    })
  }
  return bars
}

describe('runOrderPrograms — dynamic_grid 7 路径 evaluator (Phase 5 S5)', () => {
  it('S5-A 主循环按 programKind 路由：dynamic_grid 不带 gridParams 不被静默 cancel', () => {
    const program = makeDynamicGridProgram()
    const bars = makeBars(10, i => ({ high: 100 + i, low: 90 + i }))
    const ctxWithBars = { bars } as unknown as StrategyExecutionContextV1
    const state = runOrderPrograms(
      ctxWithBars,
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    // 不应被静默 cancel（如 v2 在 switch 之前 destructure gridParams 的旧实现）
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.workingOrders[0].sourceRef).toBe('orchestration:program.dynamic_grid')
  })

  it('S5-B 首次 build（无 prev）：直接 rebuild，不 throttle，写入 lifecycle next', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_first', anchorSide: 'high', levelCount: 3, step: { mode: 'pct', value: 5 } })
    const bars = makeBars(10, () => ({ high: 100, low: 80 }))
    const ctxWithBars = { bars } as unknown as StrategyExecutionContextV1
    const state = runOrderPrograms(ctxWithBars, [], { expr_gate_regime: true }, guard, [], undefined, [program])

    expect(state.activeProgramIds).toEqual(['orch_dyn_first'])
    expect(state.workingOrders[0].levels).toEqual([95, 90.25, 85.74])
    const entry = state.programLifecycleStateNext['orch_dyn_first']
    expect(entry?.kind).toBe('dynamic_grid')
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAnchor).toBe(100)
      expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
      expect(entry.lastBuildLadder.map(l => l.level)).toEqual([95, 90.25, 85.74])
    }
  })

  it('S5-C 锁公式 mid = (high + low) / 2', () => {
    const program = makeDynamicGridProgram({ anchorSide: 'mid', levelCount: 2, step: { mode: 'pct', value: 10 } })
    const bars = makeBars(10, () => ({ high: 200, low: 100 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('dynamic_grid')
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAnchor).toBe(150)
    }
  })

  it('S5-D anchorSide=low 取 periodLow', () => {
    const program = makeDynamicGridProgram({ anchorSide: 'low', levelCount: 2, step: { mode: 'pct', value: 10 } })
    const bars = makeBars(10, i => ({ high: 200 - i, low: 100 - i }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('dynamic_grid')
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAnchor).toBe(91) // 最后 10 根的 min low：100..91
    }
  })

  it('S5-E anchor 漂移 < driftPct → keep prev ladder（不 rebuild，透传 prev state）', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_stable', anchorDriftPct: 5, levelCount: 2, step: { mode: 'pct', value: 1 } })
    const prevLadder = [{ id: 'orch_dyn_stable:0', level: 99 }, { id: 'orch_dyn_stable:1', level: 98.01 }]
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_stable: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1_700_000_000_000,
        lastBuildLadder: Object.freeze(prevLadder),
      }),
    }
    const bars = makeBars(10, () => ({ high: 102, low: 99 })) // currentAnchor=high=102, drift=2% < 5%
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program], prev)
    expect(state.workingOrders[0].levels).toEqual([99, 98.01])
    expect(state.programLifecycleStateNext.orch_dyn_stable).toEqual(prev.orch_dyn_stable)
  })

  it('S5-F 限速 NOOP：drift 达标但距上次 < minInterval → 保留旧 ladder + 透传 prev', () => {
    const program = makeDynamicGridProgram({
      id: 'orch_dyn_throttle',
      anchorDriftPct: 1,
      rebuildMinIntervalSec: 120,
      levelCount: 2,
      step: { mode: 'pct', value: 1 },
    })
    const prevLadder = [{ id: 'orch_dyn_throttle:0', level: 99 }, { id: 'orch_dyn_throttle:1', level: 98.01 }]
    const lastBuildAt = 1_700_000_000_000 + 9 * 60_000 // 9 分钟前
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_throttle: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt,
        lastBuildLadder: Object.freeze(prevLadder),
      }),
    }
    const bars = makeBars(10, () => ({ high: 110, low: 90 })) // 漂移 10%
    // 最新 bar timestamp = 1_700_000_000_000 + 9*60_000 = 9 分钟差，与 minInterval=120s 比较
    // 实际上 (now - lastBuildAt)/1000 = 0 → 0 < 120 → throttle
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program], prev)
    expect(state.workingOrders[0].levels).toEqual([99, 98.01])
    expect(state.programLifecycleStateNext.orch_dyn_throttle).toEqual(prev.orch_dyn_throttle)
  })

  it('S5-G K 线不足（无 prev）→ cancelled，无 entry', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_kshort', anchorLookbackBars: 50 })
    const bars = makeBars(5, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    expect(state.cancelledProgramIds).toEqual(['orch_dyn_kshort'])
    expect(state.programLifecycleStateNext.orch_dyn_kshort).toBeUndefined()
  })

  it('S5-H K 线不足（有 prev）→ 保留旧 ladder，不进 cancel', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_kshort_prev', anchorLookbackBars: 50, levelCount: 2 })
    const prevLadder = [{ id: 'orch_dyn_kshort_prev:0', level: 99 }, { id: 'orch_dyn_kshort_prev:1', level: 98 }]
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_kshort_prev: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze(prevLadder),
      }),
    }
    const bars = makeBars(5, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program], prev)
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.workingOrders[0].levels).toEqual([99, 98])
  })

  it('S5-I activeWhen=false × onDeactivate=cancel → cancel + 透传 prev', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_cancel', onDeactivate: 'cancel' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_cancel: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_cancel:0', level: 99 }]),
      }),
    }
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: false }, guard, [], undefined, [program], prev)
    expect(state.cancelledProgramIds).toEqual(['orch_dyn_cancel'])
    expect(state.programLifecycleStateNext.orch_dyn_cancel).toEqual(prev.orch_dyn_cancel)
  })

  it('S5-J activeWhen=false × onDeactivate=keep → keep prev ladder', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_keep', onDeactivate: 'keep' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_keep: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_keep:0', level: 99 }]),
      }),
    }
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: false }, guard, [], undefined, [program], prev)
    expect(state.activeProgramIds).toEqual(['orch_dyn_keep'])
    expect(state.workingOrders[0].levels).toEqual([99])
  })

  it('S5-K activeWhen=false × onDeactivate=close → close + 透传 prev', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_close', onDeactivate: 'close' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_close: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_close:0', level: 99 }]),
      }),
    }
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: false }, guard, [], undefined, [program], prev)
    expect(state.closeProgramIds).toEqual(['orch_dyn_close'])
    expect(state.programLifecycleStateNext.orch_dyn_close).toEqual(prev.orch_dyn_close)
  })

  it('S5-L 深 freeze：mutate entry.lastBuildAt 抛 TypeError', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_freeze' })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext.orch_dyn_freeze
    expect(Object.isFrozen(entry)).toBe(true)
    expect(() => {
      ;(entry as { lastBuildAt?: number }).lastBuildAt = 0
    }).toThrow()
  })

  it('S5-M 深 freeze：mutate entry.lastBuildLadder.push 抛 TypeError', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_freeze2' })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext.orch_dyn_freeze2
    if (entry?.kind === 'dynamic_grid') {
      expect(Object.isFrozen(entry.lastBuildLadder)).toBe(true)
      expect(() => {
        ;(entry.lastBuildLadder as { id: string; level: number }[]).push({ id: 'mut', level: 0 })
      }).toThrow()
    }
  })

  it('S5-N ctx.timestamp 确定性：undefined 时使用 bars[lastIdx].timestamp（不 stub Date.now）', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_ts' })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const ctxNoTs = { bars } as unknown as StrategyExecutionContextV1
    const state = runOrderPrograms(ctxNoTs, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext.orch_dyn_ts
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
    }
  })

  it('S5-O ctx.timestamp 显式传入时优先使用 ctx.timestamp', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_ts2' })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const customTs = 9_999_999_999
    const ctxWithTs = { bars, timestamp: customTs } as unknown as StrategyExecutionContextV1
    const state = runOrderPrograms(ctxWithTs, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    const entry = state.programLifecycleStateNext.orch_dyn_ts2
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAt).toBe(customTs)
    }
  })

  it('S5-P cancelOrderPrograms guard：dynamic_grid → cancel + 透传 prev lifecycle', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_guard' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_guard: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_guard:0', level: 99 }]),
      }),
    }
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guardCancelAll, [], undefined, [program], prev)
    expect(state.cancelledProgramIds).toEqual(['orch_dyn_guard'])
    expect(state.programLifecycleStateNext.orch_dyn_guard).toEqual(prev.orch_dyn_guard)
  })

  it('S5-Q cancelOrderPrograms guard 无 prev：dynamic_grid 不写 entry（key 缺席）', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_guard_noprev' })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guardCancelAll, [], undefined, [program])
    expect(state.cancelledProgramIds).toEqual(['orch_dyn_guard_noprev'])
    expect(state.programLifecycleStateNext.orch_dyn_guard_noprev).toBeUndefined()
  })

  it('S5-R fail-closed validator：anchorLookbackBars=5 (< 10) → cancel + 占位 entry', () => {
    const program = makeDynamicGridProgram({ id: 'orch_dyn_invalid', anchorLookbackBars: 5 })
    const bars = makeBars(10, () => ({ high: 100, low: 90 }))
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program])
    expect(state.cancelledProgramIds).toEqual(['orch_dyn_invalid'])
    const entry = state.programLifecycleStateNext.orch_dyn_invalid
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAnchor).toBe(0)
      expect(entry.lastBuildLadder).toEqual([])
    }
  })

  it('S5-S 漂移 ≥ driftPct + 距上次 ≥ minInterval → 真实 rebuild + 新 ladder', () => {
    const program = makeDynamicGridProgram({
      id: 'orch_dyn_rebuild',
      anchorDriftPct: 1,
      rebuildMinIntervalSec: 60,
      levelCount: 2,
      step: { mode: 'pct', value: 5 },
    })
    const lastBuildAt = 1_600_000_000_000 // 远早于 bars 时间戳
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_rebuild: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_rebuild:0', level: 95 }, { id: 'orch_dyn_rebuild:1', level: 90.25 }]),
      }),
    }
    const bars = makeBars(10, () => ({ high: 110, low: 100 })) // anchor=110, drift=10%
    const state = runOrderPrograms({ bars } as unknown as StrategyExecutionContextV1, [], { expr_gate_regime: true }, guard, [], undefined, [program], prev)
    // 新 ladder = round2(110 * 0.95^i) for i=1..2 → [104.5, round2(99.275)=99.28]
    expect(state.workingOrders[0].levels).toEqual([104.5, 99.28])
    const entry = state.programLifecycleStateNext.orch_dyn_rebuild
    if (entry?.kind === 'dynamic_grid') {
      expect(entry.lastBuildAnchor).toBe(110)
      expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
      expect(entry.lastBuildAt).not.toBe(lastBuildAt) // 已更新
    }
  })
})
