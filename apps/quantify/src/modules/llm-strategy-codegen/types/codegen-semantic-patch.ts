import type {
  SemanticAtomContract,
  SemanticEvidence,
  SemanticExpression,
  SemanticNodeStatus,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationPortfolioRiskMode,
  SemanticOrchestrationPortfolioRiskScope,
  SemanticOrchestrationProgramGridParams,
  SemanticOrchestrationProgramKind,
  SemanticOrchestrationProgramOnDeactivate,
  SemanticOrchestrationProgramRebuildPolicy,
  SemanticOrchestrationProgramSizing,
  SemanticPositionConstraintKey,
  SemanticPositionSizingContract,
  SemanticSlotState,
  SemanticSource,
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
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch

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
  programKind: 'fixed_grid_gated'
  activeWhenRef: string
  onDeactivate: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy: 'static'
  gridParams: SemanticOrchestrationProgramGridParams
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
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch
