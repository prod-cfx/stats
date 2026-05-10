import { TIMEFRAME_MS } from '@ai/shared/script-engine/compiled-runtime'
import type { SemanticAtomSupportMetadata, UnsupportedFallbackState } from './semantic-atom-support'

// Phase 5 S3 (#1109): timeframe vocab 单一 source-of-truth — 派生于 packages/shared TIMEFRAME_MS
//   critic Round 2 M2-R2：避免 quantify types 与 runtime 双 white-list drift
export const SEMANTIC_SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAME_MS)) as readonly (keyof typeof TIMEFRAME_MS)[]
export type SemanticSupportedTimeframe = keyof typeof TIMEFRAME_MS
export type SemanticOrchestrationTimeframeAlignmentPolicy = 'strict' | 'tolerant'

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

// Phase 5 S9 (#1110): scope.dataSource role / schema 枚举
export type SemanticOrchestrationDataSourceRole = 'primary' | 'confirmation' | 'event'
export type SemanticOrchestrationDataSourceSchema = 'ohlcv' | 'orderbook' | 'liquidation' | 'webhook_event'

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
  // Phase 5 S2 (#1104): 多标的策略中显式声明该 trigger 归属哪个 scope.symbol 节点
  // 单/0 scope 策略不读；多 scope 策略缺该字段 readiness fail-closed
  symbolScopeRef?: string
  // Phase 5 S11 (#1112): 多腿策略中显式声明该 trigger 归属哪个 scope.leg 节点
  // 单/0 leg 策略不读；多 leg 策略缺该字段 readiness fail-closed
  legScopeRef?: string
  // Phase 5 S3 (#1109): 多周期策略中显式声明该 trigger 归属哪个 scope.timeframe 节点
  // ≥1 scope.timeframe locked 节点存在时 readiness 强制要求
  timeframeScopeRef?: string
  // Phase 5 S9 (#1110): 显式声明该 trigger 归属哪个 scope.dataSource 节点
  // 0 dataSource scope 策略不读；声明但 ref 不在 supported 集合时 readiness fail-closed
  dataSourceScopeRef?: string
  // Phase 5 S10 (#1111): 多 subStrategy 策略中显式声明该 trigger 归属哪个 scope.subStrategy 节点
  subStrategyScopeRef?: string
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
  // Phase 5 S2 (#1104): 多标的策略中显式声明该 action 归属哪个 scope.symbol 节点
  symbolScopeRef?: string
  // Phase 5 S11 (#1112): 多腿策略中显式声明该 action 归属哪个 scope.leg 节点
  legScopeRef?: string
  // Phase 5 S3 (#1109): 多周期策略中显式声明该 action 归属哪个 scope.timeframe 节点
  timeframeScopeRef?: string
  // Phase 5 S9 (#1110): 显式声明该 action 归属哪个 scope.dataSource 节点
  dataSourceScopeRef?: string
  // Phase 5 S10 (#1111): 多 subStrategy 策略中显式声明该 action 归属哪个 scope.subStrategy 节点
  subStrategyScopeRef?: string
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
  // Phase 5 S2 (#1104): 多标的策略中显式声明该 risk 归属哪个 scope.symbol 节点
  symbolScopeRef?: string
  // Phase 5 S11 (#1112): 多腿策略中显式声明该 risk 归属哪个 scope.leg 节点
  legScopeRef?: string
  // Phase 5 S3 (#1109): 多周期策略中显式声明该 risk 归属哪个 scope.timeframe 节点
  timeframeScopeRef?: string
  // Phase 5 S9 (#1110): 显式声明该 risk 归属哪个 scope.dataSource 节点
  dataSourceScopeRef?: string
  // Phase 5 S10 (#1111): 多 subStrategy 策略中显式声明该 risk 归属哪个 scope.subStrategy 节点
  subStrategyScopeRef?: string
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
  // Phase 5 S2 (#1104): 多标的策略中显式声明该 position constraint 归属哪个 scope.symbol 节点
  symbolScopeRef?: string
  // Phase 5 S11 (#1112): 多腿策略中显式声明该 position constraint 归属哪个 scope.leg 节点
  legScopeRef?: string
  // Phase 5 S3 (#1109): 多周期策略中显式声明该 position constraint 归属哪个 scope.timeframe 节点
  timeframeScopeRef?: string
  // Phase 5 S9 (#1110): 显式声明该 position constraint 归属哪个 scope.dataSource 节点
  dataSourceScopeRef?: string
  // Phase 5 S10 (#1111): 多 subStrategy 策略中显式声明该 position constraint 归属哪个 scope.subStrategy 节点
  subStrategyScopeRef?: string
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

// Phase 5 S10 (#1111): gate target.phase 扩 'strategy' | 'subStrategy'
// 用 discriminated union 强约束三变体合法形态
export type SemanticOrchestrationGatePhase = 'entry' | 'strategy' | 'subStrategy'

export type SemanticOrchestrationGateTarget =
  | { phase: 'entry'; sideScope?: 'long' | 'short' | 'both' }
  | { phase: 'strategy' }
  | { phase: 'subStrategy'; subStrategyScopeRef: string; toSubStrategyScopeRef?: string }

