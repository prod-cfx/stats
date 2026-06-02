import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type {
  CompiledAdaptiveVolatilityGridProgram,
  CompiledEventListenerProgram,
  CompiledFixedGridGatedProgram,
  CompiledOrchestrationProgram,
} from './compiled-orchestration-program'
import { canonicalSerialize } from './canonical-serialize'
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

  it('active=true when activeWhenExprId references expr sourceRef instead of expr id', () => {
    const program = makeProgram({ activeWhenExprId: 'grid_gate_source_ref' })
    const state = runOrderPrograms(
      ctx,
      [],
      { expr_04_grid_gate_source_ref: true },
      guard,
      [],
      undefined,
      [program],
    )

    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.workingOrders).toHaveLength(1)
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

describe('runOrderPrograms — execution program atoms', () => {
  const genericKinds = ['twap', 'dca', 'martingale', 'rebalance', 'iceberg'] as const

  it.each(genericKinds)('%s active=true writes lifecycle state and working order payload', (programKind) => {
    const program = {
      id: `program_${programKind}`,
      programKind,
      activeWhenExprId: 'expr_gate_regime',
      onDeactivate: 'cancel',
      rebuildPolicy: 'static',
      params: { totalSize: 1000, sliceCount: 10, sourcePath: `rules[0].effects.programs.${programKind}` },
    }

    const state = runOrderPrograms(ctx, [], { expr_gate_regime: true }, guard, [], undefined, [program] as never)

    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.cancelledProgramIds).toEqual([])
    expect(state.workingOrders).toEqual([
      expect.objectContaining({
        id: program.id,
        sourceRef: `orchestration:program.${programKind}`,
        payload: expect.objectContaining({ programKind, params: program.params }),
      }),
    ])
    expect(state.programLifecycleStateNext[program.id]).toEqual({ kind: programKind, status: 'active' })
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

// makeBars for dynamic_grid tests: count + recipe
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

// ===== Phase 5 S6 (#984) adaptive_volatility_grid =====

// makeAdaptiveBars for adaptive_volatility_grid tests: period + options
function makeAdaptiveBars(period: number, options: {
  high?: number
  low?: number
  close?: number
  startTimestamp?: number
  intervalMs?: number
  count?: number
} = {}): Array<{ open: number; high: number; low: number; close: number; volume: number; timestamp: number }> {
  const high = options.high ?? 102
  const low = options.low ?? 98
  const close = options.close ?? 100
  const start = options.startTimestamp ?? 1_700_000_000_000
  const interval = options.intervalMs ?? 60_000
  const count = options.count ?? period + 5
  const bars = []
  for (let i = 0; i < count; i++) {
    bars.push({
      open: close,
      high,
      low,
      close,
      volume: 1000,
      timestamp: start + i * interval,
    })
  }
  return bars
}

function makeAdaptiveProgram(
  overrides: Partial<CompiledAdaptiveVolatilityGridProgram> = {},
  paramsOverrides: Partial<CompiledAdaptiveVolatilityGridProgram['adaptiveGridParams']> = {},
): CompiledAdaptiveVolatilityGridProgram {
  return {
    id: 'adaptive_grid_1',
    programKind: 'adaptive_volatility_grid',
    activeWhenExprId: 'expr_gate_regime',
    onDeactivate: 'cancel',
    rebuildPolicy: 'atr_window',
    adaptiveGridParams: {
      atrPeriod: 14,
      atrMultiplier: 1.5,
      rangeMultiplier: 3,
      atrDriftPct: 25,
      rebuildCooldownSec: 300,
      minStepPct: 0.2,
      maxStepPct: 5,
      levelCount: 6,
      ...paramsOverrides,
    },
    sizing: { mode: 'fixed_quote', value: 100 },
    ...overrides,
  }
}

describe('runOrderPrograms — adaptive_volatility_grid (Phase 5 S6)', () => {
  const ctxWithBars = (bars: ReturnType<typeof makeAdaptiveBars>, timestamp?: number): StrategyExecutionContextV1 =>
    ({ bars, ...(timestamp !== undefined ? { timestamp } : {}) }) as unknown as StrategyExecutionContextV1

  it('Path 1 fail-closed: 非法 atrMultiplier=0 → cancelled，不写 lifecycle entry', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram({}, { atrMultiplier: 0 })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('Path 5+7 首次 build：rebuild + 写 lifecycle entry（含 lastBuildATR / lastBuildAt / ladder / rebuildClamped=false）', () => {
    // ATR=1 → rawStepPct = 1.5 * 1 / 100 * 100 = 1.5%；[min=0.2, max=5] 内 → 不钳制
    // rangeMultiplier=10 给足 [90, 110] 区间，6 档全在范围内
    const bars = makeAdaptiveBars(14, { high: 100.5, low: 99.5, close: 100 })
    const program = makeAdaptiveProgram({}, { rangeMultiplier: 10 })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.activeProgramIds).toContain(program.id)
    expect(state.workingOrders).toHaveLength(1)
    const wo = state.workingOrders[0]
    expect(wo.sourceRef).toBe('orchestration:program.adaptive_volatility_grid')
    expect(Array.isArray(wo.levels)).toBe(true)
    expect(wo.levels!.length).toBe(6)
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('adaptive_volatility_grid')
    if (entry?.kind === 'adaptive_volatility_grid') {
      expect(entry.lastBuildATR).toBeGreaterThan(0)
      expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
      expect(entry.lastBuildLadder.length).toBe(6)
      expect(entry.rebuildClamped).toBe(false)
    }
  })

  it('Path 7 levelCount 奇数切分（5 → lower=2 + upper=3，currentClose 不在 levels 中）', () => {
    const bars = makeAdaptiveBars(14, { high: 105, low: 95, close: 100 })
    const program = makeAdaptiveProgram({}, { levelCount: 5 })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.workingOrders[0].levels!.length).toBe(5)
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'adaptive_volatility_grid') {
      const ladder = entry.lastBuildLadder
      expect(ladder.length).toBe(5)
      const lowerCount = ladder.filter(l => l.id.includes('_lower_')).length
      const upperCount = ladder.filter(l => l.id.includes('_upper_')).length
      expect(lowerCount).toBe(2)
      expect(upperCount).toBe(3)
      expect(ladder.find(l => l.level === 100)).toBeUndefined()
    }
  })

  it('Path 7 钳制触发：rawStepPct < minStepPct → stepPct=minStepPct + rebuildClamped=true', () => {
    const bars = makeAdaptiveBars(14, { high: 100.01, low: 99.99, close: 100 })
    const program = makeAdaptiveProgram({}, { atrMultiplier: 1, minStepPct: 1, maxStepPct: 5 })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'adaptive_volatility_grid') {
      expect(entry.rebuildClamped).toBe(true)
    }
  })

  it('Path 6 Path A: ATR null + 有 prev → 保留 prev ladder + reason；prev 透传深相等', () => {
    const program = makeAdaptiveProgram()
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 5,
      lastBuildAt: 1_700_000_000_000,
      lastBuildLadder: [{ id: 'a', level: 95 }, { id: 'b', level: 105 }],
      rebuildClamped: false,
    }
    const tooFew = makeAdaptiveBars(14, { count: 5 })  // bars 不足以产出 ATR
    const state = runOrderPrograms(
      ctxWithBars(tooFew), [], { expr_gate_regime: true }, guard, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.activeProgramIds).toContain(program.id)
    const wo = state.workingOrders[0]
    expect((wo.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.atr_unavailable_keep_ladder')
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('Path 6 Path B: ATR null + 无 prev → cancelled + key 缺席（substrate eviction）', () => {
    const program = makeAdaptiveProgram()
    const tooFew = makeAdaptiveBars(14, { count: 3 })
    const state = runOrderPrograms(
      ctxWithBars(tooFew), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('Path 7 cooldown：drift ≥ threshold + 距上次 < cooldown → throttled + 保留旧 ladder + reason', () => {
    const program = makeAdaptiveProgram({}, { atrDriftPct: 1, rebuildCooldownSec: 600 })
    const bars = makeAdaptiveBars(14, { high: 110, low: 90, close: 100 })  // 大波动
    const lastTs = bars[bars.length - 1].timestamp
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 0.0001,  // 强制 drift >> 1%
      lastBuildAt: lastTs - 60_000,  // 60s 前 < 600s cooldown
      lastBuildLadder: [{ id: 'a', level: 99 }, { id: 'b', level: 101 }],
      rebuildClamped: false,
    }
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.activeProgramIds).toContain(program.id)
    const wo = state.workingOrders[0]
    expect((wo.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.rebuild_throttled')
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('Path 7 drift < threshold → 不 rebuild + 保留 prev ladder（无 reason）', () => {
    const bars = makeAdaptiveBars(14, { high: 105, low: 95, close: 100 })
    const program = makeAdaptiveProgram({}, { atrDriftPct: 99 })
    // 触发首次 build 拿到 ATR
    const first = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    const prev = first.programLifecycleStateNext[program.id]
    expect(prev?.kind).toBe('adaptive_volatility_grid')
    // 第二根 K 线 ATR 几乎不变
    const second = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
      { [program.id]: prev! },
    )
    const wo = second.workingOrders[0]
    expect((wo.payload as Record<string, unknown>).reason).toBeUndefined()
    expect(second.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('Path 4 inactive cancel：activeWhen=false + onDeactivate=cancel + 无 prev → cancelledProgramIds + key 缺席', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram({ onDeactivate: 'cancel' })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: false }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('Path 4 inactive cancel：onDeactivate=cancel + 有 prev → 透传 prev（critic round 3 fix）', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram({ onDeactivate: 'cancel' })
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 1,
      lastBuildAt: 1_700_000_000_000,
      lastBuildLadder: [{ id: 'a', level: 99 }],
      rebuildClamped: false,
    }
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: false }, guard, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('active→inactive(cancel)→active 抖动序列：第三根 K 线仍按 prev drift/cooldown 比较，不视为首次 build', () => {
    const program = makeAdaptiveProgram({ onDeactivate: 'cancel' }, { atrDriftPct: 1, rebuildCooldownSec: 600 })
    const lifecycleMap: Record<string, ProgramLifecycleState> = {}
    // K1 active → 首次 build
    const bars1 = makeAdaptiveBars(14, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_000_000 })
    const r1 = runOrderPrograms(ctxWithBars(bars1), [], { expr_gate_regime: true }, guard, [], undefined, [program], lifecycleMap)
    Object.assign(lifecycleMap, r1.programLifecycleStateNext)
    const buildEntry = lifecycleMap[program.id]
    expect(buildEntry?.kind).toBe('adaptive_volatility_grid')
    // K2 inactive(cancel) → 透传 prev（不丢弃 cooldown 上下文）
    const bars2 = makeAdaptiveBars(14, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_120_000 })
    const r2 = runOrderPrograms(ctxWithBars(bars2), [], { expr_gate_regime: false }, guard, [], undefined, [program], lifecycleMap)
    Object.assign(lifecycleMap, r2.programLifecycleStateNext)
    expect(r2.cancelledProgramIds).toContain(program.id)
    expect(lifecycleMap[program.id]).toEqual(buildEntry)
    // K3 active + ATR 突变 → drift 大但 cooldown=600s 未到 → throttled（cooldown 硬下限保护生效）
    const bars3 = makeAdaptiveBars(14, { high: 105, low: 95, close: 100, startTimestamp: 1_700_000_240_000 })
    const r3 = runOrderPrograms(ctxWithBars(bars3), [], { expr_gate_regime: true }, guard, [], undefined, [program], lifecycleMap)
    const wo3 = r3.workingOrders.find(w => w.id === program.id)
    expect((wo3?.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.rebuild_throttled')
  })

  it('Path 4 inactive close：activeWhen=false + onDeactivate=close → closeProgramIds + 透传 prev', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram({ onDeactivate: 'close' })
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 5,
      lastBuildAt: 1_700_000_000_000,
      lastBuildLadder: [{ id: 'a', level: 95 }],
      rebuildClamped: false,
    }
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: false }, guard, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.closeProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('Path 4 inactive keep：activeWhen=false + onDeactivate=keep + 有 prev → 输出 prev ladder', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram({ onDeactivate: 'keep' })
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 5,
      lastBuildAt: 1_700_000_000_000,
      lastBuildLadder: [{ id: 'a', level: 95 }, { id: 'b', level: 105 }],
      rebuildClamped: false,
    }
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: false }, guard, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.workingOrders).toHaveLength(1)
    expect(state.workingOrders[0].levels).toEqual([95, 105])
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('应用 S5 M1 深 freeze：lifecycle entry 不可变（mutation 抛错）', () => {
    const bars = makeAdaptiveBars(14, { high: 105, low: 95, close: 100 })
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    const entry = state.programLifecycleStateNext[program.id]!
    expect(() => {
      (entry as unknown as Record<string, number>).lastBuildAt = 0
    }).toThrow()
    if (entry.kind === 'adaptive_volatility_grid') {
      expect(() => {
        (entry.lastBuildLadder as unknown as { push: (item: unknown) => void }).push({ id: 'x', level: 1 })
      }).toThrow()
      expect(() => {
        (entry as unknown as Record<string, boolean>).rebuildClamped = true
      }).toThrow()
    }
  })

  it('应用 S5 M3 deterministic now：ctx.timestamp undefined → 用 bars[last].timestamp', () => {
    const bars = makeAdaptiveBars(14, { high: 105, low: 95, close: 100 })
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'adaptive_volatility_grid') {
      expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
    }
  })

  it('应用 S5 M4 cancelOrderPrograms guard pass-through：prev 透传深相等 + cancelledProgramIds', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram()
    const prev: ProgramLifecycleState = {
      kind: 'adaptive_volatility_grid',
      lastBuildATR: 5,
      lastBuildAt: 1_700_000_000_000,
      lastBuildLadder: [{ id: 'a', level: 95 }],
      rebuildClamped: true,
    }
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guardCancelAll, [], undefined, [program],
      { [program.id]: prev },
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext[program.id]).toEqual(prev)
  })

  it('应用 S5 M4：cancelOrderPrograms + 无 prev → cancelledProgramIds + key 缺席', () => {
    const bars = makeAdaptiveBars(14)
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guardCancelAll, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('edge ctx.bars=[] → ATR null → Path B（无 prev）→ cancelled', () => {
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars([], 1_700_000_001_000), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('edge currentClose<=0 → NOOP cancelled（atr_invalid_computation 安全网）', () => {
    const bars = makeAdaptiveBars(14)
    bars[bars.length - 1].close = 0
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })
})

// Phase 5 S12 (#1118): event_listener
function makeEventListenerProgram(
  overrides: Partial<CompiledEventListenerProgram> = {},
): CompiledEventListenerProgram {
  return {
    id: 'orch_event_listener_1',
    programKind: 'event_listener',
    activeWhenExprId: 'expr_gate_regime',
    onDeactivate: 'cancel',
    rebuildPolicy: 'static',
    eventSchemaRef: 'webhook_event',
    sourceFeedId: 'webhook.tradingview.alpha',
    permissionScope: 'tradingview:alpha',
    idempotencyKey: { fieldPath: 'signalId' },
    dedupWindowMs: 5_000,
    expirationTtlMs: 60_000,
    expirationPolicy: 'drop',
    ...overrides,
  }
}

function eventCtx(
  feedEvents: ReadonlyArray<{ id: string; ts: number; payload: Readonly<Record<string, unknown>> }>,
  now: number,
  feedId = 'webhook.tradingview.alpha',
  schemaVersion?: number,
): StrategyExecutionContextV1 {
  return {
    timestamp: now,
    eventInbox: { [feedId]: feedEvents },
    ...(typeof schemaVersion === 'number' ? { eventSchemaVersion: { [feedId]: schemaVersion } } : {}),
  } as StrategyExecutionContextV1
}

describe('runOrderPrograms — event_listener (Phase 5 S12)', () => {
  it('active=true 收事件 → lastEventId / payloadJson 写入；workingOrders/closeProgramIds=0', () => {
    const program = makeEventListenerProgram()
    const events = [
      { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1', side: 'long' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_000_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.workingOrders).toEqual([])
    expect(state.closeProgramIds).toEqual([])
    expect(state.activeProgramIds).toEqual([program.id])
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('event_listener')
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBe('e1')
      expect(entry.lastEventPayloadJson).toBe(canonicalSerialize({ signalId: 'A1', side: 'long' }))
      expect(entry.dedupBuffer).toEqual([{ key: 'A1', ts: 1_700_000_000_000 }])
      expect(entry.escalateCount).toBe(0)
    }
  })

  it('inactive cancel → cancelledProgramIds + 占位 lifecycle (dedupBuffer 清空)', () => {
    const program = makeEventListenerProgram({ onDeactivate: 'cancel' })
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_prev',
      lastEventPayloadJson: '{"x":1}',
      dedupBuffer: Object.freeze([{ key: 'A1', ts: 1_700_000_000_000 }]),
      schemaVersion: 0,
      escalateCount: 0,
    })
    const state = runOrderPrograms(
      eventCtx([], 1_700_000_001_000),
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('event_listener')
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBeNull()
      expect(entry.dedupBuffer).toEqual([])
    }
  })

  it('inactive keep 透传 prev lifecycle 且不读 inbox', () => {
    const program = makeEventListenerProgram({ onDeactivate: 'keep' })
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_prev',
      lastEventPayloadJson: '{"x":1}',
      dedupBuffer: Object.freeze([{ key: 'KEEP', ts: 1_700_000_000_000 }]),
      schemaVersion: 0,
      escalateCount: 2,
    })
    const fresh = [{ id: 'e_new', ts: 1_700_000_002_000, payload: { signalId: 'NEW' } }]
    const state = runOrderPrograms(
      eventCtx(fresh, 1_700_000_002_000),
      [],
      { expr_gate_regime: false },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    expect(state.activeProgramIds).toEqual([program.id])
    expect(state.programLifecycleStateNext[program.id]).toBe(prev)
  })

  it('dedup 命中 → 跳过 + 不更新 lastEvent*', () => {
    const program = makeEventListenerProgram()
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_old',
      lastEventPayloadJson: '{"old":true}',
      dedupBuffer: Object.freeze([{ key: 'A1', ts: 1_700_000_000_000 }]),
      schemaVersion: 0,
      escalateCount: 0,
    })
    const events = [
      { id: 'e_dup', ts: 1_700_000_001_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_001_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('event_listener')
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBe('e_old')
      expect(entry.lastEventPayloadJson).toBe('{"old":true}')
    }
  })

  it('dedup 窗外重新接收 → 旧 key 滚出，新事件写入', () => {
    const program = makeEventListenerProgram()
    // prev 内 ts 为 t-10s（在 5s 窗口外）
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_old',
      lastEventPayloadJson: '{}',
      dedupBuffer: Object.freeze([{ key: 'A1', ts: 1_700_000_000_000 }]),
      schemaVersion: 0,
      escalateCount: 0,
    })
    const events = [
      { id: 'e_new', ts: 1_700_000_010_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_010_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    const entry = state.programLifecycleStateNext[program.id]
    expect(entry?.kind).toBe('event_listener')
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBe('e_new')
      expect(entry.dedupBuffer).toEqual([{ key: 'A1', ts: 1_700_000_010_000 }])
    }
  })

  it('dedup 边界严格 `>`：ts === now-dedupWindowMs 滚出', () => {
    const program = makeEventListenerProgram({ dedupWindowMs: 5_000 })
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_old',
      lastEventPayloadJson: '{}',
      // ts 等于 cutoff
      dedupBuffer: Object.freeze([{ key: 'A1', ts: 1_700_000_000_000 }]),
      schemaVersion: 0,
      escalateCount: 0,
    })
    const events = [
      { id: 'e_new', ts: 1_700_000_005_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_005_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      // 旧条目滚出 → 新事件写入
      expect(entry.lastEventId).toBe('e_new')
      expect(entry.dedupBuffer).toEqual([{ key: 'A1', ts: 1_700_000_005_000 }])
    }
  })

  it('同 ts 同 key 两个事件 → 第二个 dedup 命中（先到先得）', () => {
    const program = makeEventListenerProgram()
    const events = [
      { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1' } },
      { id: 'e2', ts: 1_700_000_000_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_000_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBe('e1')
      expect(entry.dedupBuffer).toEqual([{ key: 'A1', ts: 1_700_000_000_000 }])
    }
  })

  it('dedupBuffer 容量 LRU：注入 1025 唯一 key → buffer ≤ 1024', () => {
    // dedupWindowMs 设大覆盖所有事件；expirationTtlMs 必须严格大于 dedupWindowMs
    const program = makeEventListenerProgram({ dedupWindowMs: 3_600_000, expirationTtlMs: 86_400_000 })
    const events = Array.from({ length: 1025 }, (_, i) => ({
      id: `e${i}`,
      ts: 1_700_000_000_000 + i,
      payload: { signalId: `K${i}` },
    }))
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_001_500),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.dedupBuffer.length).toBe(1024)
      // 最早条目（K0）已滚出
      expect(entry.dedupBuffer[0].key).toBe('K1')
    }
  })

  it('TTL drop：过期事件不写 lastEvent / 不计 escalate', () => {
    const program = makeEventListenerProgram({ expirationTtlMs: 1_000, dedupWindowMs: 500 })
    const events = [
      // ts now-2000 → 过期 1000ms
      { id: 'e_old', ts: 1_700_000_000_000, payload: { signalId: 'OLD' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_002_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBeNull()
      expect(entry.escalateCount).toBe(0)
      expect(entry.dedupBuffer).toEqual([])
    }
  })

  it('TTL escalate：过期事件 escalateCount += 1 累计', () => {
    const program = makeEventListenerProgram({
      expirationPolicy: 'escalate',
      expirationTtlMs: 1_000,
      dedupWindowMs: 500,
    })
    const events = [
      { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A' } },
      { id: 'e2', ts: 1_700_000_000_500, payload: { signalId: 'B' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_002_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.escalateCount).toBe(2)
      expect(entry.lastEventId).toBeNull()
    }
  })

  it('schemaVersion bump：rebuildPolicy=on_schema_version_bump 时清空 dedupBuffer', () => {
    const program = makeEventListenerProgram({ rebuildPolicy: 'on_schema_version_bump' })
    const prev: ProgramLifecycleState = Object.freeze({
      kind: 'event_listener' as const,
      lastEventAt: 1_700_000_000_000,
      lastEventId: 'e_old',
      lastEventPayloadJson: '{}',
      dedupBuffer: Object.freeze([{ key: 'OLD', ts: 1_700_000_000_000 }]),
      schemaVersion: 1,
      escalateCount: 0,
    })
    // 触发 bump：ctx.eventSchemaVersion[feedId] = 2
    const events = [
      { id: 'e_new', ts: 1_700_000_001_000, payload: { signalId: 'OLD' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_001_000, 'webhook.tradingview.alpha', 2),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.schemaVersion).toBe(2)
      // bump 后 prev OLD 条目被清空 → 同 key 新事件可写入
      expect(entry.lastEventId).toBe('e_new')
      expect(entry.dedupBuffer).toEqual([{ key: 'OLD', ts: 1_700_000_001_000 }])
    }
  })

  it('多事件按 ts 升序 stable-sort（输入乱序也 deterministic）', () => {
    const program = makeEventListenerProgram()
    const events = [
      { id: 'e3', ts: 1_700_000_000_300, payload: { signalId: 'C' } },
      { id: 'e1', ts: 1_700_000_000_100, payload: { signalId: 'A' } },
      { id: 'e2', ts: 1_700_000_000_200, payload: { signalId: 'B' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_000_500),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      // 按 ts 排序 → 最后写入应为 ts 最大的事件 e3
      expect(entry.lastEventId).toBe('e3')
      expect(entry.dedupBuffer.map(e => e.key)).toEqual(['A', 'B', 'C'])
    }
  })

  it('kind 不匹配 prev lifecycle → 降级路径（视为初始 state）', () => {
    const program = makeEventListenerProgram()
    const prev: ProgramLifecycleState = { kind: 'fixed_grid_gated' }
    const events = [
      { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_000_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
      { [program.id]: prev },
    )
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBe('e1')
      expect(entry.dedupBuffer).toEqual([{ key: 'A1', ts: 1_700_000_000_000 }])
    }
  })

  it('cancelOrderPrograms guard：进 cancelledProgramIds + 占位 lifecycle', () => {
    const program = makeEventListenerProgram()
    const events = [
      { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1' } },
    ]
    const state = runOrderPrograms(
      eventCtx(events, 1_700_000_000_000),
      [],
      { expr_gate_regime: true },
      guardCancelAll,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    const entry = state.programLifecycleStateNext[program.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.lastEventId).toBeNull()
      expect(entry.dedupBuffer).toEqual([])
    }
  })

  it('isValidEventListener fail-closed：缺 sourceFeedId → cancelled', () => {
    const program = makeEventListenerProgram({ sourceFeedId: '' })
    const state = runOrderPrograms(
      eventCtx([], 1_700_000_000_000),
      [],
      { expr_gate_regime: true },
      guard,
      [],
      undefined,
      [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
  })

  it('永不 push closeProgramIds — W5 不变量回归', () => {
    const matrix: Array<{ active: boolean; deact: 'cancel' | 'keep' }> = [
      { active: true, deact: 'cancel' },
      { active: false, deact: 'cancel' },
      { active: false, deact: 'keep' },
    ]
    for (const m of matrix) {
      const p = makeEventListenerProgram({ onDeactivate: m.deact })
      const state = runOrderPrograms(
        eventCtx([], 1_700_000_000_000),
        [],
        { expr_gate_regime: m.active },
        guard,
        [],
        undefined,
        [p],
      )
      expect(state.closeProgramIds).toEqual([])
    }
  })
})
