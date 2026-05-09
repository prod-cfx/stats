// Phase 5 S0a: program lifecycle state union 占位
// 后续 S5/S6 在此 union 追加 dynamic_grid / adaptive_volatility_grid 成员
export type ProgramLifecycleState =
  | { readonly kind: 'fixed_grid_gated' }
