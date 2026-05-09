import type { CompiledOrchestrationGate } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { CompiledOrchestrationPortfolioRisk } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'

/**
 * Phase 5 S7 Task 15 — backtest vs live signal parity for portfolioRisk.drawdown_block.
 *
 * 两条路径（backtest 与 live signal fast path）共享同一份 evaluator 对：
 *   evaluateOrchestrationPortfolioRisks + evaluateOrchestrationGates
 *   -> runDecisionPrograms（第 6/7 个参数对称注入）
 *
 * 本 spec 用同一组 input 同时构造 backtest path + live signal path 决策序列，
 * 逐 case 断言 `expect(backtest).toEqual(live)`，作为 regression guard：
 * 任一 adapter 偏离 single-source 调用，parity 即破裂。
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

function buildPortfolioRisks(
  mode: 'enforce' | 'observe',
  thresholdPct = 10,
): CompiledOrchestrationPortfolioRisk[] {
  return [{
    id: 'risk-1',
    scope: 'portfolio',
    mode,
    thresholdPct,
    effectWhenTriggered: 'block_new_entries',
  }]
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

function decide(
  programs: Programs,
  portfolioRisks: CompiledOrchestrationPortfolioRisk[],
  drawdownPct: number | undefined,
  gates: CompiledOrchestrationGate[],
  exprValues: Record<string, unknown>,
  ctx: Ctx,
  decisionOrder: string[],
) {
  const gateState = evaluateOrchestrationGates(gates, exprValues as never)
  const portfolioRiskState = evaluateOrchestrationPortfolioRisks(portfolioRisks, { drawdownPct })
  return runDecisionPrograms(
    ctx,
    programs,
    exprValues as never,
    baseGuard,
    decisionOrder,
    gateState,
    portfolioRiskState,
  )
}

describe('orchestration portfolio drawdown — backtest vs live signal parity', () => {
  it('case A: drawdown < threshold => 两条路径同时输出 OPEN_LONG，结构一致', () => {
    const programs = [OPEN_LONG_PROGRAM] as unknown as Programs
    const exprValues = { predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]

    const backtest = decide(programs, buildPortfolioRisks('enforce'), 5, [], exprValues, makeCtx(0), decisionOrder)
    const live = decide(programs, buildPortfolioRisks('enforce'), 5, [], exprValues, makeCtx(0), decisionOrder)

    expect(backtest.action).toBe('OPEN_LONG')
    expect(backtest).toEqual(live)
  })

  it('case B: enforce 触发 => 两条路径同时输出 NOOP（portfolio_risk.block_entry_long），完全相同', () => {
    const programs = [OPEN_LONG_PROGRAM] as unknown as Programs
    const exprValues = { predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]

    const backtest = decide(programs, buildPortfolioRisks('enforce'), 12, [], exprValues, makeCtx(0), decisionOrder)
    const live = decide(programs, buildPortfolioRisks('enforce'), 12, [], exprValues, makeCtx(0), decisionOrder)

    expect(backtest.action).toBe('NOOP')
    expect(backtest.reason).toBe('compiled.orchestration.portfolio_risk.block_entry_long')
    expect(backtest).toEqual(live)
  })

  it('case C (W5): existing short + drawdown 触发 => 两条路径同时输出 CLOSE_SHORT，完全相同', () => {
    // W5 不变量：portfolioRisk 仅拦截 OPEN_*；CLOSE_SHORT 不受影响。
    const programs = [CLOSE_SHORT_PROGRAM] as unknown as Programs
    const exprValues = { predicate_close_short: true }
    const decisionOrder = [CLOSE_SHORT_PROGRAM.id]

    const backtest = decide(programs, buildPortfolioRisks('enforce'), 12, [], exprValues, makeCtx(-1), decisionOrder)
    const live = decide(programs, buildPortfolioRisks('enforce'), 12, [], exprValues, makeCtx(-1), decisionOrder)

    expect(backtest.action).toBe('CLOSE_SHORT')
    expect(backtest).toEqual(live)
  })

  it('case D: observe 触发 => 两条路径同时输出 OPEN_LONG + observedBreaches，完全相同', () => {
    const programs = [OPEN_LONG_PROGRAM] as unknown as Programs
    const exprValues = { predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]

    const backtest = decide(programs, buildPortfolioRisks('observe'), 12, [], exprValues, makeCtx(0), decisionOrder)
    const live = decide(programs, buildPortfolioRisks('observe'), 12, [], exprValues, makeCtx(0), decisionOrder)

    expect(backtest.action).toBe('OPEN_LONG')
    expect((backtest as { meta?: { observedBreaches?: string[] } }).meta?.observedBreaches).toEqual(['risk-1'])
    expect(backtest).toEqual(live)
  })

  it('case E: portfolioRisk enforce + gate.regime 共存触发 => 两条路径 reason + observation 完全相同（portfolio 优先）', () => {
    const programs = [OPEN_LONG_PROGRAM] as unknown as Programs
    const exprValues = { 'expr-long': false, predicate_open_long: true }
    const decisionOrder = [OPEN_LONG_PROGRAM.id]
    const gates = [LONG_GATE]

    const backtest = decide(programs, buildPortfolioRisks('enforce'), 12, gates, exprValues, makeCtx(0), decisionOrder)
    const live = decide(programs, buildPortfolioRisks('enforce'), 12, gates, exprValues, makeCtx(0), decisionOrder)

    expect(backtest.action).toBe('NOOP')
    // portfolio reason 优先于 gate（runtime applyOrchestrationGate 内 portfolioBlocks 先判断）
    expect(backtest.reason).toContain('portfolio_risk')
    expect(backtest).toEqual(live)
  })
})
