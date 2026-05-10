import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from './evaluate-orchestration-portfolio-risks'
import type { CompiledGuardState } from './evaluate-guards'
import type { CompiledOrchestrationScope, CompiledSubStrategyScope } from './run-decision-programs'
import {
  buildSubStrategyScopeIteration,
  resolveSubStrategySwitch,
  runDecisionProgramsSubStrategyFanOut,
  synthesizeSubStrategyDeactivationDecision,
} from './apply-substrategy-scope-fanout'

/**
 * Phase 5 S10 follow-up (#1113): subStrategy fan-out + switch state machine 单元 spec
 *
 * 覆盖（≥5 case 要求）：
 *   1) buildSubStrategyScopeIteration 浅 spread 不污染入参 ctx
 *   2) buildSubStrategyScopeIteration 消费 positionsBySubStrategyScope per-sub 覆盖
 *   3) resolveSubStrategySwitch — 0/1/≥2 sub 三路决策表
 *   4) resolveSubStrategySwitch — switchTo === baseline / 不在集合 → 不切换
 *   5) resolveSubStrategySwitch — cooldown 命中 → cooldownBlocked=true 不切换
 *   6) synthesizeSubStrategyDeactivationDecision — close 持有仓位 → CLOSE_*
 *   7) synthesizeSubStrategyDeactivationDecision — keep handling / 无仓位 → null
 *   8) runDecisionProgramsSubStrategyFanOut 单 sub 透传（无 sub fan-out 副作用）
 *   9) runDecisionProgramsSubStrategyFanOut 双 sub 切换 + 持仓 → CLOSE 主 decision + meta.subStrategyDeactivation
 *   10) runDecisionProgramsSubStrategyFanOut 双 sub 切换 + 无仓位 → 透传 baseDecision + meta.subStrategyDeactivation
 *   11) cooldown 命中 → 透传无切换（switchOutcome.cooldownBlocked=true，baseDecision 来自 baseline sub）
 */

