import type {
  SemanticAtomContract,
  SemanticEvidence,
  SemanticExpression,
  SemanticNodeStatus,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationPortfolioRiskMode,
  SemanticOrchestrationPortfolioRiskScope,
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