// Phase 5 S10 (#1111): effect 扩 'pause_substrategy' | 'switch_substrategy'
//   block_new_entries 仅 phase='entry'
//   pause_substrategy 仅 phase='subStrategy' 无 toSubStrategyScopeRef
//   switch_substrategy 仅 phase='subStrategy' 必含 toSubStrategyScopeRef ≠ subStrategyScopeRef
export type SemanticOrchestrationGateEffect =
  | 'block_new_entries'
  | 'pause_substrategy'
  | 'switch_substrategy'

export type SemanticOrchestrationPortfolioRiskMode = 'observe' | 'enforce'

export type SemanticOrchestrationPortfolioRiskScope = 'portfolio'

export type SemanticOrchestrationProgramKind = 'fixed_grid_gated' | 'dynamic_grid' | 'adaptive_volatility_grid'

export type SemanticOrchestrationProgramOnDeactivate = 'cancel' | 'keep' | 'close'

export type SemanticOrchestrationProgramRebuildPolicy = 'static' | 'anchor_on_state_change' | 'atr_window'

export type SemanticOrchestrationProgramSizingMode = 'fixed_quote' | 'fixed_base' | 'fixed_pct'

export type SemanticOrchestrationProgramAnchorSide = 'high' | 'low' | 'mid'

export type SemanticOrchestrationProgramDynamicGridStepMode = 'pct' | 'absolute'

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

export interface SemanticOrchestrationProgramDynamicGridStep {
  mode: SemanticOrchestrationProgramDynamicGridStepMode
  value: number
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
  // dynamic_grid 节点专属（其它 programKind 不读）— Phase 5 S5 (#984)
  // 与 S4 gridParams 平级；不与 fixed_grid_gated 共用结构，便于 type narrowing。
  anchorLookbackBars?: number
  anchorSide?: SemanticOrchestrationProgramAnchorSide
  anchorDriftPct?: number
  rebuildMinIntervalSec?: number
  dynamicGridStep?: SemanticOrchestrationProgramDynamicGridStep
  // adaptive_volatility_grid 专属（其它 programKind 不读）— Phase 5 S6 (#984)
  // 注：levelCount 单列于此而非复用 gridParams.levelCount，因为 gridParams
  // 还含 anchorPrice / stepPct（fixed_grid_gated 必填，不应渗到 adaptive）
  atrPeriod?: number
  atrMultiplier?: number
  rangeMultiplier?: number
  atrDriftPct?: number
  rebuildCooldownSec?: number
  minStepPct?: number
  maxStepPct?: number
  // dynamic_grid 节点的档位数（与 fixed_grid_gated 的 gridParams.levelCount 互斥）
  levelCount?: number
  // portfolioRisk 节点专属（其它 kind 不读）
  mode?: SemanticOrchestrationPortfolioRiskMode
  thresholdPct?: number
  scope?: SemanticOrchestrationPortfolioRiskScope
  // scope.symbol 节点专属（其它 kind 不读）— Phase 5 S2 (#1104)
  // 注：与 portfolioRisk 的 `scope: 'portfolio'` 命名分离（symbolScopeKind 限定 scope 子类型）
  symbolScopeKind?: 'symbol'
  symbols?: readonly string[]
  primarySymbol?: string
  // scope.leg 节点专属（其它 kind / 其它 sub-kind 不读）— Phase 5 S11 (#1112)
  // 与 symbolScopeKind 互斥；同时持有由 readiness validateLegScopeNode fail-closed
  legScopeKind?: 'leg'
  legId?: string
  direction?: 'long' | 'short'
  // 必须引用同 state.orchestration.nodes[] 中 status:'locked' 的 scope.symbol 节点 id
  instrumentRef?: string
  legSizing?: SemanticOrchestrationLegSizing
  // S11 仅声明透传，不在运行时强制；follow-up 落地 cross-program 同步触发聚合
  syncTriggerRequired?: boolean
  // scope.timeframe 节点专属（其它 kind 不读）— Phase 5 S3 (#1109)
  // 注：与 symbolScopeKind 互斥（timeframeScopeKind 限定 scope 子类型）
  timeframeScopeKind?: 'timeframe'
  primaryTimeframe?: SemanticSupportedTimeframe
  requiredTimeframes?: readonly SemanticSupportedTimeframe[]
  alignmentPolicy?: SemanticOrchestrationTimeframeAlignmentPolicy
  // scope.dataSource 节点专属（其它 kind 不读）— Phase 5 S9 (#1110)
  // 已知 tech debt：未来 ≥3 scope kind 时考虑重构 discriminated union（follow-up issue）
  dataSourceScopeKind?: 'dataSource'
  dataSourceRole?: SemanticOrchestrationDataSourceRole
  dataSourceFeedId?: string
  dataSourceSchemaRef?: SemanticOrchestrationDataSourceSchema
  // scope.subStrategy 节点专属（其它 kind 不读）— Phase 5 S10 (#1111)
  subStrategyScopeKind?: 'subStrategy'
  subStrategyId?: string
  subStrategyLabel?: string
  positionHandlingOnDeactivate?: 'close' | 'keep'
  orderHandlingOnDeactivate?: 'cancel' | 'keep'
  support?: SemanticAtomSupportMetadata
}

// Phase 5 S11 (#1112): scope.leg sizing 描述
//   mode='fixed_ratio' 时 pairedLegId 必填，并由 readiness 校验 paired direction 互反
export type SemanticOrchestrationLegSizingMode = 'fixed_pct' | 'fixed_quote' | 'fixed_ratio'

export interface SemanticOrchestrationLegSizing {
  mode: SemanticOrchestrationLegSizingMode
  value: number
  pairedLegId?: string
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
