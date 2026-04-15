import type {
  NormalizedPositionIntent,
  NormalizedRiskAtom,
  NormalizedTriggerAtom,
} from './strategy-normalized-intent'

export interface StrategyAmbiguity {
  kind: 'execution_context_missing' | 'execution_context_conflict' | 'atomic_semantic_fork' | 'open_semantic_slot' | 'semantic_conflict'
  field: string
  message: string
  choices?: string[]
  question?: string
  priority?: number
  slotId?: string
  slotKey?: string
  fieldPath?: string
}

export interface AtomicIntentTrigger {
  kind: 'grid_touch' | 'bollinger_band_trigger' | 'normalized_trigger'
  phase?: NormalizedTriggerAtom['phase']
  triggerKey?: NormalizedTriggerAtom['key']
  params?: Record<string, unknown>
}

export interface AtomicIntentAction {
  kind: string
  params?: Record<string, unknown>
}

export interface AtomicIntentSizing {
  kind: 'position_sizing'
  mode: NormalizedPositionIntent['mode']
  value: number
  positionMode: NormalizedPositionIntent['positionMode']
}

export interface AtomicIntentRisk {
  kind: NormalizedRiskAtom['key']
  params: NormalizedRiskAtom['params']
}

export interface AtomicIntentRelation {
  kind: string
  params?: Record<string, unknown>
}

export interface AtomicIntent {
  triggers: AtomicIntentTrigger[]
  actions: AtomicIntentAction[]
  sizing: AtomicIntentSizing | null
  risk: AtomicIntentRisk[]
  relations: AtomicIntentRelation[]
}

export interface AtomicIntentResolution {
  atomicIntent: AtomicIntent
  ambiguities: StrategyAmbiguity[]
}
