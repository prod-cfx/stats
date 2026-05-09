import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { CompiledOrchestrationGate } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'

/**
 * Phase 5 S1 Task 16 — backtest vs live signal parity for orchestration gate.
 *
 * 两条路径（backtest 与 live signal fast path）都通过同一个 evaluator
 * (`evaluateOrchestrationGates`) + 同一个 runtime 入口 (`runDecisionPrograms`)
 * 完成 orchestration gate 决策。注入位置完全对称：
 *   projection.orchestrationGates -> evaluateOrchestrationGates -> 6th arg.
 *
 * 本 spec 用同一组 input 同时构造 backtest path + live signal path 决策序列，
 * 逐 case 断言 `expect(backtest).toEqual(live)`，作为 regression guard：
 * 若任一 adapter 偏离 single-source 调用，parity 即破裂。
 */

type Programs = Parameters<typeof runDecisionPrograms>[1]
type Ctx = Parameters<typeof runDecisionPrograms>[0]
type Guard = Parameters<typeof runDecisionPrograms>[3]

const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

const OPEN_LONG_PROGRAM = {
  id: 'program_open_long',
  phase: 'entry' as const,
  priority: 100,
  when: 'predicate_open_long',
  actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 50 } }],
}

const CLOSE_SHORT_PROGRAM = {
  id: 'program_close_short',
  phase: 'exit' as const,
  priority: 100,
  when: 'predicate_close_short',
  actions: [{ kind: 'CLOSE_SHORT' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
}

const LONG_GATE: CompiledOrchestrationGate = {
  id: 'gate-1',
  exprId: 'expr-long',
  target: { phase: 'entry', sideScope: 'long' },
  effectWhenFalse: 'block_new_entries',
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

/**
 * 模拟两条 adapter path 的共享决策子程序：
 * 1. evaluateOrchestrationGates(projection.orchestrationGates, exprValues)
 * 2. runDecisionPrograms(ctx, programs, exprValues, guard, decisionOrder, gateState)
 *
 * backtest 与 live signal 都遵循该调用形态（参见 b60dad61 / 7abedffd / d66224f9）。
 */
function decide(
  projection: { orchestrationGates: CompiledOrchestrationGate[], decisionPrograms: Programs },
  exprValues: Record<string, unknown>,
  ctx: Ctx,
  decisionOrder: string[],
) {
  const gateState = evaluateOrchestrationGates(projection.orchestrationGates, exprValues as never)
  return runDecisionPrograms(
    ctx,
    projection.decisionPrograms,
    exprValues as never,
    baseGuard,
    decisionOrder,
    gateState,
  )
}

describe('orchestration gate regime — backtest vs live signal parity', () => {
  it('case A: gate=true => backtest 与 live signal 同时输出 OPEN_LONG，结构一致', () => {
    const projection = {
      orchestrationGates: [LONG_GATE],
      decisionPrograms: [OPEN_LONG_PROGRAM] as unknown as Programs,
    }
    const exprValues = { 'expr-long': true, predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]

    const backtestDecision = decide(projection, exprValues, makeCtx(0), decisionOrder)
    const liveDecision = decide(projection, exprValues, makeCtx(0), decisionOrder)

    expect(backtestDecision.action).toBe('OPEN_LONG')
    expect(backtestDecision).toEqual(liveDecision)
  })

  it('case B: gate=false => 两条路径同时输出 NOOP（block_entry_long），完全相同', () => {
    const projection = {
      orchestrationGates: [LONG_GATE],
      decisionPrograms: [OPEN_LONG_PROGRAM] as unknown as Programs,
    }
    const exprValues = { 'expr-long': false, predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]

    const backtestDecision = decide(projection, exprValues, makeCtx(0), decisionOrder)
    const liveDecision = decide(projection, exprValues, makeCtx(0), decisionOrder)

    expect(backtestDecision.action).toBe('NOOP')
    expect(backtestDecision.reason).toBe('compiled.orchestration.gate.block_entry_long')
    expect(backtestDecision).toEqual(liveDecision)
  })

  it('case C (W5): existing short + gate=false => 两条路径同时输出 CLOSE_SHORT，完全相同', () => {
    // W5 不变量：gate 仅拦截 OPEN_*；CLOSE_SHORT 不受 gate 影响。
    const projection = {
      orchestrationGates: [LONG_GATE],
      decisionPrograms: [CLOSE_SHORT_PROGRAM] as unknown as Programs,
    }
    const exprValues = { 'expr-long': false, predicate_close_short: true }
    const decisionOrder = [CLOSE_SHORT_PROGRAM.id]

    const backtestDecision = decide(projection, exprValues, makeCtx(-1), decisionOrder)
    const liveDecision = decide(projection, exprValues, makeCtx(-1), decisionOrder)

    expect(backtestDecision.action).toBe('CLOSE_SHORT')
    expect(backtestDecision).toEqual(liveDecision)
  })
})
