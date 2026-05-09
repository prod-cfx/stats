/**
 * Orchestration program contract type (Phase 5 S4 + S6, issue #984).
 *
 * 判别联合 by `programKind`：
 *
 * - `fixed_grid_gated`（S4）：通过 activeWhenExprId 引用 gate.regime，
 *   失活按 onDeactivate 行为；rebuildPolicy 'static'，ladder 在 IR 阶段一次生成。
 *
 * - `adaptive_volatility_grid`（S6）：rebuildPolicy 'atr_window'，
 *   runtime 内联读 ctx.bars + atr() 计算 step/range，触发 ladder rebuild +
 *   [minStepPct, maxStepPct] 钳制；跨 K 线状态由 ProgramLifecycleState 透传。
 *
 * 与 evaluate-orchestration-gates.ts / evaluate-orchestration-portfolio-risks.ts
 * 同目录，由 runOrderPrograms 第 7 参数消费。
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

export interface CompiledAdaptiveVolatilityGridProgram {
  id: string
  programKind: 'adaptive_volatility_grid'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'atr_window'
  adaptiveGridParams: CompiledOrchestrationProgramAdaptiveGridParams
  sizing: CompiledOrchestrationProgramSizing
}

export type CompiledOrchestrationProgram =
  | CompiledFixedGridGatedProgram
  | CompiledAdaptiveVolatilityGridProgram

export function isAdaptiveVolatilityGridProgram(
  program: CompiledOrchestrationProgram,
): program is CompiledAdaptiveVolatilityGridProgram {
  return program.programKind === 'adaptive_volatility_grid'
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
