// Phase 5 S0a: program lifecycle state union 占位
// S5 在此 union 追加 dynamic_grid 成员；S6 追加 adaptive_volatility_grid 成员
//
// dynamic_grid（Phase 5 S5, #984）携带跨 K 线 anchor 状态：
//   - lastBuildAnchor：上次 rebuild 时的 anchor 价位（high/low/mid）
//   - lastBuildAt：上次 rebuild 的 ms epoch（用于 rebuildMinIntervalSec 限速）
//   - lastBuildLadder：上次 rebuild 写入的 levels 快照（不可变）
//
// adaptive_volatility_grid（Phase 5 S6, #984）携带跨 K 线 ATR 状态：
//   - lastBuildATR：上次 rebuild 时 atr() 的返回值（基线 ATR）
//   - lastBuildAt：上次 rebuild 时的 ms epoch（用于 cooldown）
//   - lastBuildLadder：上次 rebuild 写入的 levels 快照（不可变）
//   - rebuildClamped：上次 rebuild 是否触发了 [minStepPct, maxStepPct] 钳制
export type ProgramLifecycleState =
  | { readonly kind: 'fixed_grid_gated' }
  | {
      readonly kind: 'dynamic_grid'
      readonly lastBuildAnchor: number
      readonly lastBuildAt: number
      readonly lastBuildLadder: ReadonlyArray<{ readonly id: string; readonly level: number }>
    }
  | {
      readonly kind: 'adaptive_volatility_grid'
      readonly lastBuildATR: number
      readonly lastBuildAt: number
      readonly lastBuildLadder: ReadonlyArray<{ readonly id: string; readonly level: number }>
      readonly rebuildClamped: boolean
    }
