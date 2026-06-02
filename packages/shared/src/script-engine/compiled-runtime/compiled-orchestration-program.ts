/**
 * Orchestration program contract type (Phase 5 S4 + S5 + S6, issue #984).
 *
 * 判别联合 by `programKind`：
 *
 * - `fixed_grid_gated`（S4）：通过 activeWhenExprId 引用 gate.regime，
 *   失活按 onDeactivate 行为；rebuildPolicy 'static'，ladder 在 IR 阶段一次生成。
 *
 * - `dynamic_grid`（S5）：rebuildPolicy 'anchor_on_state_change'，
 *   anchor 跟随 lookback 窗口 high/low/mid 漂移触发 ladder rebuild；
 *   跨 K 线状态由 ProgramLifecycleState 透传 (lastBuildAnchor/lastBuildAt/lastBuildLadder)。
 *
 * - `adaptive_volatility_grid`（S6）：rebuildPolicy 'atr_window'，
 *   runtime 内联读 ctx.bars + atr() 计算 step/range，触发 ladder rebuild +
 *   [minStepPct, maxStepPct] 钳制；跨 K 线状态由 ProgramLifecycleState 透传。
 *
 * 由 runOrderPrograms 第 7 参 (orchestrationPrograms) 消费；lifecycle 状态由第 8 参 + 返回
 * `programLifecycleStateNext` 透传（详见 ProgramLifecycleState）。
 */

export interface CompiledOrchestrationProgramGridParams {
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
}

export interface CompiledOrchestrationProgramSizing {
  mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'
  value: number
}

export interface CompiledOrchestrationProgramDynamicGridStep {
  mode: 'pct' | 'absolute'
  value: number
}

export interface CompiledOrchestrationProgramDynamicGridParams {
  anchorLookbackBars: number
  anchorSide: 'high' | 'low' | 'mid'
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  levelCount: number
  step: CompiledOrchestrationProgramDynamicGridStep
}

export interface CompiledOrchestrationProgramAdaptiveGridParams {
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  atrDriftPct: number
  rebuildCooldownSec: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
}

export interface CompiledFixedGridGatedProgram {
  id: string
  programKind: 'fixed_grid_gated'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  gridParams: CompiledOrchestrationProgramGridParams
  sizing: CompiledOrchestrationProgramSizing
}

export interface CompiledDynamicGridProgram {
  id: string
  programKind: 'dynamic_grid'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'anchor_on_state_change'
  dynamicGridParams: CompiledOrchestrationProgramDynamicGridParams
  sizing: CompiledOrchestrationProgramSizing
}

export interface CompiledAdaptiveVolatilityGridProgram {
  id: string
  programKind: 'adaptive_volatility_grid'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'atr_window'
  adaptiveGridParams: CompiledOrchestrationProgramAdaptiveGridParams
  sizing: CompiledOrchestrationProgramSizing
}

// Phase 5 S12 (#1118): event_listener compiled 形态（IR 同形）
export interface CompiledEventListenerProgram {
  id: string
  programKind: 'event_listener'
  activeWhenExprId: string
  // event_listener 路径 fail-closed 拒收 'close'（无持仓语义）
  onDeactivate: 'cancel' | 'keep'
  rebuildPolicy: 'static' | 'on_schema_version_bump'
  // S12 锁定 webhook_event；其他 schema 由 readiness 拒入
  eventSchemaRef: 'webhook_event' | 'ohlcv' | 'orderbook' | 'liquidation'
  sourceFeedId: string
  permissionScope: string
  idempotencyKey: { fieldPath: string }
  dedupWindowMs: number
  expirationTtlMs: number
  expirationPolicy: 'drop' | 'escalate'
}

export type CompiledExecutionProgramKind = 'twap' | 'dca' | 'martingale' | 'rebalance' | 'iceberg'

export interface CompiledExecutionProgram {
  id: string
  programKind: CompiledExecutionProgramKind
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  params: Record<string, unknown>
}

export type CompiledOrchestrationProgram =
  | CompiledFixedGridGatedProgram
  | CompiledDynamicGridProgram
  | CompiledAdaptiveVolatilityGridProgram
  | CompiledEventListenerProgram
  | CompiledExecutionProgram

export function isFixedGridGatedProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledFixedGridGatedProgram {
  return program.programKind === 'fixed_grid_gated'
}

