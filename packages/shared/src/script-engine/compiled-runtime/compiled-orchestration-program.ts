/**
 * Orchestration program contract type (Phase 5 S4, issue #984).
 *
 * `program.fixed_grid_gated` 是 Phase 5 第三个 supported orchestration capability：
 * - 通过 activeWhenExprId 引用 gate.regime 的 expr id（IR 阶段 inline 字面量）
 * - 失活时按 onDeactivate 行为：cancel(撤单) / keep(保单子) / close(平仓)
 * - rebuildPolicy 'static' 表示 ladder 在 IR 阶段一次生成，runtime 不重建
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

export interface CompiledOrchestrationProgram {
  id: string
  programKind: 'fixed_grid_gated'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  gridParams: CompiledOrchestrationProgramGridParams
  sizing: CompiledOrchestrationProgramSizing
}