const noopGuard: CompiledGuardState = {
  blockNewEntry: false,
  forceExit: false,
  strategyHalt: false,
  cancelOrderPrograms: false,
  triggered: [],
}
const noopGate: OrchestrationGateState = { blockEntryLong: false, blockEntryShort: false }
const noopPortfolio: OrchestrationPortfolioRiskState = {
  blockEntryLong: false,
  blockEntryShort: false,
  observedBreaches: [],
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

const subScopes: readonly CompiledSubStrategyScope[] = [
  makeSubScope('ss-trend'),
  makeSubScope('ss-range'),
]

function entryProgram(id: string, scopeRef: string) {
  return {
    id,
    phase: 'entry' as const,
    priority: 1,
    when: 'expr_true',
    metadata: { subStrategyScopeRef: scopeRef } as { subStrategyScopeRef?: string },
    actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
  }
}

describe('buildSubStrategyScopeIteration (Phase 5 S10 follow-up #1113)', () => {
  it('case 1: 浅 spread 不污染入参 ctx', () => {
    const ctx: StrategyExecutionContextV1 = {
      symbol: 'BTCUSDT',
      position: { qty: 5, side: 'long' },
      indicators: { rsi: 50 },
    }
    const next = buildSubStrategyScopeIteration(ctx, { id: 'ss-trend' })
    expect(next).not.toBe(ctx)
    expect(ctx.activeSubStrategyScopeId).toBeUndefined()
    expect(ctx.position).toEqual({ qty: 5, side: 'long' })
    expect(next.activeSubStrategyScopeId).toBe('ss-trend')
    expect(next.position).toEqual({ qty: 5, side: 'long' })
    // 嵌套对象引用共享（spread shallow，runtime 只读）
    expect(next.indicators).toBe(ctx.indicators)
  })

  it('case 2: positionsBySubStrategyScope per-sub 覆盖 ctx.position', () => {
    const ctxPos = { qty: 1, side: 'long' as const }
    const trendPos = { qty: 7, side: 'long' as const }
    const ctx: StrategyExecutionContextV1 = {
      position: ctxPos,
      positionsBySubStrategyScope: { 'ss-trend': trendPos },
    }
    const trendIter = buildSubStrategyScopeIteration(ctx, { id: 'ss-trend' })
    const rangeIter = buildSubStrategyScopeIteration(ctx, { id: 'ss-range' })
    expect(trendIter.position).toEqual(trendPos)
    expect(rangeIter.position).toEqual(ctxPos)
    expect(ctx.position).toBe(ctxPos)
  })
})

describe('resolveSubStrategySwitch (Phase 5 S10 follow-up #1113)', () => {
  it('case 3a: 0 sub → nextActiveScopeId=\'\' didSwitch=false', () => {
    const out = resolveSubStrategySwitch([], { currentBarIndex: 0 })
    expect(out.nextActiveScopeId).toBe('')
    expect(out.didSwitch).toBe(false)
  })

  it('case 3b: 1 sub 首次绑定 → 不算切换', () => {
    const out = resolveSubStrategySwitch([subScopes[0]], { currentBarIndex: 0 })
    expect(out.nextActiveScopeId).toBe('ss-trend')
    expect(out.didSwitch).toBe(false)
  })

  it('case 3c: ≥2 sub + prev 缺省 → 兜底 sub[0]', () => {
    const out = resolveSubStrategySwitch(subScopes, { currentBarIndex: 0 })
    expect(out.nextActiveScopeId).toBe('ss-trend')
    expect(out.didSwitch).toBe(false)
  })

  it('case 3d (Round 1 fix): ≥2 sub + prev 缺省 + switchTo 有效 → 仍不切换（first-bar/snapshot 路径）', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      switchToScopeId: 'ss-range',
      currentBarIndex: 0,
    })
    expect(out.didSwitch).toBe(false)
    expect(out.nextActiveScopeId).toBe('ss-trend') // baseline = subScopes[0]
  })

  it('case 3e (Round 1 fix): ≥2 sub + prev 不在集合（脏数据）→ 视为 first-bar，永不切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-stale',
      switchToScopeId: 'ss-range',
      currentBarIndex: 1,
    })
    expect(out.didSwitch).toBe(false)
    expect(out.nextActiveScopeId).toBe('ss-trend')
  })

  it('case 4a: switchTo === baseline → 不切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-trend',
      currentBarIndex: 5,
    })
    expect(out.didSwitch).toBe(false)
    expect(out.nextActiveScopeId).toBe('ss-trend')
  })

  it('case 4b: switchTo 不在 sub 集合 → 不切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-unknown',
      currentBarIndex: 5,
    })
    expect(out.didSwitch).toBe(false)
    expect(out.nextActiveScopeId).toBe('ss-trend')
  })

  it('case 5a: cooldown 命中 → cooldownBlocked=true 不切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 5,
      lastSwitchBarIndex: 5,
      cooldownBars: 1,
    })
    expect(out.didSwitch).toBe(false)
    expect(out.cooldownBlocked).toBe(true)
    expect(out.nextActiveScopeId).toBe('ss-trend')
  })

  it('case 5b: cooldown 已过 → 切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 6,
      lastSwitchBarIndex: 5,
      cooldownBars: 1,
    })
    expect(out.didSwitch).toBe(true)
    expect(out.cooldownBlocked).toBe(false)
    expect(out.nextActiveScopeId).toBe('ss-range')
    expect(out.outgoingScope?.id).toBe('ss-trend')
    expect(out.incomingScope?.id).toBe('ss-range')
  })

  it('case 5c (Round 1 fix): cooldownBars=0 → 显式禁用冷却 → 立即切换', () => {
    const out = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 5,
      lastSwitchBarIndex: 5,
      cooldownBars: 0,
    })
    expect(out.didSwitch).toBe(true)
    expect(out.cooldownBlocked).toBe(false)
  })

  it('case 5d (Round 1 fix): cooldownBars=NaN/负数 → 默认 1（不防抖）', () => {
    const outNaN = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 6,
      lastSwitchBarIndex: 5,
      cooldownBars: Number.NaN,
    })
    expect(outNaN.didSwitch).toBe(true) // default 1, 6-5=1, 1<1=false → not blocked
    const outNeg = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 6,
      lastSwitchBarIndex: 5,
      cooldownBars: -3,
    })
    expect(outNeg.didSwitch).toBe(true)
  })

  it('case 5e (Round 1 fix): cooldownBars=2 严格防抖 — 切换 T 后 T+1 阻挡，T+2 允许', () => {
    const blocked = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 6,
      lastSwitchBarIndex: 5,
      cooldownBars: 2,
    })
    expect(blocked.didSwitch).toBe(false)
    expect(blocked.cooldownBlocked).toBe(true)
    const allowed = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 7,
      lastSwitchBarIndex: 5,
      cooldownBars: 2,
    })
    expect(allowed.didSwitch).toBe(true)
  })
})

