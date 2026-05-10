import type {
  SemanticAtomContract,
  SemanticEvidence,
  SemanticExpression,
  SemanticNodeStatus,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationLegSizing,
  SemanticOrchestrationPortfolioRiskMode,
  SemanticOrchestrationPortfolioRiskScope,
  SemanticOrchestrationProgramAnchorSide,
  SemanticOrchestrationProgramDynamicGridStep,
  SemanticOrchestrationProgramGridParams,
  SemanticOrchestrationProgramKind,
  SemanticOrchestrationProgramOnDeactivate,
  SemanticOrchestrationProgramRebuildPolicy,
  SemanticOrchestrationProgramSizing,
  SemanticOrchestrationTimeframeAlignmentPolicy,
  SemanticPositionConstraintKey,
  SemanticPositionSizingContract,
  SemanticSlotState,
  SemanticSource,
  SemanticSupportedTimeframe,
} from './semantic-state'
import type { CodegenContextSlotPatchValue } from './market-instrument-symbol'
import type { SemanticAtomSupportMetadata } from './semantic-atom-support'

export type CodegenSemanticTriggerParams = Record<string, unknown> & {
  expression?: SemanticExpression
}

export interface CodegenSemanticNodeEnvelope {
  id?: string
  status?: SemanticNodeStatus
  source?: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
  support?: SemanticAtomSupportMetadata
}

export interface CodegenSemanticPatch {
  contextSlots?: Record<string, string | number | boolean | null | CodegenContextSlotPatchValue>
  triggers?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    phase: 'entry' | 'exit' | 'risk' | 'gate'
    sideScope?: 'long' | 'short' | 'both'
    params?: CodegenSemanticTriggerParams
    contracts?: SemanticAtomContract[]
  }>
  actions?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    params?: Record<string, unknown>
    contracts?: SemanticAtomContract[]
  }>
  risk?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    params: Record<string, unknown>
    contracts?: SemanticAtomContract[]
  }>
  position?: (CodegenSemanticNodeEnvelope & {
    sizing?: SemanticPositionSizingContract | null
    mode: string
    value: number
    positionMode: string
    contracts?: SemanticAtomContract[]
    constraints?: Array<CodegenSemanticNodeEnvelope & {
      key: SemanticPositionConstraintKey
      params?: Record<string, unknown>
      contracts?: SemanticAtomContract[]
    }>
  }) | null
  orchestration?: {
    nodes?: CodegenSemanticOrchestrationNodePatch[]
  }
}

export type CodegenSemanticOrchestrationNodePatch =
  | CodegenSemanticOrchestrationGateNodePatch
  | CodegenSemanticOrchestrationPortfolioRiskNodePatch
  | CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
  | CodegenSemanticOrchestrationDynamicGridProgramNodePatch
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch
  | CodegenSemanticOrchestrationSymbolScopeNodePatch
  | CodegenSemanticOrchestrationLegScopeNodePatch
  | CodegenSemanticOrchestrationTimeframeScopeNodePatch

// Phase 5 S2 (#1104): scope.symbol patch 节点
export interface CodegenSemanticOrchestrationSymbolScopeNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'scope'
  key: 'scope.symbol'
  params: Record<string, unknown>
  symbolScopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}

// Phase 5 S11 (#1112): scope.leg patch 节点
//   与 symbolScopeKind 互斥；instrumentRef 必引用同 patch 中 status:'locked' 的 scope.symbol 节点 id
export interface CodegenSemanticOrchestrationLegScopeNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'scope'
  key: 'scope.leg'
  params: Record<string, unknown>
  legScopeKind: 'leg'
  legId: string
  direction: 'long' | 'short'
  instrumentRef: string
  legSizing?: SemanticOrchestrationLegSizing
  syncTriggerRequired?: boolean
// Phase 5 S3 (#1109): scope.timeframe patch 节点
export interface CodegenSemanticOrchestrationTimeframeScopeNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'scope'
  key: 'scope.timeframe'
  params: Record<string, unknown>
  timeframeScopeKind: 'timeframe'
  primaryTimeframe: SemanticSupportedTimeframe
  requiredTimeframes: readonly SemanticSupportedTimeframe[]
  alignmentPolicy: SemanticOrchestrationTimeframeAlignmentPolicy
}

export interface CodegenSemanticOrchestrationGateNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'gate'
  key: 'gate.regime'
  params: Record<string, unknown>
  target: SemanticOrchestrationGateTarget
  activeWhen: SemanticExpression
  effectWhenFalse: SemanticOrchestrationGateEffect
}

export interface CodegenSemanticOrchestrationPortfolioRiskNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'portfolioRisk'
  key: 'portfolioRisk.drawdown_block'
  params: Record<string, unknown>
  scope: SemanticOrchestrationPortfolioRiskScope
  mode: SemanticOrchestrationPortfolioRiskMode
  thresholdPct: number
}

export interface CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'program'
  key: 'program.fixed_grid_gated'
  params: Record<string, unknown>
  programKind: Extract<SemanticOrchestrationProgramKind, 'fixed_grid_gated'>
  activeWhenRef: string
  onDeactivate: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy: Extract<SemanticOrchestrationProgramRebuildPolicy, 'static'>
  gridParams: SemanticOrchestrationProgramGridParams
  sizing: SemanticOrchestrationProgramSizing
}

// Phase 5 S5 (#984): dynamic_grid program patch 变体
export interface CodegenSemanticOrchestrationDynamicGridProgramNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'program'
  key: 'program.dynamic_grid'
  params: Record<string, unknown>
  programKind: Extract<SemanticOrchestrationProgramKind, 'dynamic_grid'>
  activeWhenRef: string
  onDeactivate: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy: Extract<SemanticOrchestrationProgramRebuildPolicy, 'anchor_on_state_change'>
  anchorLookbackBars: number
  anchorSide: SemanticOrchestrationProgramAnchorSide
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  levelCount: number
  dynamicGridStep: SemanticOrchestrationProgramDynamicGridStep
  sizing: SemanticOrchestrationProgramSizing
}

// Phase 5 S6 (#984): adaptive_volatility_grid program patch 变体
export interface CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'program'
  key: 'program.adaptive_volatility_grid'
  params: Record<string, unknown>
  programKind: 'adaptive_volatility_grid'
  activeWhenRef: string
  onDeactivate: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy: 'atr_window'
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  atrDriftPct: number
  rebuildCooldownSec: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
  sizing: SemanticOrchestrationProgramSizing
}

/**
 * @deprecated 历史别名，保留以兼容外部调用方；新代码用 CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
 */
export type CodegenSemanticOrchestrationProgramNodePatch =
  | CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
  | CodegenSemanticOrchestrationDynamicGridProgramNodePatch
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch
