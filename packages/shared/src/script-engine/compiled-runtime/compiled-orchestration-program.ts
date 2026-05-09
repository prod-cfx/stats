/**
 * Orchestration program contract type (Phase 5 S4 + S5, issue #984).
 *
 * `program.fixed_grid_gated` 是 Phase 5 S4 注册的第三个 supported orchestration capability。
 * `program.dynamic_grid` 是 Phase 5 S5 注册的第四个 supported orchestration capability。
 *
 * union 改为 discriminated by `programKind`（critic round 1 M2）：
 * - 'fixed_grid_gated' 变体：静态 ladder（IR 阶段一次生成，runtime 不重建）
 * - 'dynamic_grid'     变体：anchor 跟随 lookback 窗口 high/low/mid 漂移触发 ladder rebuild
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

export type CompiledOrchestrationProgram =
  | CompiledFixedGridGatedProgram
  | CompiledDynamicGridProgram

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
