import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledGuardState } from './evaluate-guards'
import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from './evaluate-orchestration-portfolio-risks'
import type { CompiledOrchestrationScope } from './run-decision-programs'
import { buildScopeIteration, runDecisionProgramsFanOut } from './apply-symbol-scope-fanout'

/**
 * Phase 5 S2 follow-up (#1108): buildScopeIteration + runDecisionProgramsFanOut 单元 spec
 *
 * 覆盖：
 *   1) ctx.position 隔离 — 入参 ctx.position 不被改写
 *   2) ctx.symbol 由 primarySymbol / symbols[0] 派生
 *   3) positionsBySymbolScope per-scope 注入覆盖原 ctx.position
 *   4) 单/0 scope 透传（无 fan-out 副作用）
 *   5) 双 scope 默认产 2 条 per-scope decision
 *   6) cooldown / scope-A NOOP scope-B OPEN_LONG → primary = OPEN_LONG（首个非 NOOP 优先）
 *   7) forceExit 双 scope 双 close（M4 forceExit 优先 scope check 路径）
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

function entryProgram(id: string, scopeRef: string) {
  return {
    id,
    phase: 'entry' as const,
    priority: 1,
    when: 'expr_true',
    metadata: { symbolScopeRef: scopeRef } as { symbolScopeRef?: string },
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
  }
}

describe('buildScopeIteration (Phase 5 S2 #1108)', () => {
  it('case 1: 浅 spread 不污染入参 ctx', () => {
    const ctx: StrategyExecutionContextV1 = {
      symbol: 'ORIG',
      position: { qty: 5, side: 'long' },
      indicators: { rsi: 50 },
    }
    const next = buildScopeIteration(ctx, { id: 's-btc', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' })
    expect(next).not.toBe(ctx)
    expect(ctx.activeSymbolScopeId).toBeUndefined()
    expect(ctx.symbol).toBe('ORIG')
    expect(ctx.position).toEqual({ qty: 5, side: 'long' })
    expect(next.activeSymbolScopeId).toBe('s-btc')
    expect(next.symbol).toBe('BTCUSDT')
    // 嵌套对象引用共享（runtime 只读，spread 已足够）
    expect(next.indicators).toBe(ctx.indicators)
  })

  it('case 2: symbol 优先 primarySymbol，缺省回退 symbols[0]', () => {
    const ctx: StrategyExecutionContextV1 = {}
    const a = buildScopeIteration(ctx, { id: 's-a', symbols: ['SOLUSDT', 'ETHUSDT'] })
    const b = buildScopeIteration(ctx, { id: 's-b', symbols: ['SOLUSDT', 'ETHUSDT'], primarySymbol: 'ETHUSDT' })
    expect(a.symbol).toBe('SOLUSDT')
    expect(b.symbol).toBe('ETHUSDT')
  })

  it('case 3: positionsBySymbolScope per-scope 覆盖 ctx.position', () => {
    const ctxPos = { qty: 1, side: 'long' as const }
    const btcPos = { qty: 7, side: 'long' as const }
    const ctx: StrategyExecutionContextV1 = {
      position: ctxPos,
      positionsBySymbolScope: { 's-btc': btcPos },
    }
    const btcIter = buildScopeIteration(ctx, { id: 's-btc', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' })
    const ethIter = buildScopeIteration(ctx, { id: 's-eth', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' })
    expect(btcIter.position).toEqual(btcPos)
    // s-eth 没有 per-scope 仓位 → 沿用 ctx.position（substrate 边界，由 caller 决定是否注入）
    expect(ethIter.position).toEqual(ctxPos)
    // 入参 ctx 完全未被改写
    expect(ctx.position).toBe(ctxPos)
  })
})

describe('runDecisionProgramsFanOut (Phase 5 S2 #1108)', () => {
  const exprValues = { expr_true: true } as const

  it('case 4: 单 scope（length=1）→ 透传，无 scopeDecisions meta', () => {
    const programs = [entryProgram('p1', 's-btc')]
    const ctx: StrategyExecutionContextV1 = { symbol: 'BTCUSDT' }
    const decision = runDecisionProgramsFanOut(
      ctx, programs, exprValues, noopGuard, ['p1'], noopGate, noopPortfolio,
      [symbolScopes[0]], undefined,
    )
    // length=1 走 applySymbolScopeRouting 'continue' 兜底；program ref 不会触发 fail-closed
    expect(decision.action).toBe('OPEN_LONG')
    expect(decision.meta?.scopeDecisions).toBeUndefined()
    expect(decision.meta?.activeSymbolScopeId).toBeUndefined()
  })

  it('case 5: 双 scope 默认产生 2 条 per-scope decision（双 OPEN_LONG，program 各属一 scope）', () => {
    const programs = [entryProgram('p1', 's-btc'), entryProgram('p2', 's-eth')]
    const ctx: StrategyExecutionContextV1 = {}
    const decision = runDecisionProgramsFanOut(
      ctx, programs, exprValues, noopGuard, ['p1', 'p2'], noopGate, noopPortfolio,
      symbolScopes, undefined,
    )
    expect(decision.meta?.scopeDecisions).toBeDefined()
    const entries = decision.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries.length).toBe(2)
    expect(entries.map(e => e.scopeId)).toEqual(['s-btc', 's-eth'])
    // 每个 scope 各执行属于它的 program → OPEN_LONG / OPEN_LONG
    expect(entries[0].decision.action).toBe('OPEN_LONG')
    expect(entries[1].decision.action).toBe('OPEN_LONG')
    // 主 decision = 首个非 NOOP（s-btc）
    expect(decision.action).toBe('OPEN_LONG')
    expect(decision.meta?.activeSymbolScopeId).toBe('s-btc')
  })

  it('case 6: scope-A NOOP / scope-B OPEN_LONG → primary 取首个非 NOOP（s-eth）', () => {
    // p1 仅绑 s-btc 但 expr 为 false → s-btc 当 active 时走 compiled.noop（program p2 ref 不匹配 skip）
    // p2 绑 s-eth + expr true → s-eth 当 active 时 OPEN_LONG
    const programs = [
      { ...entryProgram('p1', 's-btc'), when: 'expr_false' },
      entryProgram('p2', 's-eth'),
    ]
    const ctx: StrategyExecutionContextV1 = {}
    const decision = runDecisionProgramsFanOut(
      ctx, programs, { expr_true: true, expr_false: false }, noopGuard,
      ['p1', 'p2'], noopGate, noopPortfolio,
      symbolScopes, undefined,
    )
    const entries = decision.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries[0].decision.action).toBe('NOOP') // s-btc
    expect(entries[1].decision.action).toBe('OPEN_LONG') // s-eth
    // 主 decision 优先非 NOOP
    expect(decision.action).toBe('OPEN_LONG')
    expect(decision.meta?.activeSymbolScopeId).toBe('s-eth')
  })

  it('case 7: forceExit 双 scope 双 close — forceExit 优先 scope routing（M4），两 scope 均产 close', () => {
    const guardForceExit: CompiledGuardState = { ...noopGuard, forceExit: true }
    const programs = [entryProgram('p1', 's-btc'), entryProgram('p2', 's-eth')]
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 2, side: 'long' },
    }
    const decision = runDecisionProgramsFanOut(
      ctx, programs, exprValues, guardForceExit, ['p1', 'p2'], noopGate, noopPortfolio,
      symbolScopes, undefined,
    )
    const entries = decision.meta!.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    // forceExit 路径走 evaluateForceExit（先于 scope routing）→ 双 scope 都 CLOSE_LONG
    expect(entries[0].decision.action).toBe('CLOSE_LONG')
    expect(entries[1].decision.action).toBe('CLOSE_LONG')
    expect(decision.action).toBe('CLOSE_LONG')
    expect(decision.meta?.activeSymbolScopeId).toBe('s-btc')
  })
})
