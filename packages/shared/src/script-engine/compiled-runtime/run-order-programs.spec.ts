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
    const programs: CompiledOrchestrationProgram[] = [
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

// ===== Phase 5 S6 (#984) adaptive_volatility_grid =====

import type { CompiledAdaptiveVolatilityGridProgram } from './compiled-orchestration-program'

function makeBars(period: number, options: {
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
  const ctxWithBars = (bars: ReturnType<typeof makeBars>, timestamp?: number): StrategyExecutionContextV1 =>
    ({ bars, ...(timestamp !== undefined ? { timestamp } : {}) }) as unknown as StrategyExecutionContextV1

  it('Path 1 fail-closed: 非法 atrMultiplier=0 → cancelled，不写 lifecycle entry', () => {
    const bars = makeBars(14)
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
    const bars = makeBars(14, { high: 100.5, low: 99.5, close: 100 })
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
    const bars = makeBars(14, { high: 105, low: 95, close: 100 })
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
    const bars = makeBars(14, { high: 100.01, low: 99.99, close: 100 })
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
    const tooFew = makeBars(14, { count: 5 })  // bars 不足以产出 ATR
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
    const tooFew = makeBars(14, { count: 3 })
    const state = runOrderPrograms(
      ctxWithBars(tooFew), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('Path 7 cooldown：drift ≥ threshold + 距上次 < cooldown → throttled + 保留旧 ladder + reason', () => {
    const program = makeAdaptiveProgram({}, { atrDriftPct: 1, rebuildCooldownSec: 600 })
    const bars = makeBars(14, { high: 110, low: 90, close: 100 })  // 大波动
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
    const bars = makeBars(14, { high: 105, low: 95, close: 100 })
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
    const bars = makeBars(14)
    const program = makeAdaptiveProgram({ onDeactivate: 'cancel' })
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: false }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })

  it('Path 4 inactive cancel：onDeactivate=cancel + 有 prev → 透传 prev（critic round 3 fix）', () => {
    const bars = makeBars(14)
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
    const bars1 = makeBars(14, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_000_000 })
    const r1 = runOrderPrograms(ctxWithBars(bars1), [], { expr_gate_regime: true }, guard, [], undefined, [program], lifecycleMap)
    Object.assign(lifecycleMap, r1.programLifecycleStateNext)
    const buildEntry = lifecycleMap[program.id]
    expect(buildEntry?.kind).toBe('adaptive_volatility_grid')
    // K2 inactive(cancel) → 透传 prev（不丢弃 cooldown 上下文）
    const bars2 = makeBars(14, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_120_000 })
    const r2 = runOrderPrograms(ctxWithBars(bars2), [], { expr_gate_regime: false }, guard, [], undefined, [program], lifecycleMap)
    Object.assign(lifecycleMap, r2.programLifecycleStateNext)
    expect(r2.cancelledProgramIds).toContain(program.id)
    expect(lifecycleMap[program.id]).toEqual(buildEntry)
    // K3 active + ATR 突变 → drift 大但 cooldown=600s 未到 → throttled（cooldown 硬下限保护生效）
    const bars3 = makeBars(14, { high: 105, low: 95, close: 100, startTimestamp: 1_700_000_240_000 })
    const r3 = runOrderPrograms(ctxWithBars(bars3), [], { expr_gate_regime: true }, guard, [], undefined, [program], lifecycleMap)
    const wo3 = r3.workingOrders.find(w => w.id === program.id)
    expect((wo3?.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.rebuild_throttled')
  })

  it('Path 4 inactive close：activeWhen=false + onDeactivate=close → closeProgramIds + 透传 prev', () => {
    const bars = makeBars(14)
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
    const bars = makeBars(14)
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
    const bars = makeBars(14, { high: 105, low: 95, close: 100 })
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
    const bars = makeBars(14, { high: 105, low: 95, close: 100 })
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
    const bars = makeBars(14)
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
    const bars = makeBars(14)
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
    const bars = makeBars(14)
    bars[bars.length - 1].close = 0
    const program = makeAdaptiveProgram()
    const state = runOrderPrograms(
      ctxWithBars(bars), [], { expr_gate_regime: true }, guard, [], undefined, [program],
    )
    expect(state.cancelledProgramIds).toContain(program.id)
    expect(state.programLifecycleStateNext).not.toHaveProperty(program.id)
  })
})
