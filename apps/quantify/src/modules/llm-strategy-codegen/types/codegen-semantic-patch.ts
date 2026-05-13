import type { CodegenContextSlotPatchValue } from './market-instrument-symbol'
import type { SemanticAtomSupportMetadata } from './semantic-atom-support'
import type {
  SemanticAtomContract,
  SemanticEvidence,
  SemanticExpression,
  SemanticNodeStatus,
  SemanticOrchestrationDataSourceRole,
  SemanticOrchestrationDataSourceSchema,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationLegSizing,
  SemanticOrchestrationPortfolioRiskEffect,
  SemanticOrchestrationPortfolioRiskMode,
  SemanticOrchestrationPortfolioRiskScope,
  SemanticOrchestrationProgramAnchorSide,
  SemanticOrchestrationProgramDynamicGridStep,
  SemanticOrchestrationProgramExpirationPolicy,
  SemanticOrchestrationProgramGridParams,
  SemanticOrchestrationProgramIdempotencyKey,
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
    phase?: 'entry' | 'exit' | 'risk' | 'gate'
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
  | CodegenSemanticOrchestrationPortfolioSymbolExposureCapNodePatch
  | CodegenSemanticOrchestrationPortfolioSubStrategyExposureCapNodePatch
  | CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
  | CodegenSemanticOrchestrationDynamicGridProgramNodePatch
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch
  | CodegenSemanticOrchestrationEventListenerProgramNodePatch
  | CodegenSemanticOrchestrationSymbolScopeNodePatch
  | CodegenSemanticOrchestrationLegScopeNodePatch
  | CodegenSemanticOrchestrationTimeframeScopeNodePatch
  | CodegenSemanticOrchestrationDataSourceScopeNodePatch
  | CodegenSemanticOrchestrationSubStrategyScopeNodePatch
  | CodegenSemanticOrchestrationSubStrategyGateNodePatch

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
}

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

// Phase 5 S9 (#1110): scope.dataSource patch 节点
export interface CodegenSemanticOrchestrationDataSourceScopeNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'scope'
  key: 'scope.dataSource'
  params: Record<string, unknown>
  dataSourceScopeKind: 'dataSource'
  dataSourceRole: SemanticOrchestrationDataSourceRole
  dataSourceFeedId: string
  dataSourceSchemaRef: SemanticOrchestrationDataSourceSchema
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
  scope: 'portfolio'
  mode: SemanticOrchestrationPortfolioRiskMode
  thresholdPct: number
}

// Phase 5 S8 (#1119): portfolioRisk.symbol_exposure_cap patch 节点
//   scope discriminator='symbol'；effectWhenTriggered ∈ {block_new_entries, reduce_exposure}
//   boundSymbolScopeRef 必填，引用 status:'locked' 的 scope.symbol id
export interface CodegenSemanticOrchestrationPortfolioSymbolExposureCapNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'portfolioRisk'
  key: 'portfolioRisk.symbol_exposure_cap'
  params: Record<string, unknown>
  scope: 'symbol'
  mode: SemanticOrchestrationPortfolioRiskMode
  notionalCapPct: number
  effectWhenTriggered: Extract<SemanticOrchestrationPortfolioRiskEffect, 'block_new_entries' | 'reduce_exposure'>
  boundSymbolScopeRef?: string
}

// Phase 5 S8 (#1119): portfolioRisk.substrategy_exposure_cap patch 节点
//   scope discriminator='subStrategy'；effectWhenTriggered ∈ {block_new_entries, pause_substrategy}
//   boundSubStrategyScopeRef 必填，引用 status:'locked' 的 scope.subStrategy id
export interface CodegenSemanticOrchestrationPortfolioSubStrategyExposureCapNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'portfolioRisk'
  key: 'portfolioRisk.substrategy_exposure_cap'
  params: Record<string, unknown>
  scope: 'subStrategy'
  mode: SemanticOrchestrationPortfolioRiskMode
  notionalCapPct: number
  effectWhenTriggered: Extract<SemanticOrchestrationPortfolioRiskEffect, 'block_new_entries' | 'pause_substrategy'>
  boundSubStrategyScopeRef?: string
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

// Phase 5 S12 (#1118): event_listener program patch 变体
//   eventSchemaRef 锁定 'webhook_event'；其它 schema 在 readiness fail-closed
//   sourceRef cross-node 引用 scope.dataSource role='event'，readiness 链式校验
export interface CodegenSemanticOrchestrationEventListenerProgramNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'program'
  key: 'program.event_listener'
  params: Record<string, unknown>
  programKind: Extract<SemanticOrchestrationProgramKind, 'event_listener'>
  activeWhenRef: string
  // event_listener 路径仅 'cancel' / 'keep' 合法（readiness fail-closed 拒收 'close'）
  onDeactivate: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy: Extract<SemanticOrchestrationProgramRebuildPolicy, 'static' | 'on_schema_version_bump'>
  eventSchemaRef: SemanticOrchestrationDataSourceSchema
  sourceRef: string
  permissionScope: string
  idempotencyKey: SemanticOrchestrationProgramIdempotencyKey
  dedupWindowMs: number
  expirationTtlMs: number
  expirationPolicy: SemanticOrchestrationProgramExpirationPolicy
}

/**
 * @deprecated 历史别名，保留以兼容外部调用方；新代码用 CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
 */
export type CodegenSemanticOrchestrationProgramNodePatch =
  | CodegenSemanticOrchestrationFixedGridGatedProgramNodePatch
  | CodegenSemanticOrchestrationDynamicGridProgramNodePatch
  | CodegenSemanticOrchestrationAdaptiveVolatilityGridProgramNodePatch
  | CodegenSemanticOrchestrationEventListenerProgramNodePatch

// Phase 5 S10 (#1111): scope.subStrategy patch 节点
export interface CodegenSemanticOrchestrationSubStrategyScopeNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'scope'
  key: 'scope.subStrategy'
  params: Record<string, unknown>
  subStrategyScopeKind: 'subStrategy'
  subStrategyId: string
  subStrategyLabel?: string
  positionHandlingOnDeactivate?: 'close' | 'keep'
  orderHandlingOnDeactivate?: 'cancel' | 'keep'
}

// Phase 5 S10 (#1111): gate phase=subStrategy patch 节点
export interface CodegenSemanticOrchestrationSubStrategyGateNodePatch extends CodegenSemanticNodeEnvelope {
  kind: 'gate'
  key: 'gate.subStrategy'
  params: Record<string, unknown>
  target: SemanticOrchestrationGateTarget
  activeWhen: SemanticExpression
  effectWhenFalse: SemanticOrchestrationGateEffect
}
