export type SemanticNaturalLanguageFrame =
  | SemanticContextFrame
  | SemanticIndicatorCompareFrame
  | SemanticBoundaryTouchFrame
  | SemanticActionFrame
  | SemanticRiskFrame
  | SemanticCombinationFrame
  | SemanticRegimeGateFrame

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
