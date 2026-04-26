import type {
  SemanticActionState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from './semantic-state'

export type SemanticEditNodeKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'

export type SemanticEditContextField = 'symbol' | 'timeframe' | 'exchange' | 'marketType'

export type SemanticEditOperation =
  | { op: 'cancel_pending_edit' }
  | { op: 'replace_context', field: SemanticEditContextField, value: string }
  | { op: 'replace_position', targetRef?: string, text?: string }
  | { op: 'replace_trigger', targetRef?: string, text?: string }
  | { op: 'add_trigger', text: string }
  | { op: 'remove_trigger', targetRef?: string }
  | { op: 'replace_action', targetRef?: string, text?: string }
  | { op: 'add_action', text: string }
  | { op: 'remove_action', targetRef?: string }
  | { op: 'replace_risk', targetRef?: string, text?: string }
  | { op: 'add_risk', text: string }
  | { op: 'remove_risk', targetRef?: string }

export interface SemanticEditPatch {
  operations: SemanticEditOperation[]
}

export type PendingSemanticEditCandidate =
  | SemanticTriggerState
  | SemanticActionState
  | SemanticRiskState
  | SemanticPositionState

interface BasePendingSemanticEdit {
  id: string
  targetRef?: string
  status: 'needs_clarification' | 'ready_to_apply'
  createdFromMessage: string
}

export type PendingSemanticEdit =
  | (BasePendingSemanticEdit & { op: 'replace_trigger', candidate: SemanticTriggerState })
  | (BasePendingSemanticEdit & { op: 'replace_action', candidate: SemanticActionState })
  | (BasePendingSemanticEdit & { op: 'replace_risk', candidate: SemanticRiskState })
  | (BasePendingSemanticEdit & { op: 'replace_position', candidate: SemanticPositionState })

export type SemanticEditDecision =
  | { kind: 'NO_EDIT' }
  | { kind: 'APPLY_TO_SEMANTIC_STATE', patch: SemanticEditPatch }
  | { kind: 'ASK_EDIT_CLARIFICATION', question: string, pendingEdit: PendingSemanticEdit }
  | { kind: 'REGENERATE_SCRIPT_VERSION', patch: SemanticEditPatch }
  | { kind: 'REPLACE_STRATEGY_DRAFT', seedText: string }
  | { kind: 'REJECT_WHILE_PROCESSING', message: string }

export interface SemanticStateWithPendingEdit extends SemanticState {
  pendingEdit?: PendingSemanticEdit | null
  previousVersions?: Array<{
    reason: 'strategy_replacement'
    replacedAt: string
    semanticState: SemanticState
  }>
}

export function readPendingSemanticEdit(state: SemanticState | null | undefined): PendingSemanticEdit | null {
  const value = (state as SemanticStateWithPendingEdit | null | undefined)?.pendingEdit
  return value && typeof value === 'object' ? value : null
}

export function withPendingSemanticEdit(
  state: SemanticState,
  pendingEdit: PendingSemanticEdit | null,
): SemanticStateWithPendingEdit {
  return {
    ...(state as SemanticStateWithPendingEdit),
    pendingEdit,
    updatedAt: new Date().toISOString(),
  }
}

export function buildReplacementSemanticState(input: {
  previous: SemanticState
  next: SemanticState
}): SemanticStateWithPendingEdit {
  const replacedAt = new Date().toISOString()
  const previousVersions = (input.previous as SemanticStateWithPendingEdit).previousVersions ?? []

  return {
    ...(input.next as SemanticStateWithPendingEdit),
    pendingEdit: null,
    previousVersions: [
      ...previousVersions,
      {
        reason: 'strategy_replacement',
        replacedAt,
        semanticState: input.previous,
      },
    ],
    updatedAt: replacedAt,
  }
}
