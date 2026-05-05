import type { CodegenSemanticPatch } from './codegen-semantic-patch'
import type { SemanticContractKind, SemanticPriority, SemanticSlotState } from './semantic-state'

export type SemanticAtomSupportStatus =
  | 'supported_executable'
  | 'supported_requires_slot'
  | 'recognized_unsupported'
  | 'unsupported_unknown'

export type SemanticAtomCategory = SemanticContractKind | 'unknown'

export interface SemanticAtomUnsupportedMetadata {
  displayName: string
  reasonCode: string
  publicReason: string
}

export interface SemanticAtomReplacementStrategy {
  strategyKey: string
  description: string
  patch: CodegenSemanticPatch
}

export interface SemanticAtomOpenSlotSpec {
  slotKey: string
  fieldPath: string
  priority: SemanticPriority
  questionHint: string
}

export interface SemanticAtomDefinition {
  key: string
  category: SemanticAtomCategory
  supportStatus: SemanticAtomSupportStatus
  requiredParams: string[]
  defaultableParams: string[]
  executableProjection: string[]
  openSlots: SemanticAtomOpenSlotSpec[]
  unsupported?: SemanticAtomUnsupportedMetadata
  replacement?: SemanticAtomReplacementStrategy
}

export interface SemanticAtomSupportMetadata {
  supportStatus: SemanticAtomSupportStatus
  unsupportedReasonCode?: string
  unsupportedDisplayName?: string
  replacementStrategyKey?: string
}

export interface UnsupportedFallbackState {
  status: 'pending'
  unsupportedAtoms: Array<{
    key: string
    displayName: string
    reasonCode: string
    publicReason: string
  }>
  recommendedStrategy: {
    strategyKey: string
    description: string
    patch: CodegenSemanticPatch
  }
  prompt: string
}

export type UnsupportedFallbackIntent =
  | { kind: 'accept_fallback' }
  | { kind: 'reject_fallback' }
  | { kind: 'modify_fallback'; message: string }
  | { kind: 'unclear' }

export function toSemanticSupportOpenSlot(
  spec: SemanticAtomOpenSlotSpec,
): SemanticSlotState {
  return {
    slotKey: spec.slotKey,
    fieldPath: spec.fieldPath,
    status: 'open',
    priority: spec.priority,
    questionHint: spec.questionHint,
    affectsExecution: true,
  }
}
