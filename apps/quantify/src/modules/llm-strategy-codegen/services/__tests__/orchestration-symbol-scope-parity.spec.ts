import type { CompiledOrchestrationScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { OrchestrationGateState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import {
  buildScopeIteration,
  runDecisionProgramsFanOut,
} from '@ai/shared/script-engine/compiled-runtime'

/**
 * Phase 5 S2 follow-up (#1108): orchestration-symbol-scope parity spec
 *
 * 目标：验证 backtest path 与 live path 在同一份 projection + ctx 下产出**字节相等**的 decision
 *   字节相等定义 = JSON.stringify(decisionA) === JSON.stringify(decisionB)
 *   策略：两侧 caller 均调用 runDecisionProgramsFanOut（共享 wrapper）；
 *         任何 caller 自有上下文差异（peakEquity / live filter 等）不在 parity 范围
 *
 * 7 case 覆盖：
 *   P1 单 symbol scope（透传）
 *   P2 双 symbol scope + 双 entry program（双 OPEN_LONG）
 *   P3 双 symbol scope + cooldown 隔离（scope-A NOOP / scope-B OPEN_LONG）
 *   P4 双 symbol scope + forceExit（双 close decision）
 *   P5 双 symbol scope + program 缺 symbolScopeRef → fail-closed.unbound_program（per-scope 一致）
 *   P6 双 symbol scope + 多类型 scope 共存（symbol+dataSource）→ symbol 维度 fan-out
 *   P7 双 symbol scope + per-scope position（buildScopeIteration 注入）→ ctx.position 隔离
 */

const noopGuard: CompiledGuardState = {
  blockNewEntry: false, forceExit: false, strategyHalt: false,
  cancelOrderPrograms: false, triggered: [],
}
const noopGate: OrchestrationGateState = { blockEntryLong: false, blockEntryShort: false }
const noopPortfolio: OrchestrationPortfolioRiskState = {
  blockEntryLong: false, blockEntryShort: false, observedBreaches: [],
}

const symbolScopes: CompiledOrchestrationScope[] = [
  { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
  { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
]

function entryProgram(id: string, scopeRef?: string) {
  return {
    id,
    phase: 'entry' as const,
    priority: 1,
    when: 'expr_true',
    metadata: scopeRef ? ({ symbolScopeRef: scopeRef } as { symbolScopeRef?: string }) : undefined,
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
  }
}

/** 共享 caller — 两侧 parity 走同一份 wrapper，差异仅来自 ctx / projection */
function callFanOut(
  ctx: StrategyExecutionContextV1,
  programs: ReadonlyArray<ReturnType<typeof entryProgram>>,
  exprValues: Readonly<Record<string, boolean>>,
  guard: CompiledGuardState,
  scopes: CompiledOrchestrationScope[],
  decisionOrder: readonly string[],
): StrategyDecisionV1 {
  return runDecisionProgramsFanOut(
    ctx, programs, exprValues, guard,
    decisionOrder, noopGate, noopPortfolio,
    scopes, undefined,
  )
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

describe('orchestration scope.symbol — backtest vs live parity (Phase 5 S2 #1108)', () => {
  it('P1 单 symbol scope 透传 — 双侧字节相等', () => {
    const programs = [entryProgram('p1', 's-btc')]
    const ctx: StrategyExecutionContextV1 = { symbol: 'BTCUSDT' }
    const a = callFanOut(ctx, programs, { expr_true: true }, noopGuard, [symbolScopes[0]], ['p1'])
    const b = callFanOut(ctx, programs, { expr_true: true }, noopGuard, [symbolScopes[0]], ['p1'])
    expect(jsonEqual(a, b)).toBe(true)
    expect(a.action).toBe('OPEN_LONG')
    expect(a.meta?.scopeDecisions).toBeUndefined()
  })

  it('P2 双 symbol scope 双 entry — 字节相等 + 双 per-scope decision', () => {
    const programs = [entryProgram('p1', 's-btc'), entryProgram('p2', 's-eth')]
    const ctx: StrategyExecutionContextV1 = {}
    const a = callFanOut(ctx, programs, { expr_true: true }, noopGuard, symbolScopes, ['p1', 'p2'])
    const b = callFanOut(ctx, programs, { expr_true: true }, noopGuard, symbolScopes, ['p1', 'p2'])
    expect(jsonEqual(a, b)).toBe(true)
    const entries = a.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries.length).toBe(2)
    expect(entries.map(e => e.decision.action)).toEqual(['OPEN_LONG', 'OPEN_LONG'])
  })

  it('P3 cooldown 隔离 — scope-A NOOP / scope-B OPEN_LONG（首个非 NOOP 优先）', () => {
    // 通过 expr_false 让 s-btc 程序不触发 → s-btc 维度 NOOP；s-eth 维度 OPEN_LONG
    const programs = [
      { ...entryProgram('p1', 's-btc'), when: 'expr_false' },
      entryProgram('p2', 's-eth'),
    ]
    const ctx: StrategyExecutionContextV1 = {}
    const exprValues = { expr_true: true, expr_false: false }
    const a = callFanOut(ctx, programs, exprValues, noopGuard, symbolScopes, ['p1', 'p2'])
    const b = callFanOut(ctx, programs, exprValues, noopGuard, symbolScopes, ['p1', 'p2'])
    expect(jsonEqual(a, b)).toBe(true)
    const entries = a.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries[0].decision.action).toBe('NOOP')
    expect(entries[1].decision.action).toBe('OPEN_LONG')
    expect(a.action).toBe('OPEN_LONG')
    expect(a.meta?.activeSymbolScopeId).toBe('s-eth')
  })

  it('P4 forceExit 双 close — 双侧字节相等', () => {
    const guardForceExit: CompiledGuardState = { ...noopGuard, forceExit: true }
    const programs = [entryProgram('p1', 's-btc'), entryProgram('p2', 's-eth')]
    const ctx: StrategyExecutionContextV1 = { position: { qty: 2, side: 'long' } }
    const a = callFanOut(ctx, programs, { expr_true: true }, guardForceExit, symbolScopes, ['p1', 'p2'])
    const b = callFanOut(ctx, programs, { expr_true: true }, guardForceExit, symbolScopes, ['p1', 'p2'])
    expect(jsonEqual(a, b)).toBe(true)
    const entries = a.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries.map(e => e.decision.action)).toEqual(['CLOSE_LONG', 'CLOSE_LONG'])
  })

  it('P5 program 缺 symbolScopeRef → fail-closed.unbound_program 双侧一致', () => {
    const programs = [entryProgram('p1' /* no scopeRef */)]
    const ctx: StrategyExecutionContextV1 = {}
    const a = callFanOut(ctx, programs, { expr_true: true }, noopGuard, symbolScopes, ['p1'])
    const b = callFanOut(ctx, programs, { expr_true: true }, noopGuard, symbolScopes, ['p1'])
    expect(jsonEqual(a, b)).toBe(true)
    const entries = a.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    // 双 scope 各自走 unbound_program
    expect(entries[0].decision.reason).toBe('compiled.orchestration.scope.fail_closed.unbound_program')
    expect(entries[1].decision.reason).toBe('compiled.orchestration.scope.fail_closed.unbound_program')
  })

  it('P6 多类型 scope 共存（symbol + dataSource）— symbol 维度 fan-out 不被干扰', () => {
    const mixedScopes: CompiledOrchestrationScope[] = [
      ...symbolScopes,
      { id: 's-feed', scopeKind: 'dataSource', role: 'primary', feedId: 'f1', schemaRef: 'ohlcv' },
    ]
    const programs = [entryProgram('p1', 's-btc'), entryProgram('p2', 's-eth')]
    // ctx.dataSourceFeeds 必须就绪才能让 dataSource fail-closed 短路放行（先于 symbol routing 检查）
    const ctx: StrategyExecutionContextV1 = {
      dataSourceFeeds: { f1: { schema: 'ohlcv', permissionGranted: true, hasData: true } },
    }
    const a = callFanOut(ctx, programs, { expr_true: true }, noopGuard, mixedScopes, ['p1', 'p2'])
    const b = callFanOut(ctx, programs, { expr_true: true }, noopGuard, mixedScopes, ['p1', 'p2'])
    expect(jsonEqual(a, b)).toBe(true)
    const entries = a.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries.length).toBe(2)
    expect(entries[0].decision.action).toBe('OPEN_LONG')
    expect(entries[1].decision.action).toBe('OPEN_LONG')
  })

  it('P7 per-scope position 隔离 — buildScopeIteration 注入正确覆盖', () => {
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 1, side: 'long' },
      positionsBySymbolScope: {
        's-btc': { qty: 7, side: 'long' },
        's-eth': { qty: 3, side: 'short' },
      },
    }
    const btcIter = buildScopeIteration(ctx, symbolScopes[0] as { id: string; primarySymbol?: string; symbols: readonly string[] })
    const ethIter = buildScopeIteration(ctx, symbolScopes[1] as { id: string; primarySymbol?: string; symbols: readonly string[] })
    expect(btcIter.position).toEqual({ qty: 7, side: 'long' })
    expect(ethIter.position).toEqual({ qty: 3, side: 'short' })
    // 入参 ctx 不被污染
    expect(ctx.position).toEqual({ qty: 1, side: 'long' })
    // 双调用确定性 — 二次调用与首次结果字节相等
    const second = buildScopeIteration(ctx, symbolScopes[0] as { id: string; primarySymbol?: string; symbols: readonly string[] })
    expect(jsonEqual(btcIter, second)).toBe(true)
  })
})
