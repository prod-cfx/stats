export type SemanticEventPhase = 'entry' | 'exit'
export type SemanticEventSideScope = 'long' | 'short' | 'both'
export type SemanticEventTriggerKind = 'indicator_cross'
export type SemanticEventActionKind = 'open_long' | 'close_long' | 'open_short' | 'close_short'

export interface SemanticIndicatorCrossTrigger {
  kind: 'indicator_cross'
  indicator: 'ma' | 'ema' | 'macd' | 'moving_average'
  direction: 'over' | 'under'
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
  semantic: 'cross_up' | 'cross_down'
}

export type SemanticEventTrigger = SemanticIndicatorCrossTrigger

export interface SemanticEventAction {
  kind: SemanticEventActionKind
}

export interface SemanticEventFrame {
  id: string
  trigger: SemanticEventTrigger
  action: SemanticEventAction
  sideScope: SemanticEventSideScope
  phase: SemanticEventPhase
  evidenceText: string
  inheritedFrom?: string
}