export function isDynamicGridProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledDynamicGridProgram {
  return program.programKind === 'dynamic_grid'
}

export function isAdaptiveVolatilityGridProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledAdaptiveVolatilityGridProgram {
  return program.programKind === 'adaptive_volatility_grid'
}

export function isEventListenerProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledEventListenerProgram {
  return program.programKind === 'event_listener'
}

export function isExecutionProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledExecutionProgram {
  return program.programKind === 'twap'
    || program.programKind === 'dca'
    || program.programKind === 'martingale'
    || program.programKind === 'rebalance'
    || program.programKind === 'iceberg'
}

/**
 * Phase 5 S12 (#1118) — event_listener 12 fail-closed 守卫的 runtime 副本（plan A10 #2）。
 * 与 readiness 16 重去掉 cross-node sourceRef/activeWhenRef 与 version-gate 双门 = 12 重。
 *   1) activeWhenExprId 非空字符串
 *   2) programKind === 'event_listener'
 *   3) onDeactivate ∈ {'cancel','keep'}
 *   4) rebuildPolicy ∈ {'static','on_schema_version_bump'}
 *   5) eventSchemaRef === 'webhook_event'
 *   6) sourceFeedId 非空字符串（IR 已固化）
 *   7) permissionScope 匹配 PERMISSION_SCOPE_PATTERN
 *   8) idempotencyKey.fieldPath 匹配 FIELD_PATH_PATTERN（0-1 个 `.`）
 *   9) dedupWindowMs 整数 ∈ [100, 3600000]
 *   10) expirationTtlMs 整数 ∈ [100, 86400000]
 *   11) expirationTtlMs > dedupWindowMs（严格大于）
 *   12) expirationPolicy ∈ {'drop','escalate'}
 *
 * 失败 → runtime 进 cancelledProgramIds + 占位 lifecycle state。
 */
export const EVENT_LISTENER_PERMISSION_SCOPE_PATTERN = /^[a-z][a-z0-9_:]{2,63}$/u
export const EVENT_LISTENER_FIELD_PATH_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}(\.[a-zA-Z][a-zA-Z0-9_]{0,63})?$/u
export const EVENT_LISTENER_DEDUP_WINDOW_MIN_MS = 100
export const EVENT_LISTENER_DEDUP_WINDOW_MAX_MS = 3_600_000
export const EVENT_LISTENER_EXPIRATION_TTL_MIN_MS = 100
export const EVENT_LISTENER_EXPIRATION_TTL_MAX_MS = 86_400_000
export const EVENT_LISTENER_DEDUP_BUFFER_CAPACITY = 1024

export function isValidEventListener(
  program: CompiledEventListenerProgram,
): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  if (program.programKind !== 'event_listener') return false
  if (program.onDeactivate !== 'cancel' && program.onDeactivate !== 'keep') return false
  if (program.rebuildPolicy !== 'static' && program.rebuildPolicy !== 'on_schema_version_bump') return false
  if (program.eventSchemaRef !== 'webhook_event') return false
  if (typeof program.sourceFeedId !== 'string' || program.sourceFeedId.length === 0) return false
  if (typeof program.permissionScope !== 'string' || !EVENT_LISTENER_PERMISSION_SCOPE_PATTERN.test(program.permissionScope)) {
    return false
  }
  const idempotency = program.idempotencyKey
  if (!idempotency || typeof idempotency.fieldPath !== 'string') return false
  if (!EVENT_LISTENER_FIELD_PATH_PATTERN.test(idempotency.fieldPath)) return false
  if (
    !Number.isInteger(program.dedupWindowMs)
    || program.dedupWindowMs < EVENT_LISTENER_DEDUP_WINDOW_MIN_MS
    || program.dedupWindowMs > EVENT_LISTENER_DEDUP_WINDOW_MAX_MS
  ) {
    return false
  }
  if (
    !Number.isInteger(program.expirationTtlMs)
    || program.expirationTtlMs < EVENT_LISTENER_EXPIRATION_TTL_MIN_MS
    || program.expirationTtlMs > EVENT_LISTENER_EXPIRATION_TTL_MAX_MS
  ) {
    return false
  }
  if (program.expirationTtlMs <= program.dedupWindowMs) return false
  if (program.expirationPolicy !== 'drop' && program.expirationPolicy !== 'escalate') return false
  return true
}

