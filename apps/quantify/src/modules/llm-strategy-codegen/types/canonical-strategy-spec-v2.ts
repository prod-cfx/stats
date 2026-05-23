import type { PartialTakeProfitProgramMetadata } from './partial-take-profit'
import type { PositionLifecycleActionMetadata } from './canonical-strategy-ir'
import type { StrategyNormalizedIntent } from './strategy-normalized-intent'
import type {
  SemanticExpressionOperand,
  SemanticExpressionOperator,
  SemanticOrchestrationDataSourceRole,
  SemanticOrchestrationDataSourceSchema,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationProgramExpirationPolicy,
} from './semantic-state'

export type { PartialTakeProfitProgramMetadata } from './partial-take-profit'

export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance' | 'gate'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'
export type CanonicalRiskRuleSideScope = Exclude<CanonicalRuleSideScope, 'flat'>

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  semanticScope?: 'market' | 'position' | 'portfolio'
  predicateForm?: 'legacy' | 'generic'
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
    | 'GT' | 'LT'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
  predicateForm?: 'legacy' | 'generic'
}

export interface CanonicalExpressionCondition {
  kind: 'expression'
  op: SemanticExpressionOperator
  left: SemanticExpressionOperand
  right: SemanticExpressionOperand
}

export type CanonicalConditionNode = CanonicalConditionAtom | CanonicalConditionGroup | CanonicalExpressionCondition

export type CanonicalRuleActionType =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'REDUCE_LONG'
  | 'REDUCE_SHORT'
  | 'ADD_LONG'
  | 'ADD_SHORT'
  | 'FORCE_EXIT'
  | 'BLOCK_NEW_ENTRY'

/**
 * #1230 — 需要 sizing evidence 的 actionable action type 单一来源。
 * 这些 action type 会真正开新仓位 / 加仓，必须显式提供 sizing 来源
 * （action.sizing > spec.sizing > fallback.positionPct）。
 * IR 编译期 assertSizingEvidence() 守门基于此集合判定。
 *
 * CLOSE_LONG / CLOSE_SHORT / REDUCE_LONG / REDUCE_SHORT / FORCE_EXIT /
 * BLOCK_NEW_ENTRY 不在此列，因为它们的数量由当前持仓决定，与下单 sizing 无关。
 */
export const ACTIONABLE_RULE_ACTION_TYPES: ReadonlySet<CanonicalRuleActionType> = new Set([
  'OPEN_LONG',
  'OPEN_SHORT',
  'ADD_LONG',
  'ADD_SHORT',
])

export interface CanonicalRuleAction {
  type: CanonicalRuleActionType
  sizing?: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
    asset?: string
  }
  params?: Record<string, number | string | boolean>
  readonly sourcePath?: string
  /**
   * Issue #1313 PR5b — 透传触发该 action 的语义 atom key（如 `action.open_long`）。
   * 仅在 builder 从 semantic action atom 派生 action 时挂载；启发式 / risk / fallback
   * 路径下不挂。IR-compiler.compileActions 重建 ActionDef 时不携带本字段，故 IR / 编译产物 / digest
   * 对启发式路径维持 byte-equal；本字段仅为 PR5c+ 在 IR 层反查 REGISTRY 调度提供输入。
   */
  readonly atomKey?: string
}

export interface CanonicalRuleNormalizedMetadata {
  source: 'normalized-intent'
  triggerKeys?: string[]
  gateKeys?: string[]
  actionKeys?: string[]
  family?: StrategyNormalizedIntent['families'][number]
}

export interface CanonicalStrategySpecNormalizedMetadata {
  source: 'normalized-intent'
  semanticViewSource: 'normalized-canonical-truth'
  intent: StrategyNormalizedIntent
}

export interface CanonicalRuleMetadata extends PositionLifecycleActionMetadata {
  [key: string]: unknown
  normalized?: CanonicalRuleNormalizedMetadata
  partialTakeProfit?: PartialTakeProfitProgramMetadata
  // Phase 5 S2 (#1104): 多 scope 策略中显式声明该 rule 归属哪个 scope.symbol id
  // 仅在 spec.orchestration.scopes.length >= 1 时由 builder 透传；单/0 scope 不输出
  symbolScopeRef?: string
  // Phase 5 S11 (#1112): 多 leg 策略中显式声明该 rule 归属哪个 scope.leg id
  // 与 symbolScopeRef 同形：依赖 LLM 直写 canonicalSpec.rules.metadata.legScopeRef
  legScopeRef?: string
  // Phase 5 S3 (#1109): 多周期策略中显式声明该 rule 归属哪个 scope.timeframe id
  // 仅在 spec.orchestration.scopes 含 timeframe scope 时由 builder 透传
  timeframeScopeRef?: string
  // Phase 5 S9 (#1110): 显式声明该 rule 归属哪个 scope.dataSource id
  dataSourceScopeRef?: string
  // Phase 5 S10 (#1111): 多 subStrategy 策略中该 rule 归属的 scope.subStrategy id
  subStrategyScopeRef?: string
}

