import type { SemanticAtomSupportMetadata, UnsupportedFallbackState } from './semantic-atom-support'

export type SemanticNodeStatus = 'open' | 'locked' | 'superseded'
export type SemanticSource = 'user_explicit' | 'inferred' | 'derived'
export type SemanticPriority = 'core' | 'behavior' | 'risk' | 'context'
export type SemanticExpressionOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'CROSS_OVER' | 'CROSS_UNDER'
export type SemanticExpression = SemanticPredicateExpression | SemanticLogicalExpression
export type SemanticPredicateJoin = 'allOf' | 'anyOf'
export type SemanticSequenceKind = 'rsi_reclaim' | 'pullback_reclaim' | 'breakout_retest' | 'consecutive_candles'
export type SemanticContractKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'
export type SemanticCapabilityDomain =
  | 'market'
  | 'price'
  | 'order_program'
  | 'capital'
  | 'exposure'
  | 'margin'
  | 'guard'
  | 'runtime'
  | 'state'
  | 'order'
  | 'portfolio'
  | 'orchestration'
export type SemanticOrchestrationContractKind = 'scope' | 'gate' | 'program' | 'portfolioRisk'

export interface SemanticSeriesReference {
  source: 'price' | 'volume' | 'indicator' | 'memory'
  indicator?: 'ma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'atr'
  field?: string
  period?: number
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
  boundaryRole?: string
  memoryKey?: string
}

export type SemanticPredicateOperand = SemanticSeriesReference | number | string | boolean | null

export interface SemanticPredicateShape {
  kind: 'compare' | 'cross' | 'sequence' | 'logical'
  join?: SemanticPredicateJoin
  sequenceKind?: SemanticSequenceKind
  left?: SemanticPredicateOperand
  right?: SemanticPredicateOperand
  op?: SemanticExpressionOperator
  items?: SemanticPredicateShape[]
  steps?: SemanticPredicateShape[]
  memoryKey?: string
}

export interface SemanticPredicateExpression {
  kind: 'predicate'
  op: SemanticExpressionOperator
  left: SemanticExpressionOperand
  right: SemanticExpressionOperand
}

export interface SemanticLogicalExpression {
  kind: 'AND' | 'OR' | 'NOT'
  children: SemanticExpression[]
}

export type SemanticExpressionOperand =
  | { kind: 'series'; source: 'bar'; field: 'open' | 'high' | 'low' | 'close'; offsetBars?: number; timeframe?: string }
  | { kind: 'indicator'; name: 'sma' | 'ema' | 'rsi' | 'macd'; params: Record<string, unknown>; output?: string }
  | { kind: 'position'; field: 'avg_price' | 'pnl_pct' | 'bars_held' | 'has_position'; side?: 'long' | 'short' | 'both' }
  | { kind: 'account'; field: 'drawdown_pct' }
  | { kind: 'constant'; value: number | string | boolean; unit?: 'quote' | 'base' | 'ratio' | 'percent' | 'price' }
  | { kind: 'memory'; memoryKey: string; path?: string[] }

export interface SemanticSlotIdentity {
  slotKey: string
  fieldPath: string
}

export function buildSemanticSlotId(slot: SemanticSlotIdentity): string {
  return JSON.stringify([slot.slotKey, slot.fieldPath])
}

export interface SemanticEvidence {
  text: string
  messageIndex?: number
  source: SemanticSource
}

export interface SemanticSlotState {
  slotKey: string
  fieldPath: string
  value?: string | number | boolean | null
  status: SemanticNodeStatus
  priority: SemanticPriority
  questionHint: string
  affectsExecution: boolean
  evidence?: SemanticEvidence
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
}

export interface SemanticCapabilityShape {
  [key: string]: string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[]
}

export interface SemanticCapability {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
  shape: SemanticCapabilityShape
}

export interface SemanticRequirement {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
}

export interface SemanticRuntimeRequirement extends Omit<SemanticRequirement, 'domain'> {
  domain: 'runtime'
  shape?: SemanticCapabilityShape
}

export interface SemanticStateRequirement extends Omit<SemanticRequirement, 'domain'> {
  domain: 'state'
  shape?: SemanticCapabilityShape
}

export interface SemanticOrderRequirement extends Omit<SemanticRequirement, 'domain'> {
  domain: 'order'
  shape?: SemanticCapabilityShape
}

export interface SemanticEffect {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
  shape?: SemanticCapabilityShape
}

export interface SemanticAtomContract {
  id: string
  kind: SemanticContractKind
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
  effects?: readonly SemanticEffect[]
}

export interface SemanticContextSlotState {
  exchange: SemanticSlotState | null
  symbol: SemanticSlotState | null
  marketType: SemanticSlotState | null
  timeframe: SemanticSlotState | null
}

export interface SemanticTriggerState {
  id: string
  key: string
  phase: 'entry' | 'exit' | 'risk' | 'gate'
  params: Record<string, unknown>
  sideScope?: 'long' | 'short' | 'both'
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
  support?: SemanticAtomSupportMetadata
}

export interface SemanticActionState {
  id: string
  key: string
  params?: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
  support?: SemanticAtomSupportMetadata
}

