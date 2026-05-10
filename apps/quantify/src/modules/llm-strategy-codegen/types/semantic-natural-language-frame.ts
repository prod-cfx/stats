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
  | SemanticAdaptiveVolatilityGridFrame
  | SemanticSymbolScopeFrame
  | SemanticLegScopeFrame
  | SemanticTimeframeScopeFrame

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

// Phase 5 S5 (#984): dynamic_grid frame
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

// Phase 5 S6 (#984): adaptive_volatility_grid frame
export interface SemanticAdaptiveVolatilityGridFrame extends SemanticFrameBase {
  kind: 'adaptive_volatility_grid'
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  sizing: { mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'; value: number }
  atrDriftPct?: number
  rebuildCooldownSec?: number
}

// Phase 5 S2 (#1104): symbol scope frame
export interface SemanticSymbolScopeFrame extends SemanticFrameBase {
  kind: 'symbol_scope'
  symbols: readonly string[]      // 大写规范化（BTCUSDT, ETHUSDT, ...）
  primarySymbol?: string           // 仅当 utterance 显式声明
}

// Phase 5 S11 (#1112): scope.leg frame
//   每条 leg 至少 legId / direction / instrumentSymbol；sizing 与 syncTriggerRequired 可选
//   parseLegScope 命中时由 NL gateway parse() 末尾合流步骤 suppress 同 utterance 的 symbol_scope frame（leg 优先）
export interface SemanticLegScopeFrame extends SemanticFrameBase {
  kind: 'leg_scope'
  legs: ReadonlyArray<{
    legId: string
    direction: 'long' | 'short'
    instrumentSymbol: string       // 大写规范化
    sizing?: {
      mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio'
      value: number
      pairedLegId?: string         // mode='fixed_ratio' 时必选
    }
  }>
  syncTriggerRequired?: boolean
// Phase 5 S3 (#1109): timeframe scope frame
export interface SemanticTimeframeScopeFrame extends SemanticFrameBase {
  kind: 'timeframe_scope'
  primaryTimeframe: string         // execution timeframe（'1m'..'1w'）
  requiredTimeframes: readonly string[]  // 依赖周期（≥1，比 primary 粗）
  alignmentPolicy?: 'strict' | 'tolerant'  // 默认 strict（normalizer 兜底）
}
