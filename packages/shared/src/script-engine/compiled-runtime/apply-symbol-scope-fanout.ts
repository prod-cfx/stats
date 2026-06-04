import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledOrchestrationScope, CompiledSymbolScope } from './run-decision-programs'
import { runDecisionPrograms } from './run-decision-programs'

/**
 * Phase 5 S2 follow-up (#1108): scope.symbol fan-out caller wrapper
 *
 * 核心契约：
 *   单/0 symbol scope → 透传单次 runDecisionPrograms（旧策略零侵入，结果与未引入 fan-out 之前完全一致）
 *   ≥2 symbol scope    → 每个 symbol scope 调用一次 runDecisionPrograms，每次注入 per-scope ctx 克隆：
 *     - activeSymbolScopeId = scope.id           （runtime 路由所需，substrate 已就绪）
 *     - symbol              = scope.primarySymbol ?? scope.symbols[0]
 *     - position            = ctx.positionsBySymbolScope?.[scope.id] ?? ctx.position
 *
 * 不变量（critic 边界声明）：
 *   - 不变更入参 ctx（caller 可重复使用同一 ctx 跨多个调用而不被污染）
 *   - portfolioRiskState / orchestrationGateState 由 caller 一次评估，跨 scope 共享传入
 *   - 不动 lifecycle state map / runOrderPrograms（与 #1081 lifecycle 隔离）
 *   - 浅 spread 即可 — 嵌套对象（bars / data / params / indicators）runtime 读不写
 */

/** 仅由 fan-out 用的轻量 scope 视图，覆盖 IR / Compiled 两侧最小字段 */
export interface SymbolScopeIterationInput {
  readonly id: string
  readonly primarySymbol?: string
  readonly symbols: readonly string[]
}

/**
 * 单 scope 的 ctx 克隆 — 浅 spread + 三处覆盖，不复制 / 冻结嵌套对象。
 * 调用者：runDecisionProgramsFanOut + 上游 caller（如希望对 runOrderPrograms 也 fan-out）。
 */
export function buildScopeIteration<T extends StrategyExecutionContextV1>(
  ctx: T,
  scope: SymbolScopeIterationInput,
): T {
  const symbol = scope.primarySymbol ?? scope.symbols[0]
  const positionsByScope = (ctx as { positionsBySymbolScope?: Record<string, T['position']> })
    .positionsBySymbolScope
  const perScopePosition = positionsByScope?.[scope.id]
  const next = { ...ctx, activeSymbolScopeId: scope.id } as T & { symbol?: string; position?: T['position'] }
  if (typeof symbol === 'string' && symbol.length > 0) {
    next.symbol = symbol
  }
  if (perScopePosition !== undefined) {
    next.position = perScopePosition
  }
  return next
}

export interface ScopeFanOutDecisionEntry {
  readonly scopeId: string
  readonly decision: StrategyDecisionV1
}

/**
 * fan-out 主入口：根据 symbol scope 数量决定单次或循环调用 runDecisionPrograms。
 *
 * 多 scope 聚合规则：
 *   - 主返回 decision = 首个 action !== 'NOOP' 的 per-scope decision；全 NOOP → 取首个
 *   - decision.meta.scopeDecisions = 全部 per-scope decision 副本（telemetry / parity 用途）
 *   - decision.meta.activeSymbolScopeId = 主 decision 来源 scope id
 *
 * 单/0 scope 完全透传，meta 无新增字段（旧 snapshot 字节兼容）。
 */
export function runDecisionProgramsFanOut(
  ctx: Parameters<typeof runDecisionPrograms>[0],
  programs: Parameters<typeof runDecisionPrograms>[1],
  exprValues: Parameters<typeof runDecisionPrograms>[2],
  guardState: Parameters<typeof runDecisionPrograms>[3],
  decisionOrder: Parameters<typeof runDecisionPrograms>[4],
  orchestrationGateState: Parameters<typeof runDecisionPrograms>[5],
  portfolioRiskState: Parameters<typeof runDecisionPrograms>[6],
  orchestrationScopes: Parameters<typeof runDecisionPrograms>[7],
  orchestrationLegScopes: Parameters<typeof runDecisionPrograms>[8],
): Readonly<StrategyDecisionV1> {
  const symbolScopes = ((orchestrationScopes ?? []) as readonly CompiledOrchestrationScope[]).filter(
    (s): s is CompiledSymbolScope => s.scopeKind === 'symbol',
  )
  const uniqueSymbolScopes = dedupeSymbolScopes(symbolScopes)
  const hasScopedProgram = programs.some(program => typeof program.metadata?.symbolScopeRef === 'string' && program.metadata.symbolScopeRef.trim().length > 0)
  if (uniqueSymbolScopes.length < 2 || !hasScopedProgram) {
    return runDecisionPrograms(
      ctx, programs, exprValues, guardState,
      decisionOrder, orchestrationGateState, portfolioRiskState,
      orchestrationScopes, orchestrationLegScopes,
    )
  }
  const scopeDecisions: ScopeFanOutDecisionEntry[] = []
  for (const scope of uniqueSymbolScopes) {
    const ctxIter = buildScopeIteration(ctx, scope)
    const decision = runDecisionPrograms(
      ctxIter, programs, exprValues, guardState,
      decisionOrder, orchestrationGateState, portfolioRiskState,
      orchestrationScopes, orchestrationLegScopes,
    )
    scopeDecisions.push({ scopeId: scope.id, decision })
  }
  const primary = scopeDecisions.find(e => e.decision.action !== 'NOOP') ?? scopeDecisions[0]
  return Object.freeze({
    ...primary.decision,
    meta: {
      ...(primary.decision.meta ?? {}),
      activeSymbolScopeId: primary.scopeId,
      scopeDecisions: scopeDecisions.map(e => ({ scopeId: e.scopeId, decision: e.decision })),
    },
  })
}

function dedupeSymbolScopes(scopes: readonly CompiledSymbolScope[]): CompiledSymbolScope[] {
  const output: CompiledSymbolScope[] = []
  const seen = new Set<string>()
  for (const scope of scopes) {
    if (seen.has(scope.id)) continue
    seen.add(scope.id)
    output.push(scope)
  }
  return output
}
