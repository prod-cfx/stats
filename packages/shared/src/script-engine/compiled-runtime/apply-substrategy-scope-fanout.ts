import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import type {
  CompiledOrchestrationScope,
  CompiledSubStrategyScope,
} from './run-decision-programs'
import { runDecisionProgramsFanOut } from './apply-symbol-scope-fanout'
import { runDecisionPrograms } from './run-decision-programs'

/**
 * Phase 5 S10 follow-up (#1113): scope.subStrategy fan-out caller wrapper
 *
 * 与 scope.symbol fan-out（#1108 / apply-symbol-scope-fanout.ts）平行加；不预先抽象通用 helper（YAGNI）。
 *
 * 核心契约：
 *   单/0 subStrategy scope → 透传 runDecisionProgramsFanOut（旧策略字节兼容，零侵入）
 *   ≥2 subStrategy scope    → 单 active sub iteration（一根 bar 只跑一个 sub —— sub 是状态机，不是同时存在）：
 *     - 跨 bar 持久化的 activeSubStrategyScopeId 由 caller 注入到 invocation.subStrategyState
 *     - evaluator 计算的 gateState.switchToSubStrategyScopeId 触发切换；
 *       cooldown 命中时不切换；切换后按 outgoing scope contract 执行 close/cancel。
 *
 * 不变量（critic 边界声明）：
 *   - 不变更入参 ctx（caller 可重复使用同一 ctx 跨多个调用）
 *   - portfolioRiskState / orchestrationGateState 由 caller 一次评估后传入
 *   - 不动 #1081 program lifecycle state map；本 wrapper 通过 invocation.subStrategyState 接收/输出独立 state
 *   - 单/0 sub 完全透传，meta 无新增字段（旧 snapshot 字节兼容）
 */

/** sub fan-out 用的轻量 scope 视图 — 仅需 id（subStrategyId 由上游 substrate 类型已携带，无需在此重复） */
export interface SubStrategyScopeIterationInput {
  readonly id: string
}

/**
 * 单 sub iteration 的 ctx 克隆 — 浅 spread + activeSubStrategyScopeId 覆盖 + 可选 per-sub position 覆盖。
 * 嵌套对象（bars/data/params/indicators）共享引用，runtime 只读。
 */
export function buildSubStrategyScopeIteration<T extends StrategyExecutionContextV1>(
  ctx: T,
  scope: SubStrategyScopeIterationInput,
): T {
  const positionsBy = (ctx as { positionsBySubStrategyScope?: Record<string, T['position']> })
    .positionsBySubStrategyScope
  const perScopePosition = positionsBy?.[scope.id]
  const next = { ...ctx, activeSubStrategyScopeId: scope.id } as T & { position?: T['position'] }
  if (perScopePosition !== undefined) {
    next.position = perScopePosition
  }
  return next
}

/** caller 注入的跨 bar state（独立于 #1081 program lifecycle state map） */
export interface SubStrategySwitchInput {
  /** 上一根 bar 的 active sub scope id；undefined → first bar 兜底 subScopes[0]，永不触发 switch */
  readonly previousActiveScopeId?: string
  /** 本 bar evaluator 的切换目标（gateState.switchToSubStrategyScopeId） */
  readonly switchToScopeId?: string
  /** 当前 bar 索引（用于 cooldown 判定）；caller 缺省传 0 */
  readonly currentBarIndex: number
  /** 上一次切换发生时的 bar 索引；undefined 表示从未切换过 */
  readonly lastSwitchBarIndex?: number
  /**
   * 切换最小间隔（bars）；
   *   未设/NaN/负数 → 默认 1（switch at T → 下一根 bar T+1 即可再切，等价于"不防抖"）
   *   0           → 不冷却（明确禁用，与默认等价）
   *   ≥2          → 真正防抖，T 切换后须等 ≥(N-1) 个 bar 间隔才能再切
   *   caller（backtest / signal-generator）默认传 2 防抖（避免单 bar 抖动）。
   */
  readonly cooldownBars?: number
}

export interface SubStrategySwitchOutcome {
  readonly previousActiveScopeId?: string
  /** 切换后下一根 bar 该 active 的 scope id（≥2 sub 时必为 sub id；0 sub 时为 ''） */
  readonly nextActiveScopeId: string
  /** 本 bar 是否触发了真实切换（switchTo ≠ baseline 且未被 cooldown 阻挡） */
  readonly didSwitch: boolean
  /** switchTo 候选有效 + 未冷却时为 false；switchTo 候选有效但被冷却时为 true */
  readonly cooldownBlocked: boolean
  readonly outgoingScope?: CompiledSubStrategyScope
  readonly incomingScope?: CompiledSubStrategyScope
}

/**
 * 解析 active sub 切换 — 纯函数，无副作用。
 *
 * 决策表：
 *   0 sub      → nextActive='', didSwitch=false（caller 不应进入 fan-out）
 *   1 sub      → nextActive=唯一 sub.id；prev≠唯一 → didSwitch=true（首次绑定不算 switch — 只在 prev 已设且 ≠ 时才标记）
 *   ≥2 sub:
 *     prev 缺省 / 空 / 不在 sub 集合 → 视为 first bar / snapshot：兜底 subScopes[0]，**永不切换**
 *       （critic Round 1 修复：避免 snapshot 路径在 gate switchTo 已设时无 prev 即误触发 switch）
 *     prev 有效 + switchTo 缺省 / === baseline / 不在 sub 集合 → 不切换
 *     prev 有效 + switchTo 有效:
 *       cooldown 命中（cooldownBars > 0 && currentBarIndex - lastSwitchBarIndex < cooldownBars）→ cooldownBlocked=true，不切换
 *       其它 → 切换到 switchTo（didSwitch=true）
 *
 * cooldownBars 归一化：
 *   未提供 / 非有限数 / 负数 → 默认 1（switch at T → T+1 即可再切，等价"不防抖"）
 *   0                       → 不冷却（明确禁用）
 *   ≥1                       → 严格冷却，T 切换后 T+cooldownBars 才允许再切
 */
export function resolveSubStrategySwitch(
  subScopes: readonly CompiledSubStrategyScope[],
  input: SubStrategySwitchInput,
): SubStrategySwitchOutcome {
  if (subScopes.length === 0) {
    return {
      previousActiveScopeId: input.previousActiveScopeId,
      nextActiveScopeId: '',
      didSwitch: false,
      cooldownBlocked: false,
    }
  }
  if (subScopes.length === 1) {
    const onlyId = subScopes[0].id
    const didSwitch = typeof input.previousActiveScopeId === 'string'
      && input.previousActiveScopeId !== ''
      && input.previousActiveScopeId !== onlyId
    return {
      previousActiveScopeId: input.previousActiveScopeId,
      nextActiveScopeId: onlyId,
      didSwitch,
      cooldownBlocked: false,
    }
  }

  const prevValid = typeof input.previousActiveScopeId === 'string'
    && input.previousActiveScopeId !== ''
    && subScopes.some(s => s.id === input.previousActiveScopeId)
  // First-bar / snapshot 路径：prev 不在集合 → 仅建立 baseline，永不触发 switch
  if (!prevValid) {
    return {
      previousActiveScopeId: input.previousActiveScopeId,
      nextActiveScopeId: subScopes[0].id,
      didSwitch: false,
      cooldownBlocked: false,
    }
  }
  const baselineId = input.previousActiveScopeId as string

  const switchTo = input.switchToScopeId
  const switchToValid = typeof switchTo === 'string'
    && switchTo !== ''
    && switchTo !== baselineId
    && subScopes.some(s => s.id === switchTo)
  if (!switchToValid) {
    return {
      previousActiveScopeId: input.previousActiveScopeId,
      nextActiveScopeId: baselineId,
      didSwitch: false,
      cooldownBlocked: false,
    }
  }

  const cooldownBars = typeof input.cooldownBars === 'number'
    && Number.isFinite(input.cooldownBars)
    && input.cooldownBars >= 0
    ? input.cooldownBars
    : 1
  if (
    cooldownBars > 0
    && typeof input.lastSwitchBarIndex === 'number'
    && Number.isFinite(input.lastSwitchBarIndex)
    && input.currentBarIndex - input.lastSwitchBarIndex < cooldownBars
  ) {
    return {
      previousActiveScopeId: input.previousActiveScopeId,
      nextActiveScopeId: baselineId,
      didSwitch: false,
      cooldownBlocked: true,
    }
  }

  return {
    previousActiveScopeId: input.previousActiveScopeId,
    nextActiveScopeId: switchTo,
    didSwitch: true,
    cooldownBlocked: false,
    outgoingScope: subScopes.find(s => s.id === baselineId),
    incomingScope: subScopes.find(s => s.id === switchTo),
  }
}

/** caller-side hook for runDecisionProgramsSubStrategyFanOut */
export interface SubStrategyFanOutInvocation {
  readonly subStrategyState?: SubStrategySwitchInput
}

export interface SubStrategyDeactivationMeta {
  readonly outgoingScopeId: string
  readonly incomingScopeId?: string
  readonly positionHandling: 'close' | 'keep'
  readonly orderHandling: 'cancel' | 'keep'
  /** caller 应在 afterCommit 阶段读取此字段，触发实际订单取消（live） */
  readonly cancelOrders: boolean
}

export interface SubStrategyFanOutResult {
  readonly decision: Readonly<StrategyDecisionV1>
  readonly switchOutcome: SubStrategySwitchOutcome
  /** caller 持久化用：本 bar 触发切换时的 bar 索引 */
  readonly switchBarIndex?: number
}

/**
 * 合成 outgoing sub 的 deactivation decision：
 *   - positionHandlingOnDeactivate==='close' + currentPositionQty ≠ 0 → 返回 CLOSE_*
 *   - 其它情况返回 null（caller 用 baseDecision）
 *
 * close decision 不绕过 #984 第 6 条安全保证（"能进就能出"）：CLOSE_* 不受 portfolioRisk / gate 影响。
 */
export function synthesizeSubStrategyDeactivationDecision(
  outcome: SubStrategySwitchOutcome,
  currentPositionQty: number,
): StrategyDecisionV1 | null {
  if (!outcome.didSwitch || !outcome.outgoingScope) return null
  if (outcome.outgoingScope.positionHandlingOnDeactivate !== 'close') return null
  if (currentPositionQty === 0) return null
  const action: StrategyDecisionV1['action'] = currentPositionQty > 0 ? 'CLOSE_LONG' : 'CLOSE_SHORT'
  const meta: SubStrategyDeactivationMeta = {
    outgoingScopeId: outcome.outgoingScope.id,
    incomingScopeId: outcome.incomingScope?.id,
    positionHandling: outcome.outgoingScope.positionHandlingOnDeactivate,
    orderHandling: outcome.outgoingScope.orderHandlingOnDeactivate,
    cancelOrders: outcome.outgoingScope.orderHandlingOnDeactivate === 'cancel',
  }
  return {
    action,
    size: { mode: 'QTY', value: Math.abs(currentPositionQty) },
    reason: 'compiled.orchestration.substrategy.deactivation.close',
    meta: { subStrategyDeactivation: meta },
  }
}

/**
 * 主入口：sub fan-out wrapper
 *
 * 行为（≥2 sub）：
 *   1. resolveSubStrategySwitch 决定 nextActive + didSwitch
 *   2. buildSubStrategyScopeIteration 注入 activeSubStrategyScopeId 到 ctx
 *   3. 调 runDecisionProgramsFanOut（symbol 维度 fan-out 与 sub 维度正交，可共存）
 *   4. didSwitch + outgoing.positionHandlingOnDeactivate==='close' + 持仓非 0 →
 *        合成 CLOSE_* 替换 baseDecision（switch 半段优先于本 sub 的 entry 行为）
 *   5. didSwitch + outgoing.orderHandlingOnDeactivate==='cancel' →
 *        在 decision.meta.subStrategyDeactivation 标记 cancelOrders=true（caller 消费）
 *
 * 单/0 sub：透传 runDecisionProgramsFanOut，switchOutcome 标记当前 active（无切换）。
 */
export function runDecisionProgramsSubStrategyFanOut(
  ctx: Parameters<typeof runDecisionPrograms>[0],
  programs: Parameters<typeof runDecisionPrograms>[1],
  exprValues: Parameters<typeof runDecisionPrograms>[2],
  guardState: Parameters<typeof runDecisionPrograms>[3],
  decisionOrder: Parameters<typeof runDecisionPrograms>[4],
  orchestrationGateState: Parameters<typeof runDecisionPrograms>[5],
  portfolioRiskState: Parameters<typeof runDecisionPrograms>[6],
  orchestrationScopes: Parameters<typeof runDecisionPrograms>[7],
  orchestrationLegScopes: Parameters<typeof runDecisionPrograms>[8],
  invocation?: SubStrategyFanOutInvocation,
): SubStrategyFanOutResult {
  const subScopes = ((orchestrationScopes ?? []) as readonly CompiledOrchestrationScope[]).filter(
    (s): s is CompiledSubStrategyScope => s.scopeKind === 'subStrategy',
  )

  // 单/0 sub: 透传给 symbol fan-out；switchOutcome 反映现状（无切换）
  if (subScopes.length < 2) {
    const decision = runDecisionProgramsFanOut(
      ctx, programs, exprValues, guardState,
      decisionOrder, orchestrationGateState, portfolioRiskState,
      orchestrationScopes, orchestrationLegScopes,
    )
    const outcome: SubStrategySwitchOutcome = subScopes.length === 0
      ? {
          previousActiveScopeId: invocation?.subStrategyState?.previousActiveScopeId,
          nextActiveScopeId: '',
          didSwitch: false,
          cooldownBlocked: false,
        }
      : {
          previousActiveScopeId: invocation?.subStrategyState?.previousActiveScopeId,
          nextActiveScopeId: subScopes[0].id,
          didSwitch: false,
          cooldownBlocked: false,
        }
    return { decision, switchOutcome: outcome }
  }

  // ≥2 sub: 解析切换 → 注入 active id → 调 symbol fan-out
  const switchInput: SubStrategySwitchInput = invocation?.subStrategyState ?? { currentBarIndex: 0 }
  // 用调用方实际传入的 switchTo（默认从 gate state 取）
  const resolvedSwitchTo = switchInput.switchToScopeId ?? orchestrationGateState?.switchToSubStrategyScopeId
  const outcome = resolveSubStrategySwitch(subScopes, {
    ...switchInput,
    switchToScopeId: resolvedSwitchTo,
  })

  const ctxIter = buildSubStrategyScopeIteration(ctx, { id: outcome.nextActiveScopeId })

  const baseDecision = runDecisionProgramsFanOut(
    ctxIter, programs, exprValues, guardState,
    decisionOrder, orchestrationGateState, portfolioRiskState,
    orchestrationScopes, orchestrationLegScopes,
  )

  // 切换发生：处理 outgoing close/cancel
  if (outcome.didSwitch && outcome.outgoingScope) {
    const deactivationMeta: SubStrategyDeactivationMeta = {
      outgoingScopeId: outcome.outgoingScope.id,
      incomingScopeId: outcome.incomingScope?.id,
      positionHandling: outcome.outgoingScope.positionHandlingOnDeactivate,
      orderHandling: outcome.outgoingScope.orderHandlingOnDeactivate,
      cancelOrders: outcome.outgoingScope.orderHandlingOnDeactivate === 'cancel',
    }
    // critic Round 1 修复：baseDecision 已是 CLOSE_*（来自 forceExit / strategyHalt 上游已 close）
    // 时不覆盖 — 只挂 meta，保留 upstream reason / meta（telemetry/SSE 不丢 forceExit 信号）
    const baseAlreadyClosing = baseDecision.action === 'CLOSE_LONG' || baseDecision.action === 'CLOSE_SHORT'
    if (!baseAlreadyClosing) {
      const currentPositionQty = readContextPositionQty(ctx)
      const closeDec = synthesizeSubStrategyDeactivationDecision(outcome, currentPositionQty)
      if (closeDec) {
        return {
          decision: Object.freeze(closeDec),
          switchOutcome: outcome,
          switchBarIndex: switchInput.currentBarIndex,
        }
      }
    }
    // 透传 baseDecision + 挂 deactivation meta（cancel 由 caller 消费）
    return {
      decision: Object.freeze({
        ...baseDecision,
        meta: {
          ...(baseDecision.meta ?? {}),
          subStrategyDeactivation: deactivationMeta,
        },
      }),
      switchOutcome: outcome,
      switchBarIndex: switchInput.currentBarIndex,
    }
  }

  return { decision: baseDecision, switchOutcome: outcome }
}

function readContextPositionQty(ctx: unknown): number {
  if (!ctx || typeof ctx !== 'object') return 0
  const c = ctx as { position?: { qty?: unknown } }
  const qty = c.position?.qty
  return typeof qty === 'number' && Number.isFinite(qty) ? qty : 0
}

// keep evaluate-orchestration-gates type import alive without forcing consumer re-imports
export type { OrchestrationGateState }
