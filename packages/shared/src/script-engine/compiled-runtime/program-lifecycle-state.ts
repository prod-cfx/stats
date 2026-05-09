// Phase 5 S0a: program lifecycle state union 占位
// Phase 5 S5 (#984): 追加 dynamic_grid 成员，承载 anchor / lastBuildAt / ladder
// 后续 S6 在此 union 追加 adaptive_volatility_grid 成员
export type ProgramLifecycleState =
  | { readonly kind: 'fixed_grid_gated' }
  | {
    readonly kind: 'dynamic_grid'
    readonly lastBuildAnchor: number
    readonly lastBuildAt: number
    readonly lastBuildLadder: readonly { readonly id: string; readonly level: number }[]
  }
