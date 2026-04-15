import type {
  NormalizedActionAtom,
  NormalizedClosureStatus,
  NormalizedGridIntent,
  NormalizedPositionIntent,
  NormalizedRiskAtom,
  NormalizedTriggerAtom,
  ObservationOnlyStateHint,
  StrategyNormalizedIntent,
  UnresolvedSlot,
} from './strategy-normalized-intent'

export type StrategyAmbiguityLane = 'signal' | 'behavior' | 'risk' | 'context'
export type AtomicIntentSemanticKind = 'trigger' | 'action' | 'risk' | 'position' | 'grid' | 'state_hint'

export interface ResolutionAwareSemantic {
  closureStatus?: NormalizedClosureStatus
  unresolvedSlots?: UnresolvedSlot[]
  evidenceText?: string
}

export interface ResolutionAwarePositionIntent extends NormalizedPositionIntent, ResolutionAwareSemantic {}
export interface ResolutionAwareGridIntent extends NormalizedGridIntent, ResolutionAwareSemantic {}
export interface ResolutionAwareActionAtom extends NormalizedActionAtom, ResolutionAwareSemantic {}
export interface ResolutionAwareRiskAtom extends NormalizedRiskAtom, ResolutionAwareSemantic {}

export interface ResolutionAwareNormalizedIntent
  extends Omit<StrategyNormalizedIntent, 'actions' | 'risk' | 'position' | 'grid' | 'stateHints'> {
  actions: ResolutionAwareActionAtom[]
  risk: ResolutionAwareRiskAtom[]
  position: ResolutionAwarePositionIntent
  grid?: ResolutionAwareGridIntent | null
  stateHints?: ObservationOnlyStateHint[]
}

export interface AtomicIntent {
  normalizedIntent: ResolutionAwareNormalizedIntent
}

export interface StrategyAmbiguity extends UnresolvedSlot {
  lane: StrategyAmbiguityLane
  semanticKind: AtomicIntentSemanticKind
  semanticKey: string
  phase?: NormalizedTriggerAtom['phase']
}

export interface AtomicIntentResolution {
  ambiguities: StrategyAmbiguity[]
  nextQuestion: StrategyAmbiguity | null
}