export interface CanonicalRuleV2 {
  id: string
  phase: CanonicalRulePhase
  sideScope?: CanonicalRuleSideScope
  priority: number
  cooldownBars?: number
  condition: CanonicalConditionNode
  actions: CanonicalRuleAction[]
  metadata?: CanonicalRuleMetadata
}

export interface CanonicalOrchestrationGate {
  id: string
  // Phase 5 S10 (#1111): target 升级为 union（entry / strategy / subStrategy）
  target: SemanticOrchestrationGateTarget
  activeWhen: CanonicalConditionNode
  // Phase 5 S10 (#1111): effect 扩 'pause_substrategy' | 'switch_substrategy'
  effectWhenFalse: SemanticOrchestrationGateEffect
}

// Phase 5 S7 (#1057): drawdown_block portfolioRisk —— scope='portfolio'
export interface CanonicalPortfolioDrawdownRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

// Phase 5 S8 (#1119): symbol exposure cap portfolioRisk —— scope='symbol'
//   semantic 层 boundSymbolScopeRef 在 canonical 层 normalize 为 symbolScopeRef（与 trigger/action 对齐）
export interface CanonicalPortfolioSymbolExposureCapRisk {
  id: string
  scope: 'symbol'
  mode: 'observe' | 'enforce'
  notionalCapPct: number
  symbolScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'reduce_exposure'
}

// Phase 5 S8 (#1119): subStrategy exposure cap portfolioRisk —— scope='subStrategy'
export interface CanonicalPortfolioSubStrategyExposureCapRisk {
  id: string
  scope: 'subStrategy'
  mode: 'observe' | 'enforce'
  notionalCapPct: number
  subStrategyScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'pause_substrategy'
}

// Phase 5 S8 (#1119): union with discriminator `scope`
//   旧 IR/spec JSON 缺 scope 字段时 reader/runtime default 'portfolio'（byte-equal 兼容 — critic C2）
export type CanonicalOrchestrationPortfolioRisk =
  | CanonicalPortfolioDrawdownRisk
  | CanonicalPortfolioSymbolExposureCapRisk
  | CanonicalPortfolioSubStrategyExposureCapRisk

export interface CanonicalOrchestrationProgramGridParams {
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
}

export interface CanonicalOrchestrationProgramSizing {
  mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'
  value: number
}

// Phase 5 S5 (#984): dynamic_grid program param block
export interface CanonicalOrchestrationProgramDynamicGridParams {
  anchorLookbackBars: number
  anchorSide: 'high' | 'low' | 'mid'
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  levelCount: number
  step: { mode: 'pct' | 'absolute'; value: number }
}

// Phase 5 S6 (#984): adaptive_volatility_grid program param block
export interface CanonicalOrchestrationProgramAdaptiveGridParams {
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  atrDriftPct: number
  rebuildCooldownSec: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
}

