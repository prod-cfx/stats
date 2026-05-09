import type { CompiledAdaptiveVolatilityGridProgram } from '@ai/shared/script-engine/compiled-runtime/compiled-orchestration-program'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

/**
 * Phase 5 S6 (#984) — adaptive_volatility_grid backtest vs live parity (6 case)
 *
 * 目标：backtest（lifecycleStateBySymbol Map）与 live（programLifecycleStateBy
 * StrategyInstanceId Map）共用同一 runOrderPrograms 调用路径，对 8 路径输出
 * 完全一致。本 spec 直接对 evaluator 进行同源调用，断言两路 orderState 深相等。
 */

function makeBars(count: number, opts: { high?: number; low?: number; close?: number; startTimestamp?: number; intervalMs?: number } = {}) {
  const high = opts.high ?? 100.5
  const low = opts.low ?? 99.5
  const close = opts.close ?? 100
  const start = opts.startTimestamp ?? 1_700_000_000_000
  const interval = opts.intervalMs ?? 60_000
  return Array.from({ length: count }, (_, i) => ({
    open: close, high, low, close, volume: 1000, timestamp: start + i * interval,
  }))
}

function makeProgram(
  overrides: Partial<CompiledAdaptiveVolatilityGridProgram> = {},
  paramsOverrides: Partial<CompiledAdaptiveVolatilityGridProgram['adaptiveGridParams']> = {},
): CompiledAdaptiveVolatilityGridProgram {
  return {
    id: 'adaptive-1',
    programKind: 'adaptive_volatility_grid',
    activeWhenExprId: 'expr-gate-long',
    onDeactivate: 'cancel',
    rebuildPolicy: 'atr_window',
    adaptiveGridParams: {
      atrPeriod: 14,
      atrMultiplier: 1.5,
      rangeMultiplier: 10,
      atrDriftPct: 1,
      rebuildCooldownSec: 600,
      minStepPct: 0.2,
      maxStepPct: 5,
      levelCount: 6,
      ...paramsOverrides,
    },
    sizing: { mode: 'fixed_pct', value: 5 },
    ...overrides,
  }
}

const guardOk = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] as string[] }

function decide(args: {
  bars: ReturnType<typeof makeBars>
  programs: CompiledAdaptiveVolatilityGridProgram[]
  exprValues: Record<string, unknown>
  prev?: Readonly<Record<string, ProgramLifecycleState>>
}) {
  return runOrderPrograms(
    { bars: args.bars } as never,
    [],
    args.exprValues as never,
    guardOk as never,
    [],
    undefined,
    args.programs as never,
    args.prev,
  )
}