describe('synthesizeSubStrategyDeactivationDecision (Phase 5 S10 follow-up #1113)', () => {
  it('case 6: 切换 + close handling + 多头持仓 → CLOSE_LONG', () => {
    const outcome = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 1,
    })
    const decision = synthesizeSubStrategyDeactivationDecision(outcome, 5)
    expect(decision?.action).toBe('CLOSE_LONG')
    expect(decision?.size).toEqual({ mode: 'QTY', value: 5 })
    expect(decision?.reason).toBe('compiled.orchestration.substrategy.deactivation.close')
    const meta = decision?.meta?.subStrategyDeactivation as { outgoingScopeId: string; cancelOrders: boolean }
    expect(meta.outgoingScopeId).toBe('ss-trend')
    expect(meta.cancelOrders).toBe(true)
  })

  it('case 6b: 切换 + close handling + 空头持仓 → CLOSE_SHORT', () => {
    const outcome = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 1,
    })
    const decision = synthesizeSubStrategyDeactivationDecision(outcome, -3)
    expect(decision?.action).toBe('CLOSE_SHORT')
    expect(decision?.size).toEqual({ mode: 'QTY', value: 3 })
  })

  it('case 7a: 切换 + keep handling → null（caller 透传 baseDecision）', () => {
    const keepScopes: CompiledSubStrategyScope[] = [
      makeSubScope('ss-trend', { positionHandlingOnDeactivate: 'keep', orderHandlingOnDeactivate: 'keep' }),
      makeSubScope('ss-range'),
    ]
    const outcome = resolveSubStrategySwitch(keepScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 1,
    })
    expect(synthesizeSubStrategyDeactivationDecision(outcome, 5)).toBeNull()
  })

  it('case 7b: 切换 + close handling + 无仓位 → null', () => {
    const outcome = resolveSubStrategySwitch(subScopes, {
      previousActiveScopeId: 'ss-trend',
      switchToScopeId: 'ss-range',
      currentBarIndex: 1,
    })
    expect(synthesizeSubStrategyDeactivationDecision(outcome, 0)).toBeNull()
  })
})

