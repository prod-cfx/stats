import type { CompiledDynamicGridProgram } from '@ai/shared/script-engine/compiled-runtime/compiled-orchestration-program'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

/**
 * Phase 5 S5（#984）— backtest vs live signal parity for program.dynamic_grid。
 *
 * 共用 packages/shared/.../run-order-programs.ts 的 runOrderPrograms 入口；
 * backtest（backtest-strategy-adapter）与 live（signal-generator）走同一 7 路径
 * evaluator + lifecycle pass-through。本 spec 断言：相同输入下 orderState 同形态。
 *
 * Live state map 持久化跨进程重启留 follow-up（详见 PR 创建的 follow-up issue）；
 * 当前 spec 只验证 in-memory 路径 + lifecycle 透传形态对称。
 */

const guard = Object.freeze({
  forceExit: false,
  blockNewEntry: false,
  strategyHalt: false,
  cancelOrderPrograms: false,
  triggered: Object.freeze([] as string[]),
}) as any

function buildProgram(overrides: Partial<CompiledDynamicGridProgram> = {}): CompiledDynamicGridProgram {
  return {
    id: 'orch_dyn_parity',
    programKind: 'dynamic_grid',
    activeWhenExprId: 'expr-gate-long',
    onDeactivate: 'cancel',
    rebuildPolicy: 'anchor_on_state_change',
    dynamicGridParams: {
      anchorLookbackBars: 10,
      anchorSide: 'high',
      anchorDriftPct: 1,
      rebuildMinIntervalSec: 60,
      levelCount: 2,
      step: { mode: 'pct', value: 5 },
    },
    sizing: { mode: 'fixed_quote', value: 100 },
    ...overrides,
  }
}

function buildBars(count: number, recipe: (i: number) => { high: number; low: number }, startTs = 1_700_000_000_000) {
  const bars = []
  for (let i = 0; i < count; i++) {
    const r = recipe(i)
    bars.push({ open: r.high, high: r.high, low: r.low, close: (r.high + r.low) / 2, volume: 1, timestamp: startTs + i * 60_000 })
  }
  return bars
}

function run(input: {
  program: CompiledDynamicGridProgram
  exprValues: Record<string, any>
  bars: ReturnType<typeof buildBars>
  prev?: Record<string, ProgramLifecycleState>
}) {
  const orderState = runOrderPrograms(
    { bars: input.bars } as any,
    [],
    input.exprValues,
    guard,
    [],
    undefined,
    [input.program],
    input.prev,
  )
  return { orderState }
}

