import { TIMEFRAME_MS } from '@ai/shared/script-engine/compiled-runtime'
import type { AtomContractBucket } from '../atom-contracts/atom-contract-types'
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
  // Phase 5 S12 (#1118): event_listener effects domain
  | 'data'
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
  // #1409: atom-driven 单 slot 抽参元数据
  //   - atomKey：dispatcher 注册的 atom 标识（如 'grid.range_rebalance'）
  //   - paramSlotKey：atom 内 param 名（如 'levels'/'stepPct'）
  // 仅在 seed-builder 能确定时回填；纯流程性 open slot（trigger.entry/exit、position.sizing、contextSlots.symbol）保持空
  readonly atomKey?: string
  readonly paramSlotKey?: string
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
  | 'grid.range_rebalance'

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

// Phase 5 S8 (#1119): scope 扩 'symbol' | 'subStrategy'；旧 'portfolio' 保留 byte-equal 兼容
export type SemanticOrchestrationPortfolioRiskScope = 'portfolio' | 'symbol' | 'subStrategy'

// Phase 5 S8 (#1119): portfolioRisk 节点触发后行为
//   - block_new_entries 三 scope 通用
//   - reduce_exposure 仅 scope='symbol'
//   - pause_substrategy 仅 scope='subStrategy'
export type SemanticOrchestrationPortfolioRiskEffect =
  | 'block_new_entries'
  | 'reduce_exposure'
  | 'pause_substrategy'

// Phase 5 S12 (#1118): event_listener 加入 program kind 联合
export type SemanticOrchestrationProgramKind =
  | 'fixed_grid_gated'
  | 'dynamic_grid'
  | 'adaptive_volatility_grid'
  | 'event_listener'

/**
 * Issue #1439：网格类 program kind 常量集合（位置/PR 真相源）。
 *   网格 program 在 runtime 双向挂单（OPEN_LONG + OPEN_SHORT 同时维护），
 *   天然 long_short。`compiled-publication-gate.service` 与
 *   `canonical-spec-v2-ir-compiler.service` 在 positionMode 推断时**必须**
 *   引用此常量，避免两处 hardcoded 漂移（审查问题 Major #2）。
 *   新增网格 programKind 时只需扩此常量 + SemanticOrchestrationProgramKind union。
 *   event_listener 不算 grid（无持仓语义，不参与 long_short 推断）。
 */
export const GRID_PROGRAM_KINDS: ReadonlySet<SemanticOrchestrationProgramKind> = new Set([
  'fixed_grid_gated',
  'dynamic_grid',
  'adaptive_volatility_grid',
])

// 全局保留 'close'（fixed_grid_gated / dynamic_grid / adaptive_volatility_grid 仍合法）；
// event_listener 路径 readiness fail-closed 拒收 'close'（无持仓语义）
export type SemanticOrchestrationProgramOnDeactivate = 'cancel' | 'keep' | 'close'

// Phase 5 S12 (#1118): event_listener 仅在 ctx 显式 bump schemaVersion 时清空 dedupBuffer
export type SemanticOrchestrationProgramRebuildPolicy =
  | 'static'
  | 'anchor_on_state_change'
  | 'atr_window'
  | 'on_schema_version_bump'

// Phase 5 S12 (#1118): event_listener 过期事件处理策略
//   'drop'     — 静默丢弃过期事件
//   'escalate' — 跳过过期事件 + 在 lifecycle state 累计 escalateCount（告警链路 follow-up）
export type SemanticOrchestrationProgramExpirationPolicy = 'drop' | 'escalate'