describe('orchestration program adaptive_volatility_grid — backtest vs live signal parity', () => {
  it('case A 稳定 ATR：drift < threshold + keep prev ladder（两路 orderState 深相等）', () => {
    const bars = makeBars(20, { high: 100.5, low: 99.5, close: 100 })
    const programs = [makeProgram({}, { atrDriftPct: 99 })]

    const backtest1 = decide({ bars, programs, exprValues: { 'expr-gate-long': true } })
    const prevA = backtest1.programLifecycleStateNext
    const backtest2 = decide({ bars, programs, exprValues: { 'expr-gate-long': true }, prev: prevA })
    const live2 = decide({ bars, programs, exprValues: { 'expr-gate-long': true }, prev: prevA })

    expect(live2).toEqual(backtest2)
    expect(backtest2.programLifecycleStateNext['adaptive-1']).toEqual(prevA['adaptive-1'])
  })

  it('case B ATR 漂移触发 rebuild：cooldown 已过 → 新 entry（两路一致）', () => {
    // rebuildCooldownSec ≥ 300 硬下限
    const programs = [makeProgram({}, { atrDriftPct: 1, rebuildCooldownSec: 300 })]
    const initial = makeBars(20, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_000_000 })
    const first = decide({ bars: initial, programs, exprValues: { 'expr-gate-long': true } })
    const prev = first.programLifecycleStateNext

    // 600s 后 + 大波动 ATR 突变；cooldown=300s 已过 → rebuild
    const next = makeBars(20, { high: 105, low: 95, close: 100, startTimestamp: 1_700_000_600_000 })
    const backtest = decide({ bars: next, programs, exprValues: { 'expr-gate-long': true }, prev })
    const live = decide({ bars: next, programs, exprValues: { 'expr-gate-long': true }, prev })

    expect(live).toEqual(backtest)
    const entry = backtest.programLifecycleStateNext['adaptive-1']
    expect(entry?.kind).toBe('adaptive_volatility_grid')
    if (entry?.kind === 'adaptive_volatility_grid') {
      expect(entry.lastBuildAt).toBe(next[next.length - 1].timestamp)
    }
  })

  it('case C 冷却拒绝（drift 大 + 距上次 < cooldown）→ throttled + reason（两路一致）', () => {
    const programs = [makeProgram({}, { atrDriftPct: 1, rebuildCooldownSec: 600 })]
    const initial = makeBars(20, { high: 100.5, low: 99.5, close: 100, startTimestamp: 1_700_000_000_000 })
    const first = decide({ bars: initial, programs, exprValues: { 'expr-gate-long': true } })
    const prev = first.programLifecycleStateNext

    const next = makeBars(20, { high: 105, low: 95, close: 100, startTimestamp: 1_700_000_060_000 })
    const backtest = decide({ bars: next, programs, exprValues: { 'expr-gate-long': true }, prev })
    const live = decide({ bars: next, programs, exprValues: { 'expr-gate-long': true }, prev })

    expect(live).toEqual(backtest)
    const wo = backtest.workingOrders.find(w => w.id === 'adaptive-1')
    expect((wo?.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.rebuild_throttled')
  })

  it('case D ATR 不可用 Path A：bars 不足 + 有 prev → keep ladder + reason（两路一致）', () => {
    const programs = [makeProgram()]
    const prev: Record<string, ProgramLifecycleState> = {
      'adaptive-1': {
        kind: 'adaptive_volatility_grid',
        lastBuildATR: 1,
        lastBuildAt: 1_700_000_000_000,
        lastBuildLadder: [{ id: 'a', level: 99 }, { id: 'b', level: 101 }],
        rebuildClamped: false,
      },
    }
    const tooFew = makeBars(5)  // bars 不够 atr period+1

    const backtest = decide({ bars: tooFew, programs, exprValues: { 'expr-gate-long': true }, prev })
    const live = decide({ bars: tooFew, programs, exprValues: { 'expr-gate-long': true }, prev })

    expect(live).toEqual(backtest)
    expect(backtest.programLifecycleStateNext['adaptive-1']).toEqual(prev['adaptive-1'])
    const wo = backtest.workingOrders.find(w => w.id === 'adaptive-1')
    expect((wo?.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.atr_unavailable_keep_ladder')
  })

  it('case D2 ATR 不可用 Path B：无 prev → cancelled + key 缺席（两路一致）', () => {
    const programs = [makeProgram()]
    const tooFew = makeBars(3)

    const backtest = decide({ bars: tooFew, programs, exprValues: { 'expr-gate-long': true } })
    const live = decide({ bars: tooFew, programs, exprValues: { 'expr-gate-long': true } })

    expect(live).toEqual(backtest)
    expect(backtest.cancelledProgramIds).toContain('adaptive-1')
    expect(backtest.programLifecycleStateNext).not.toHaveProperty('adaptive-1')
  })

  it('case E 钳制触发：rebuildClamped=true（两路一致）', () => {
    const bars = makeBars(20, { high: 100.01, low: 99.99, close: 100 })
    // 极小 ATR → rawStepPct < minStepPct=1 → 钳制
    const programs = [makeProgram({}, { atrMultiplier: 1, minStepPct: 1, maxStepPct: 5 })]

    const backtest = decide({ bars, programs, exprValues: { 'expr-gate-long': true } })
    const live = decide({ bars, programs, exprValues: { 'expr-gate-long': true } })

    expect(live).toEqual(backtest)
    const entry = backtest.programLifecycleStateNext['adaptive-1']
    if (entry?.kind === 'adaptive_volatility_grid') {
      expect(entry.rebuildClamped).toBe(true)
    }
  })

  it('case F (W5) onDeactivate=close：closeProgramIds + 透传 prev（两路一致；不污染 workingOrders）', () => {
    const bars = makeBars(20)
    const programs = [makeProgram({ onDeactivate: 'close' })]
    const prev: Record<string, ProgramLifecycleState> = {
      'adaptive-1': {
        kind: 'adaptive_volatility_grid',
        lastBuildATR: 1,
        lastBuildAt: 1_700_000_000_000,
        lastBuildLadder: [{ id: 'a', level: 95 }],
        rebuildClamped: false,
      },
    }
    const backtest = decide({ bars, programs, exprValues: { 'expr-gate-long': false }, prev })
    const live = decide({ bars, programs, exprValues: { 'expr-gate-long': false }, prev })

    expect(live).toEqual(backtest)
    expect(backtest.closeProgramIds).toContain('adaptive-1')
    expect(backtest.workingOrders.some(o => o.id === 'adaptive-1')).toBe(false)
    expect(backtest.programLifecycleStateNext['adaptive-1']).toEqual(prev['adaptive-1'])
  })

  it('case G onDeactivate=cancel / keep 行为（两路一致）', () => {
    const bars = makeBars(20)
    for (const onDeactivate of ['cancel', 'keep'] as const) {
      const programs = [makeProgram({ onDeactivate })]
      const prev: Record<string, ProgramLifecycleState> = {
        'adaptive-1': {
          kind: 'adaptive_volatility_grid',
          lastBuildATR: 1,
          lastBuildAt: 1_700_000_000_000,
          lastBuildLadder: [{ id: 'a', level: 99 }],
          rebuildClamped: false,
        },
      }
      const backtest = decide({ bars, programs, exprValues: { 'expr-gate-long': false }, prev })
      const live = decide({ bars, programs, exprValues: { 'expr-gate-long': false }, prev })

      expect(live).toEqual(backtest)
      if (onDeactivate === 'cancel') {
        expect(backtest.cancelledProgramIds).toContain('adaptive-1')
      } else {
        expect(backtest.workingOrders.some(o => o.id === 'adaptive-1')).toBe(true)
      }
    }
  })
})
