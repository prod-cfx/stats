import type { SemanticAtomSupportMetadata, UnsupportedFallbackState } from './semantic-atom-support'

export type SemanticNodeStatus = 'open' | 'locked' | 'superseded'
export type SemanticSource = 'user_explicit' | 'inferred' | 'derived'
export type SemanticPriority = 'core' | 'behavior' | 'risk' | 'context'
export type SemanticExpressionOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'CROSS_OVER' | 'CROSS_UNDER'
export type SemanticExpression = SemanticPredicateExpression | SemanticLogicalExpression
export type SemanticContractKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'
export type SemanticCapabilityDomain = 'market' | 'price' | 'order_program' | 'capital' | 'exposure' | 'margin' | 'guard'

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
  support?: SemanticAtomSupportMetadata
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
  unsupportedFallback?: UnsupportedFallbackState | null
}