describe('runDecisionProgramsSubStrategyFanOut (Phase 5 S10 follow-up #1113)', () => {
  const exprValues = { expr_true: true } as const

  it('case 8: 单 sub 透传 — 无切换 + 无 deactivation meta + decision 走 substrate continue', () => {
    const programs = [entryProgram('p1', 'ss-trend')]
    const ctx: StrategyExecutionContextV1 = { symbol: 'BTCUSDT' }
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, noopGuard, ['p1'],
      noopGate, noopPortfolio, [subScopes[0] as CompiledOrchestrationScope], undefined,
      { subStrategyState: { currentBarIndex: 0 } },
    )
    expect(result.switchOutcome.didSwitch).toBe(false)
    expect(result.switchOutcome.nextActiveScopeId).toBe('ss-trend')
    expect(result.decision.meta?.subStrategyDeactivation).toBeUndefined()
    // 单 sub 走 substrate continue → program 命中 → OPEN_LONG
    expect(result.decision.action).toBe('OPEN_LONG')
  })

  it('case 9: 双 sub 切换 + 持有多头 → CLOSE_LONG 主 decision + meta.subStrategyDeactivation', () => {
    // gateState.switchToSubStrategyScopeId 触发切换 trend → range
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 4, side: 'long' },
    }
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, noopGuard, ['p1', 'p2'],
      gateSwitch, noopPortfolio,
      [subScopes[0] as CompiledOrchestrationScope, subScopes[1] as CompiledOrchestrationScope],
      undefined,
      { subStrategyState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 } },
    )
    expect(result.switchOutcome.didSwitch).toBe(true)
    expect(result.switchOutcome.nextActiveScopeId).toBe('ss-range')
    expect(result.decision.action).toBe('CLOSE_LONG')
    expect(result.decision.size).toEqual({ mode: 'QTY', value: 4 })
    const meta = result.decision.meta?.subStrategyDeactivation as { outgoingScopeId: string; cancelOrders: boolean }
    expect(meta.outgoingScopeId).toBe('ss-trend')
    expect(meta.cancelOrders).toBe(true)
    expect(result.switchBarIndex).toBe(10)
  })

  it('case 10: 双 sub 切换 + 无持仓 + keep handling → 透传 baseDecision + meta.subStrategyDeactivation 标记', () => {
    const keepScopes: CompiledOrchestrationScope[] = [
      makeSubScope('ss-trend', { positionHandlingOnDeactivate: 'keep', orderHandlingOnDeactivate: 'cancel' }),
      makeSubScope('ss-range'),
    ]
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {}
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, noopGuard, ['p1', 'p2'],
      gateSwitch, noopPortfolio, keepScopes, undefined,
      { subStrategyState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 } },
    )
    expect(result.switchOutcome.didSwitch).toBe(true)
    // 透传 baseDecision（来自 ss-range 维度的 OPEN_LONG）
    expect(result.decision.action).toBe('OPEN_LONG')
    const meta = result.decision.meta?.subStrategyDeactivation as { outgoingScopeId: string; positionHandling: string; cancelOrders: boolean }
    expect(meta.outgoingScopeId).toBe('ss-trend')
    expect(meta.positionHandling).toBe('keep')
    expect(meta.cancelOrders).toBe(true)
  })

  it('case 11: cooldown 命中 → 透传无切换 + baseDecision 来自 baseline sub', () => {
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 4, side: 'long' },
    }
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, noopGuard, ['p1', 'p2'],
      gateSwitch, noopPortfolio,
      [subScopes[0] as CompiledOrchestrationScope, subScopes[1] as CompiledOrchestrationScope],
      undefined,
      {
        subStrategyState: {
          previousActiveScopeId: 'ss-trend',
          currentBarIndex: 5,
          lastSwitchBarIndex: 5,
          cooldownBars: 1,
        },
      },
    )
    expect(result.switchOutcome.didSwitch).toBe(false)
    expect(result.switchOutcome.cooldownBlocked).toBe(true)
    expect(result.switchOutcome.nextActiveScopeId).toBe('ss-trend')
    // 没切换 → 没有 deactivation meta
    expect(result.decision.meta?.subStrategyDeactivation).toBeUndefined()
    // ss-trend 路由的 program p1 命中 → OPEN_LONG（substrate continue）
    expect(result.decision.action).toBe('OPEN_LONG')
  })

  it('case 11b (Round 1 fix): 切换 + close handling + 持仓 + guardState.forceExit → 不覆盖 baseDecision，仅挂 meta', () => {
    // forceExit 在 runDecisionPrograms 内提前返回 CLOSE_LONG（与 reason='compiled.force_exit'）
    // 切换合成不能覆盖此 decision，否则 telemetry 丢 forceExit 信号
    const guardForceExit: CompiledGuardState = { ...noopGuard, forceExit: true }
    const gateSwitch: OrchestrationGateState = {
      ...noopGate,
      switchToSubStrategyScopeId: 'ss-range',
    }
    const programs = [entryProgram('p1', 'ss-trend'), entryProgram('p2', 'ss-range')]
    const ctx: StrategyExecutionContextV1 = {
      position: { qty: 4, side: 'long' },
    }
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, guardForceExit, ['p1', 'p2'],
      gateSwitch, noopPortfolio,
      [subScopes[0] as CompiledOrchestrationScope, subScopes[1] as CompiledOrchestrationScope],
      undefined,
      { subStrategyState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 } },
    )
    expect(result.switchOutcome.didSwitch).toBe(true)
    // forceExit 优先 — reason 保持 upstream，meta 仅追加 deactivation
    expect(result.decision.action).toBe('CLOSE_LONG')
    expect(result.decision.reason).toBe('compiled.force_exit')
    const meta = result.decision.meta?.subStrategyDeactivation as { outgoingScopeId: string }
    expect(meta.outgoingScopeId).toBe('ss-trend')
  })

  it('case 12: 0 sub + 双 symbol 共存 → 透传 symbol fan-out（meta.scopeDecisions 双副本）', () => {
    const symbolScopes: CompiledOrchestrationScope[] = [
      { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
      { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ]
    const programs = [
      { ...entryProgram('p1', ''), metadata: { symbolScopeRef: 's-btc' } as { symbolScopeRef?: string } },
      { ...entryProgram('p2', ''), metadata: { symbolScopeRef: 's-eth' } as { symbolScopeRef?: string } },
    ]
    const ctx: StrategyExecutionContextV1 = {}
    const result = runDecisionProgramsSubStrategyFanOut(
      ctx, programs, exprValues, noopGuard, ['p1', 'p2'],
      noopGate, noopPortfolio, symbolScopes, undefined,
      { subStrategyState: { currentBarIndex: 0 } },
    )
    expect(result.switchOutcome.nextActiveScopeId).toBe('')
    const entries = result.decision.meta?.scopeDecisions as Array<{ scopeId: string; decision: StrategyDecisionV1 }>
    expect(entries.length).toBe(2)
    expect(entries.map(e => e.scopeId)).toEqual(['s-btc', 's-eth'])
  })
})