export interface CanonicalFixedGridGatedProgram {
  id: string
  sourcePath?: string
  sourceAtomKey?: string
  programKind: 'fixed_grid_gated'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  gridParams: CanonicalOrchestrationProgramGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

export interface CanonicalDynamicGridProgram {
  id: string
  sourcePath?: string
  sourceAtomKey?: string
  programKind: 'dynamic_grid'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'anchor_on_state_change'
  dynamicGridParams: CanonicalOrchestrationProgramDynamicGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

export interface CanonicalAdaptiveVolatilityGridProgram {
  id: string
  sourcePath?: string
  sourceAtomKey?: string
  programKind: 'adaptive_volatility_grid'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'atr_window'
  adaptiveGridParams: CanonicalOrchestrationProgramAdaptiveGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

// Phase 5 S12 (#1118): event_listener canonical 形态
//   不发限价单 → 无 sizing（与其他 program 区别）
//   onDeactivate ∈ {'cancel','keep'}（readiness fail-closed 拒收 'close'）
export interface CanonicalEventListenerProgram {
  id: string
  sourcePath?: string
  sourceAtomKey?: string
  programKind: 'event_listener'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep'
  rebuildPolicy: 'static' | 'on_schema_version_bump'
  eventSchemaRef: SemanticOrchestrationDataSourceSchema
  sourceRef: string
  permissionScope: string
  idempotencyKey: { fieldPath: string }
  dedupWindowMs: number
  expirationTtlMs: number
  expirationPolicy: SemanticOrchestrationProgramExpirationPolicy
}

export type CanonicalOrchestrationProgram =
  | CanonicalFixedGridGatedProgram
  | CanonicalDynamicGridProgram
  | CanonicalAdaptiveVolatilityGridProgram
  | CanonicalEventListenerProgram

// Phase 5 S2 (#1104): scope.symbol substrate
export interface CanonicalSymbolScope {
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}

// Phase 5 S11 (#1112): scope.leg substrate
// #1186 PR2 (decision 3): adds `'fixed_base'` mode for base_qty axis (禁止静默归 fixed_quote)
export type CanonicalOrchestrationLegSizingMode = 'fixed_pct' | 'fixed_quote' | 'fixed_ratio' | 'fixed_base'

export interface CanonicalOrchestrationLegSizing {
  mode: CanonicalOrchestrationLegSizingMode
  value: number
  pairedLegId?: string
  // #1186 PR2 (decision 5): asset 标记 quote/base 计价区分；新增可选字段不破现有 grid 多腿 byte-equal
  asset?: string
}

export interface CanonicalOrchestrationLegScope {
  id: string
  scopeKind: 'leg'
  legId: string
  direction: 'long' | 'short'
  instrumentRef: string
  legSizing?: CanonicalOrchestrationLegSizing
  syncTriggerRequired?: boolean
}

// Phase 5 S3 (#1109): scope.timeframe substrate
export interface CanonicalOrchestrationTimeframeScope {
  id: string
  scopeKind: 'timeframe'
  primaryTimeframe: string
  requiredTimeframes: readonly string[]
  alignmentPolicy: 'strict' | 'tolerant'
}

// Phase 5 S9 (#1110): scope.dataSource substrate
export interface CanonicalOrchestrationDataSourceScope {
  id: string
  scopeKind: 'dataSource'
  role: SemanticOrchestrationDataSourceRole
  feedId: string
  schemaRef: SemanticOrchestrationDataSourceSchema
}

// Phase 5 S10 (#1111): scope.subStrategy substrate
export interface CanonicalSubStrategyScope {
  id: string
  scopeKind: 'subStrategy'
  subStrategyId: string
  subStrategyLabel?: string
  positionHandlingOnDeactivate: 'close' | 'keep'
  orderHandlingOnDeactivate: 'cancel' | 'keep'
}

// Phase 5 S10 (#1111): scope union — discriminator scopeKind
export type CanonicalOrchestrationScope =
  | CanonicalSymbolScope
  | CanonicalOrchestrationLegScope
  | CanonicalOrchestrationTimeframeScope
  | CanonicalOrchestrationDataSourceScope
  | CanonicalSubStrategyScope

export interface CanonicalStrategySpecV2 {
  version: 2
  market: {
    exchange: 'binance' | 'okx' | 'hyperliquid' | null
    symbol: string | null
    marketType: 'spot' | 'perp' | null
    defaultTimeframe?: string | null
    timeframe?: string | null
    timeframes?: string[]
  }
  indicators: Array<{
    kind: 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd' | 'custom'
    params: Record<string, number | string | boolean>
  }>
  sizing: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
    asset?: string
  } | null
  executionPolicy: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN'
  }
  dataRequirements: {
    requiredTimeframes: string[]
  }
  rules: CanonicalRuleV2[]
  orchestration?: {
    gates?: CanonicalOrchestrationGate[]
    portfolioRisks?: CanonicalOrchestrationPortfolioRisk[]
    programs?: CanonicalOrchestrationProgram[]
    // Phase 5 S2 (#1104)
    scopes?: CanonicalOrchestrationScope[]
    // Phase 5 S11 (#1112)
    legScopes?: CanonicalOrchestrationLegScope[]
  }
  metadata?: {
    normalized?: CanonicalStrategySpecNormalizedMetadata
    rulesMainflow?: {
      positionSourcePaths?: string[]
    }
  }
}