export type SemanticRiskBasis =
  | 'prev_close'
  | 'entry_avg_price'
  | 'position_pnl'
  | 'peak_equity'
  | 'peak_position_pnl'
  | 'upper_band'
  | 'lower_band'
  | 'middle_band'
  | 'last_high'
  | 'last_low'
export type SemanticRiskBasisSource = 'user_explicit' | 'system_default' | 'derived'
export type SemanticRiskEffectType = 'close_position' | 'reduce_position' | 'notify_only' | 'pause_strategy'
export type SemanticRiskScope = 'current_position' | 'long' | 'short' | 'both' | 'strategy' | 'account'

export interface SemanticPercentRiskParams extends Record<string, unknown> {
  valuePct: number
  direction: 'loss' | 'profit'
  basis: SemanticRiskBasis
  basisSource: SemanticRiskBasisSource
  effect: Exclude<SemanticRiskEffectType, 'pause_strategy'>
  scope: SemanticRiskScope
  reducePct?: number
}

export interface SemanticRiskConditionExpressionParams extends Record<string, unknown> {
  condition: SemanticExpression
  effect: {
    type: SemanticRiskEffectType
    reducePct?: number
  }
  scope: SemanticRiskScope
  capabilityStatus: 'supported' | 'recognized_unsupported'
  unsupportedReason?: string
}

export type SemanticRiskParams =
  | SemanticPercentRiskParams
  | SemanticRiskConditionExpressionParams
  | Record<string, unknown>

export interface SemanticRiskState {
  id: string
  key: string
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
  support?: SemanticAtomSupportMetadata
}

export type SemanticPositionSizingContract =
  | { kind: 'ratio'; value: number; unit: 'ratio' | 'percent' }
  | { kind: 'quote'; value: number; asset: 'USDT' | 'USDC' | 'USD' }
  | { kind: 'base'; value: number; asset: string }

export type SemanticPositionConstraintKey =
  | 'position.pyramiding_limit'
  | 'position.max_exposure_pct'
  | 'position.dca_schedule'

export interface SemanticPositionConstraintState {
  id: string
  key: SemanticPositionConstraintKey
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
  support?: SemanticAtomSupportMetadata
}

export interface SemanticPositionState {
  sizing?: SemanticPositionSizingContract | null
  mode: string
  value: number
  positionMode: string
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
  contracts?: SemanticAtomContract[]
  constraints?: SemanticPositionConstraintState[]
  support?: SemanticAtomSupportMetadata
}

export interface SemanticOrchestrationGateTarget {
  phase: 'entry'
  sideScope?: 'long' | 'short' | 'both'
}

export type SemanticOrchestrationGateEffect = 'block_new_entries'

export type SemanticOrchestrationPortfolioRiskMode = 'observe' | 'enforce'

export type SemanticOrchestrationPortfolioRiskScope = 'portfolio'

export type SemanticOrchestrationProgramKind = 'fixed_grid_gated'

export type SemanticOrchestrationProgramOnDeactivate = 'cancel' | 'keep' | 'close'

export type SemanticOrchestrationProgramRebuildPolicy = 'static'

export type SemanticOrchestrationProgramSizingMode = 'fixed_quote' | 'fixed_base' | 'fixed_pct'

export interface SemanticOrchestrationProgramSizing {
  mode: SemanticOrchestrationProgramSizingMode
  value: number
}

export interface SemanticOrchestrationProgramGridParams {
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
}

export interface SemanticOrchestrationContract {
  id: string
  kind: SemanticOrchestrationContractKind
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
  effects?: readonly SemanticEffect[]
  target?: SemanticOrchestrationGateTarget
  // 兼容 #1043 atom 翻牌基建：声明该 contract 的翻牌起效版本（YYYY.MM.WNN）
  // 缺失时 isAtomExecutableForStrategy 会 fail-closed 走旧行为
  executableSinceVersion?: string
}

export interface SemanticOrchestrationNode {
  id: string
  kind: SemanticOrchestrationContractKind
  key?: string
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: readonly SemanticSlotState[]
  contracts: readonly SemanticOrchestrationContract[]
  target?: SemanticOrchestrationGateTarget
  activeWhen?: SemanticExpression
  effectWhenFalse?: SemanticOrchestrationGateEffect
  // program 节点专属（其它 kind 不读）— Phase 5 S4 (#984)
  programKind?: SemanticOrchestrationProgramKind
  activeWhenRef?: string  // 引用同 state.orchestration.nodes 中 supported gate 节点 id
  onDeactivate?: SemanticOrchestrationProgramOnDeactivate
  rebuildPolicy?: SemanticOrchestrationProgramRebuildPolicy
  gridParams?: SemanticOrchestrationProgramGridParams
  sizing?: SemanticOrchestrationProgramSizing
  // portfolioRisk 节点专属（其它 kind 不读）
  mode?: SemanticOrchestrationPortfolioRiskMode
  thresholdPct?: number
  scope?: SemanticOrchestrationPortfolioRiskScope
  support?: SemanticAtomSupportMetadata
}

export interface SemanticOrchestrationState {
  nodes: readonly SemanticOrchestrationNode[]
  contracts: readonly SemanticOrchestrationContract[]
}

export interface SemanticState {
  version: 1
  families: string[]
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  contextSlots: SemanticContextSlotState
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
  orchestration?: SemanticOrchestrationState
  unsupportedFallback?: UnsupportedFallbackState | null
}