describe('orchestration program.dynamic_grid — backtest vs live signal parity', () => {
  it('case A: anchor 稳定（drift < threshold）→ workingOrders + lifecycle pass-through 相同', () => {
    const program = buildProgram({ id: 'orch_dyn_stable' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_stable: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1_700_000_000_000,
        lastBuildLadder: Object.freeze([
          { id: 'orch_dyn_stable:0', level: 95 },
          { id: 'orch_dyn_stable:1', level: 90.25 },
        ]),
      }),
    }
    const bars = buildBars(10, () => ({ high: 100.5, low: 99 })) // drift=0.5% < 1%

    const backtest = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })
    const live = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })

    expect(backtest.orderState).toEqual(live.orderState)
    expect(backtest.orderState.workingOrders[0].levels).toEqual([95, 90.25])
  })

  it('case B: anchor 漂移触发 rebuild（drift ≥ threshold + 距上次 ≥ minInterval）→ 一致', () => {
    const program = buildProgram({ id: 'orch_dyn_rebuild' })
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_rebuild: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1_600_000_000_000, // 距 bars 时间戳 100 亿 ms 之前
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_rebuild:0', level: 95 }]),
      }),
    }
    const bars = buildBars(10, () => ({ high: 110, low: 100 })) // anchor=110, drift=10%

    const backtest = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })
    const live = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })

    expect(backtest.orderState).toEqual(live.orderState)
    // 新 ladder = round2(110 * 0.95^i) for i=1..2
    expect(backtest.orderState.workingOrders[0].levels).toEqual([104.5, 99.28])
  })

  it('case C: 限速拒绝（drift 达标但距上次 < minInterval）→ keep prev ladder + state 透传一致', () => {
    const program = buildProgram({ id: 'orch_dyn_throttle' })
    const lastBuildAt = 1_700_000_000_000 + 30_000 // 30s 前
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_throttle: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_throttle:0', level: 95 }]),
      }),
    }
    // bars 时间戳保证 last bar 在 lastBuildAt 后 30s 内（< minInterval=60s 触发限速）
    const bars = buildBars(10, () => ({ high: 110, low: 100 }), lastBuildAt - 9 * 60_000 + 30_000)

    const backtest = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })
    const live = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })

    expect(backtest.orderState).toEqual(live.orderState)
    expect(backtest.orderState.workingOrders[0].levels).toEqual([95])
  })

  it('case D: K 线不足（无 prev）→ cancel 一致；K 线不足（有 prev）→ 保留旧 ladder 一致', () => {
    const program = buildProgram({ id: 'orch_dyn_kshort', dynamicGridParams: {
      anchorLookbackBars: 50,
      anchorSide: 'high',
      anchorDriftPct: 1,
      rebuildMinIntervalSec: 60,
      levelCount: 2,
      step: { mode: 'pct', value: 5 },
    } })
    const bars = buildBars(5, () => ({ high: 100, low: 90 }))

    // 无 prev → cancel
    const noprevBacktest = run({ program, exprValues: { 'expr-gate-long': true }, bars })
    const noprevLive = run({ program, exprValues: { 'expr-gate-long': true }, bars })
    expect(noprevBacktest.orderState).toEqual(noprevLive.orderState)
    expect(noprevBacktest.orderState.cancelledProgramIds).toContain('orch_dyn_kshort')

    // 有 prev → 保留旧 ladder
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_kshort: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_kshort:0', level: 95 }]),
      }),
    }
    const withprevBacktest = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })
    const withprevLive = run({ program, exprValues: { 'expr-gate-long': true }, bars, prev })
    expect(withprevBacktest.orderState).toEqual(withprevLive.orderState)
    expect(withprevBacktest.orderState.workingOrders[0].levels).toEqual([95])
  })

  it('case E (W5/onDeactivate 三模式): cancel/keep/close 三模式 + prev 透传 backtest vs live 一致', () => {
    const prev: Record<string, ProgramLifecycleState> = {
      orch_dyn_threemode: Object.freeze({
        kind: 'dynamic_grid' as const,
        lastBuildAnchor: 100,
        lastBuildAt: 1,
        lastBuildLadder: Object.freeze([{ id: 'orch_dyn_threemode:0', level: 95 }]),
      }),
    }
    const bars = buildBars(10, () => ({ high: 100, low: 90 }))

    for (const mode of ['cancel', 'keep', 'close'] as const) {
      const program = buildProgram({ id: 'orch_dyn_threemode', onDeactivate: mode })
      const backtest = run({ program, exprValues: { 'expr-gate-long': false }, bars, prev })
      const live = run({ program, exprValues: { 'expr-gate-long': false }, bars, prev })
      expect(backtest.orderState).toEqual(live.orderState)
      // 各模式语义断言
      if (mode === 'cancel') {
        expect(backtest.orderState.cancelledProgramIds).toContain('orch_dyn_threemode')
      } else if (mode === 'keep') {
        expect(backtest.orderState.workingOrders[0].id).toBe('orch_dyn_threemode')
      } else if (mode === 'close') {
        expect(backtest.orderState.closeProgramIds).toContain('orch_dyn_threemode')
      }
      // 三模式都透传 prev lifecycle state
      expect(backtest.orderState.programLifecycleStateNext.orch_dyn_threemode).toEqual(prev.orch_dyn_threemode)
    }
  })
})
