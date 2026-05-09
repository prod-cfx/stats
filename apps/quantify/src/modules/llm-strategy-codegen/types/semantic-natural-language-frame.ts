export type SemanticNaturalLanguageFrame =
  | SemanticContextFrame
  | SemanticIndicatorCompareFrame
  | SemanticBoundaryTouchFrame
  | SemanticActionFrame
  | SemanticRiskFrame
  | SemanticCombinationFrame
  | SemanticRegimeGateFrame
  | SemanticPortfolioDrawdownFrame
  | SemanticFixedGridGatedFrame
  | SemanticDynamicGridFrame

export interface SemanticFrameBase {
  id: string
  evidenceText: string
  confidence: number
}

export interface SemanticContextFrame extends SemanticFrameBase {
  kind: 'context'
  field: 'exchange' | 'symbol' | 'marketType' | 'timeframe'
  value: string
}

export interface SemanticIndicatorCompareFrame extends SemanticFrameBase {
  kind: 'indicator_compare'
  indicator: 'ema' | 'ma' | 'sma'
  period: number
  operator: 'GT' | 'LT'
  sideScope: 'long' | 'short'
  groupId: string
}

export interface SemanticBoundaryTouchFrame extends SemanticFrameBase {
  kind: 'boundary_touch'
  indicator: 'bollinger'
  boundaryRole: 'upper' | 'middle' | 'lower'
  sideScope: 'long' | 'short'
  phase: 'entry' | 'exit'
}

export interface SemanticActionFrame extends SemanticFrameBase {
  kind: 'action'
  actionKey: 'open_long' | 'open_short' | 'close_long' | 'close_short'
}

export interface SemanticRiskFrame extends SemanticFrameBase {
  kind: 'risk'
  riskKey: 'risk.stop_loss_pct'
  valuePct: number
}

export interface SemanticCombinationFrame extends SemanticFrameBase {
  kind: 'combination'
  groupId: string
  join: 'AND' | 'OR'
  sideScope: 'long' | 'short'
}

export interface SemanticRegimeGateFrame extends SemanticFrameBase {
  kind: 'regime_gate'
  sideScope: 'long' | 'short' | 'both'
  indicator: 'ema' | 'sma' | 'ma'
  period: number
  operator: 'GT' | 'LT'
}

export interface SemanticPortfolioDrawdownFrame extends SemanticFrameBase {
  kind: 'portfolio_drawdown'
  thresholdPct: number
  mode: 'observe' | 'enforce'
}

export interface SemanticFixedGridGatedFrame extends SemanticFrameBase {
  kind: 'fixed_grid_gated'
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  sizing: { mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'; value: number }
}

export interface SemanticDynamicGridFrame extends SemanticFrameBase {
  kind: 'dynamic_grid'
  anchorLookbackBars: number
  anchorSide: 'high' | 'low' | 'mid'
  levelCount: number
  step: { mode: 'pct' | 'absolute'; value: number }
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  sizing: { mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'; value: number }
}