// Phase 5 S12 (#1118): event_listener 幂等键
//   fieldPath：仅允许 0-1 层 `.`，多层下钻 readiness fail-closed
//   严格 regex `^[a-zA-Z][a-zA-Z0-9_]{0,63}(\.[a-zA-Z][a-zA-Z0-9_]{0,63})?$`
export interface SemanticOrchestrationProgramIdempotencyKey {
  fieldPath: string
}

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
  // event_listener 节点专属（其它 programKind 不读）— Phase 5 S12 (#1118)
  //   eventSchemaRef     — webhook_event；其他 schema 在 readiness fail-closed
  //   sourceRef          — cross-node 引用 scope.dataSource role='event' 节点 id
  //   permissionScope    — `(tradingview|discord|telegram|webhook):.*` 等命名空间占位（runtime 不读，readiness 守门）
  //   idempotencyKey     — 幂等键 fieldPath（仅 0-1 层 `.`）
  //   dedupWindowMs      — 去重窗口 [100, 3600000]
  //   expirationTtlMs    — 过期 TTL [100, 86400000]，且严格 > dedupWindowMs
  //   expirationPolicy   — 'drop' / 'escalate'
  eventSchemaRef?: SemanticOrchestrationDataSourceSchema
  sourceRef?: string
  permissionScope?: string
  idempotencyKey?: SemanticOrchestrationProgramIdempotencyKey
  dedupWindowMs?: number
  expirationTtlMs?: number
  expirationPolicy?: SemanticOrchestrationProgramExpirationPolicy
  // portfolioRisk 节点专属（其它 kind 不读）
  mode?: SemanticOrchestrationPortfolioRiskMode
  thresholdPct?: number
  scope?: SemanticOrchestrationPortfolioRiskScope
  // Phase 5 S8 (#1119): portfolioRisk symbol/subStrategy exposure cap 节点专属字段
  //   - notionalCapPct (0,100] 单标的/单子策略名义敞口上限百分比
  //   - effectWhenTriggered 三 effect（scope 限定见 SemanticOrchestrationPortfolioRiskEffect）
  //   - boundSymbolScopeRef    portfolioRisk.symbol_exposure_cap 节点必填，引用同 state 中 status:'locked' scope.symbol id
  //   - boundSubStrategyScopeRef portfolioRisk.substrategy_exposure_cap 节点必填，引用同 state 中 status:'locked' scope.subStrategy id
  //   注：semantic 层用 boundSymbol/SubStrategyScopeRef（语义"portfolioRisk 节点绑哪个 scope"），
  //   与 trigger/action 现有 symbolScopeRef/subStrategyScopeRef（语义"owner 归属哪个 scope"）字段名解耦避免歧义；
  //   canonical/IR 层 normalize 为 symbolScopeRef/subStrategyScopeRef（与既有命名对齐）。
  notionalCapPct?: number
  effectWhenTriggered?: SemanticOrchestrationPortfolioRiskEffect
  boundSymbolScopeRef?: string
  boundSubStrategyScopeRef?: string
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

type SemanticAtomStateByBucket<B extends AtomContractBucket> =
    B extends 'trigger' ? SemanticTriggerState
  : B extends 'action' ? SemanticActionState
  : B extends 'risk' ? SemanticRiskState
  : B extends 'orchestration' ? SemanticOrchestrationNode
  : B extends 'positionConstraint' ? SemanticPositionConstraintState
  : never

// mapped type 派生 — 关键：用 `[B in AtomContractBucket]` 而非 Record<B, T>，
// 后者会丢失 per-key 判别（Record 的 value 类型对 union key 是 distributed=false → 退化为 union）。
export type SemanticStateBuckets = {
  [B in AtomContractBucket]: SemanticAtomStateByBucket<B>[]
}

export interface SemanticState extends SemanticStateBuckets {
  version: 1
  families: string[]
  contextSlots: SemanticContextSlotState
  position: SemanticPositionState | null
  orchestrationContracts: readonly SemanticOrchestrationContract[]
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
  unsupportedFallback?: UnsupportedFallbackState | null
  /**
   * Issue #1395 — 表达式树主体；扁平桶（trigger/action/risk/positionConstraint/orchestration）
   * 由 projectRulesToFlat(rules) 派生，下游既有 reader 零迁移。
   *
   * 单 atom case = 单叶子 Rule（rule.condition.kind === 'atom'），零特殊代码。
   * AND/OR/NOT/SEQUENCE 组合见 ./atom-expr.ts。
   */
  rules?: readonly import('./atom-expr').SemanticRule[]
  /**
   * 由 PerTradeSizingResolver 派生投影阶段标记。
   * true 表示存在多个 executionAnchored anchor，下游 canonical-spec / signal-executor
   * 不可假设单仓 sizing，需走 multi-leg 处理路径（follow-up issue 跟进）。
   *
   * @internal 不进入 conversation response / persist / Redux 状态
   */
  readonly isMultiLeg?: boolean
  /**
   * Issue #1395 (mute-spider): planner rules[] zod 校验诊断信息。
   * fail-open 后保留被剪枝/拒收的 rule 索引与原始片段，用于上游观测；
   * 字段为可选 additive，下游 reader 默认忽略。
   */
  readonly diagnostics?: {
    readonly zodQuarantine?: ReadonlyArray<{
      readonly index: number
      readonly errorPath: string
      readonly rawSnippet: string
    }>
  }
}