/**
 * dynamic_grid 8 fail-closed 守卫的 runtime 副本（plan Acceptance Runtime path 1 / Task 13）。
 * 失败 → 进 cancelledProgramIds 并写 dynamic_grid 占位 lifecycle state。
 *
 * rebuildMinIntervalSec 硬下限 60（runtime 锁，与 readiness 一致）。
 */
export const DYNAMIC_GRID_MIN_INTERVAL_SEC = 60

export function isValidDynamicGrid(
  program: CompiledDynamicGridProgram,
): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  if (program.rebuildPolicy !== 'anchor_on_state_change') return false
  if (
    program.onDeactivate !== 'cancel'
    && program.onDeactivate !== 'keep'
    && program.onDeactivate !== 'close'
  ) {
    return false
  }
  const p = program.dynamicGridParams
  if (!p) return false
  if (!Number.isInteger(p.anchorLookbackBars) || p.anchorLookbackBars < 10 || p.anchorLookbackBars > 1000) return false
  if (p.anchorSide !== 'high' && p.anchorSide !== 'low' && p.anchorSide !== 'mid') return false
  if (!Number.isFinite(p.anchorDriftPct) || p.anchorDriftPct <= 0 || p.anchorDriftPct > 100) return false
  if (!Number.isInteger(p.rebuildMinIntervalSec) || p.rebuildMinIntervalSec < DYNAMIC_GRID_MIN_INTERVAL_SEC) return false
  if (!Number.isInteger(p.levelCount) || p.levelCount < 2 || p.levelCount > 100) return false
  const step = p.step
  if (!step) return false
  if (step.mode !== 'pct' && step.mode !== 'absolute') return false
  if (!Number.isFinite(step.value) || step.value <= 0) return false
  const s = program.sizing
  if (!s) return false
  if (s.mode !== 'fixed_quote' && s.mode !== 'fixed_base' && s.mode !== 'fixed_pct') return false
  if (!Number.isFinite(s.value) || s.value <= 0) return false
  return true
}

/**
 * adaptive_volatility_grid 16 fail-closed 守卫的 runtime 副本（含核心字段）：
 * 见 plan Acceptance Runtime path 1。失败 → 进 cancelledProgramIds。
 *
 * 注意：rebuildCooldownSec 的硬下限 300（Phase 5 S6 risk delta：
 * ATR 是滑动窗口统计量，需更长 cooldown）。
 */
export const ADAPTIVE_GRID_MIN_COOLDOWN_SEC = 300

export function isValidAdaptiveVolatilityGrid(
  program: CompiledAdaptiveVolatilityGridProgram,
): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  if (program.rebuildPolicy !== 'atr_window') return false
  if (
    program.onDeactivate !== 'cancel'
    && program.onDeactivate !== 'keep'
    && program.onDeactivate !== 'close'
  ) {
    return false
  }
  const p = program.adaptiveGridParams
  if (!p) return false
  if (!Number.isInteger(p.atrPeriod) || p.atrPeriod < 2 || p.atrPeriod > 200) return false
  if (!Number.isFinite(p.atrMultiplier) || p.atrMultiplier <= 0) return false
  if (!Number.isFinite(p.rangeMultiplier) || p.rangeMultiplier <= 0) return false
  if (!Number.isFinite(p.atrDriftPct) || p.atrDriftPct <= 0 || p.atrDriftPct > 100) return false
  if (
    !Number.isInteger(p.rebuildCooldownSec)
    || p.rebuildCooldownSec < ADAPTIVE_GRID_MIN_COOLDOWN_SEC
  ) {
    return false
  }
  if (!Number.isFinite(p.minStepPct) || p.minStepPct <= 0) return false
  if (!Number.isFinite(p.maxStepPct) || p.maxStepPct <= 0) return false
  if (p.maxStepPct < p.minStepPct) return false
  if (!Number.isInteger(p.levelCount) || p.levelCount < 2 || p.levelCount > 100) return false
  const s = program.sizing
  if (!s) return false
  if (s.mode !== 'fixed_quote' && s.mode !== 'fixed_base' && s.mode !== 'fixed_pct') return false
  if (!Number.isFinite(s.value) || s.value <= 0) return false
  return true
}
