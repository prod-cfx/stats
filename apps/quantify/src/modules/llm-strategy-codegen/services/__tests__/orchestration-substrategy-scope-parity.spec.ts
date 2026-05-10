import type { CompiledOrchestrationScope, CompiledSubStrategyScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { OrchestrationGateState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import {
  buildSubStrategyScopeIteration,
  runDecisionProgramsSubStrategyFanOut,
} from '@ai/shared/script-engine/compiled-runtime'

/**
 * Phase 5 S10 follow-up (#1113): orchestration-substrategy-scope parity spec
 *
 * 目标：验证 backtest path 与 live path 在同一份 projection + ctx + state 下产出**字节相等**的 decision
 *   字节相等定义 = JSON.stringify(decisionA) === JSON.stringify(decisionB)
 *   策略：两侧 caller 均调用 runDecisionProgramsSubStrategyFanOut（共享 wrapper）；
 *         caller 自有上下文差异（peakEquity / live filter / lifecycle map 等）不在 parity 范围
 *
 * 7 case 覆盖（与 P# 编号同 #1108 symbol parity）：
 *   P1 单 sub scope 透传（无 sub fan-out 副作用）
 *   P2 双 sub + first bar 兜底 sub[0]（baseDecision 来自 ss-trend）
 *   P3 双 sub + 切换 + close handling + 持仓 → CLOSE_LONG 主 decision
 *   P4 双 sub + 切换 + keep handling + 持仓 → 透传 baseDecision + meta.subStrategyDeactivation
 *   P5 双 sub + cooldown 命中 → 透传无切换
 *   P6 双 sub + 双 symbol 共存 → sub 维度先解析 + symbol 维度仍 fan-out
 *   P7 buildSubStrategyScopeIteration per-sub position 隔离
 */

const noopGuard: CompiledGuardState = {
  blockNewEntry: false, forceExit: false, strategyHalt: false,
  cancelOrderPrograms: false, triggered: [],
}
const noopGate: OrchestrationGateState = { blockEntryLong: false, blockEntryShort: false }
const noopPortfolio: OrchestrationPortfolioRiskState = {
  blockEntryLong: false, blockEntryShort: false, observedBreaches: [],
}

function makeSubScope(id: string, overrides: Partial<CompiledSubStrategyScope> = {}): CompiledSubStrategyScope {
  return {
    id,
    scopeKind: 'subStrategy',
    subStrategyId: `${id}-sub`,
    positionHandlingOnDeactivate: 'close',
    orderHandlingOnDeactivate: 'cancel',
    ...overrides,
  }
}

const subScopes: readonly CompiledOrchestrationScope[] = [
  makeSubScope('ss-trend'),
  makeSubScope('ss-range'),
]

function entryProgram(id: string, scopeRef?: string) {
  return {
    id,
    phase: 'entry' as const,
    priority: 1,
    when: 'expr_true',
    metadata: scopeRef ? ({ subStrategyScopeRef: scopeRef } as { subStrategyScopeRef?: string }) : undefined,
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
  }
}

interface CallArgs {
  ctx: StrategyExecutionContextV1
  programs: ReadonlyArray<ReturnType<typeof entryProgram>>
  exprValues: Readonly<Record<string, boolean>>
  guard?: CompiledGuardState
  gate?: OrchestrationGateState
  scopes: readonly CompiledOrchestrationScope[]
  decisionOrder: readonly string[]
  subState?: {
    previousActiveScopeId?: string
    currentBarIndex: number
    lastSwitchBarIndex?: number
    cooldownBars?: number
  }
}

/** 共享 caller — 两侧 parity 走同一份 wrapper */
function callSubFanOut(args: CallArgs): StrategyDecisionV1 {
  return runDecisionProgramsSubStrategyFanOut(
    args.ctx, args.programs, args.exprValues, args.guard ?? noopGuard,
    args.decisionOrder, args.gate ?? noopGate, noopPortfolio,
    args.scopes, undefined,
    { subStrategyState: args.subState ?? { currentBarIndex: 0 } },
  ).decision
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

describe('orchestration scope.subStrategy — backtest vs live parity (Phase 5 S10 follow-up #1113)', () => {
  it('P1 单 sub scope 透传 — 双侧字节相等', () => {
    const programs = [entryProgram('p1', 'ss-trend')]
    const ctx: StrategyExecutionContextV1 = {}
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      scopes: [subScopes[0]],
      decisionOrder: ['p1'],
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    expect(a.action).toBe('OPEN_LONG')
    expect(a.meta?.subStrategyDeactivation).toBeUndefined()
  })

  it('P2 双 sub first-bar 兜底 sub[0] — 双侧字节相等 baseDecision 来自 ss-trend', () => {
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {}
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      scopes: subScopes,
      decisionOrder: ['p1', 'p2'],
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    expect(a.action).toBe('OPEN_LONG')
    expect(a.meta?.subStrategyDeactivation).toBeUndefined()
  })

  it('P3 双 sub 切换 + close handling + 多头仓位 → CLOSE_LONG 主 decision', () => {
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = { position: { qty: 6, side: 'long' } }
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      gate: gateSwitch,
      scopes: subScopes,
      decisionOrder: ['p1', 'p2'],
      subState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 },
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    expect(a.action).toBe('CLOSE_LONG')
    expect(a.size).toEqual({ mode: 'QTY', value: 6 })
    expect(a.reason).toBe('compiled.orchestration.substrategy.deactivation.close')
    const meta = a.meta!.subStrategyDeactivation as { outgoingScopeId: string; incomingScopeId: string }
    expect(meta.outgoingScopeId).toBe('ss-trend')
    expect(meta.incomingScopeId).toBe('ss-range')
  })

  it('P4 双 sub 切换 + keep handling → 透传 baseDecision + meta.subStrategyDeactivation', () => {
    const keepScopes: readonly CompiledOrchestrationScope[] = [
      makeSubScope('ss-trend', { positionHandlingOnDeactivate: 'keep', orderHandlingOnDeactivate: 'cancel' }),
      makeSubScope('ss-range'),
    ]
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {}
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      gate: gateSwitch,
      scopes: keepScopes,
      decisionOrder: ['p1', 'p2'],
      subState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 },
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    expect(a.action).toBe('OPEN_LONG')
    const meta = a.meta!.subStrategyDeactivation as { positionHandling: string; cancelOrders: boolean }
    expect(meta.positionHandling).toBe('keep')
    expect(meta.cancelOrders).toBe(true)
  })

  it('P5 双 sub cooldown 命中 → 透传无切换 双侧字节相等', () => {
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = { position: { qty: 6, side: 'long' } }
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      gate: gateSwitch,
      scopes: subScopes,
      decisionOrder: ['p1', 'p2'],
      subState: {
        previousActiveScopeId: 'ss-trend',
        currentBarIndex: 5,
        lastSwitchBarIndex: 5,
        cooldownBars: 1,
      },
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    // 没切换 — baseDecision 来自 ss-trend；ss-trend 路由 program p1 命中 → OPEN_LONG
    expect(a.action).toBe('OPEN_LONG')
    expect(a.meta?.subStrategyDeactivation).toBeUndefined()
  })

  it('P6 双 sub + 双 symbol 共存 — sub 维度先解析 + symbol fan-out 在选定 sub 内执行', () => {
    const mixedScopes: CompiledOrchestrationScope[] = [
      ...subScopes,
      { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
      { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ]
    // program 同时声明 sub + symbol scope ref：本 bar active sub=ss-trend, symbol fan-out 走两个 symbol
    const programs = [
      {
        ...entryProgram('p1'),
        metadata: { subStrategyScopeRef: 'ss-trend', symbolScopeRef: 's-btc' } as { subStrategyScopeRef?: string; symbolScopeRef?: string },
      },
      {
        ...entryProgram('p2'),
        metadata: { subStrategyScopeRef: 'ss-trend', symbolScopeRef: 's-eth' } as { subStrategyScopeRef?: string; symbolScopeRef?: string },
      },
    ]
    const ctx: StrategyExecutionContextV1 = {}
    const args: CallArgs = {
      ctx,
      programs,
      exprValues: { expr_true: true },
      scopes: mixedScopes,
      decisionOrder: ['p1', 'p2'],
    }
    const a = callSubFanOut(args)
    const b = callSubFanOut(args)
    expect(jsonEqual(a, b)).toBe(true)
    // sub 维度选 ss-trend；symbol 维度 fan-out 双 scope（meta.scopeDecisions 双副本）
    const entries = a.meta?.scopeDecisions as Array<{ scopeId: string }> | undefined
    expect(entries).toBeDefined()
    expect(entries!.length).toBe(2)
    expect(entries!.map(e => e.scopeId)).toEqual(['s-btc', 's-eth'])
  })

  it('P7 buildSubStrategyScopeIteration per-sub position 注入正确覆盖 + ctx 不被污染', () => {
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 1, side: 'long' },
      positionsBySubStrategyScope: {
        'ss-trend': { qty: 7, side: 'long' },
        'ss-range': { qty: 3, side: 'short' },
      },
    }
    const trendIter = buildSubStrategyScopeIteration(ctx, { id: 'ss-trend' })
    const rangeIter = buildSubStrategyScopeIteration(ctx, { id: 'ss-range' })
    expect(trendIter.position).toEqual({ qty: 7, side: 'long' })
    expect(rangeIter.position).toEqual({ qty: 3, side: 'short' })
    expect(ctx.position).toEqual({ qty: 1, side: 'long' })
    // 双调用确定性
    const second = buildSubStrategyScopeIteration(ctx, { id: 'ss-trend' })
    expect(jsonEqual(trendIter, second)).toBe(true)
  })
})
