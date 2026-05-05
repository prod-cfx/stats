import type { SemanticPriority } from './semantic-state'

export const NORMALIZED_INTENT_FAMILIES = [
  'single-leg',
  'grid.range_rebalance',
  'state-gated',
] as const

export type NormalizedIntentFamily = (typeof NORMALIZED_INTENT_FAMILIES)[number]

export const NORMALIZED_TRIGGER_ATOM_KEYS = [
  'execution.on_start',
  'price.percent_change',
  'price.range_position_lte',
  'price.range_position_gte',
  'price.breakout_up',
  'price.breakout_down',
  'price.detect.indicator_boundary',
  'indicator.cross_over',
  'indicator.cross_under',
  'indicator.above',
  'indicator.below',
  'bollinger.touch_upper',
  'bollinger.touch_lower',
  'bollinger.touch_middle',
  'oscillator.rsi_gte',
  'oscillator.rsi_lte',
  'trend.direction',
  'market.regime',
  'volatility.state',
  'grid.range_rebalance',
] as const

export type NormalizedTriggerAtomKey = (typeof NORMALIZED_TRIGGER_ATOM_KEYS)[number]
export const NORMALIZED_TRIGGER_CONFIRMATION_HINTS = [
  'touch',
  'close_confirm',
  'ambiguous_touch_or_close_confirm',
] as const

export type NormalizedTriggerConfirmationHint = (typeof NORMALIZED_TRIGGER_CONFIRMATION_HINTS)[number]

export type NormalizedAtomPhase = 'entry' | 'exit' | 'risk' | 'gate'
export type NormalizedAtomSideScope = 'long' | 'short' | 'both'
export type NormalizedPositionMode = 'long_only' | 'short_only' | 'long_short'
export type NormalizedSizingMode = 'fixed_ratio' | 'fixed_quote' | 'fixed_qty'
export type NormalizedGridSideMode = 'long_only' | 'short_only' | 'bidirectional'
export type NormalizedClosureStatus = 'closed' | 'open'

export interface UnresolvedSlot {
  slotKey: string
  fieldPath: string
  reason: 'missing_required_param' | 'missing_definition' | 'missing_relation' | 'missing_scope'
  questionHint: string
  priority: SemanticPriority
  affectsExecution: boolean
  evidenceText?: string
}

export interface NormalizedTriggerResolutionHints {
  confirmation?: NormalizedTriggerConfirmationHint
}

interface RecognizedSemanticMetadata {
  closureStatus: NormalizedClosureStatus
  unresolvedSlots: UnresolvedSlot[]
  evidenceText?: string
}

export interface NormalizedTriggerAtom extends RecognizedSemanticMetadata {
  key: NormalizedTriggerAtomKey
  phase: NormalizedAtomPhase
  sideScope?: NormalizedAtomSideScope
  params: Record<string, string | number | boolean>
  resolutionHints?: NormalizedTriggerResolutionHints
}

export interface NormalizedActionAtom {
  key: string
  params?: Record<string, unknown>
}

export interface NormalizedRiskAtom {
  key: string
  params: Record<string, unknown>
}

export interface NormalizedPositionIntent {
  mode: NormalizedSizingMode
  value: number
  positionMode: NormalizedPositionMode
}

export interface NormalizedGridIntent {
  family: 'grid.range_rebalance'
  range: {
    lower: number
    upper: number
  }
  stepPct: number
  sideMode: NormalizedGridSideMode
  recycle: boolean
  breakoutAction?: 'pause' | 'continue'
}

export interface ObservationOnlyStateHint extends RecognizedSemanticMetadata {
  type: 'trend' | 'regime' | 'volatility'
  value: string
  mode: 'observation_only'
}

export interface StrategyNormalizedIntent {
  families: NormalizedIntentFamily[]
  triggers: NormalizedTriggerAtom[]
  actions: NormalizedActionAtom[]
  risk: NormalizedRiskAtom[]
  position: NormalizedPositionIntent
  grid?: NormalizedGridIntent | null
  stateHints?: ObservationOnlyStateHint[]
  unresolved: string[]
  normalizationNotes: string[]
}
