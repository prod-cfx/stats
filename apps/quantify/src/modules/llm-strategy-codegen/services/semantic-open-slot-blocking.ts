import type { SemanticSlotState } from '../types/semantic-state'

export function isBlockingSemanticOpenSlot(slot: SemanticSlotState | null | undefined): slot is SemanticSlotState {
  return slot?.status === 'open' && slot.affectsExecution === true
}
