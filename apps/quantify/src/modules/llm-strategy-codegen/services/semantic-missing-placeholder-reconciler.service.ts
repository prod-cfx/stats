import { Injectable } from '@nestjs/common'

import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'

const MISSING_ENTRY_TRIGGER_KEY = 'semantic.missing_entry_atom'
const MISSING_EXIT_TRIGGER_KEY = 'semantic.missing_exit_atom'
const MISSING_TRIGGER_KEYS = new Set([MISSING_ENTRY_TRIGGER_KEY, MISSING_EXIT_TRIGGER_KEY])

@Injectable()
export class SemanticMissingPlaceholderReconcilerService {
  reconcile(state: SemanticState): SemanticState {
    const hasRealCompleteEntryTrigger = this.hasRealCompleteTrigger(state, 'entry')
    const hasRealCompleteExitTrigger = this.hasRealCompleteTrigger(state, 'exit')
    if (!hasRealCompleteEntryTrigger && !hasRealCompleteExitTrigger) {
      return state
    }

    const triggers = state.triggers.filter((trigger) => {
      if (trigger.status !== 'open') return true
      if (trigger.key === MISSING_ENTRY_TRIGGER_KEY) return !hasRealCompleteEntryTrigger
      if (trigger.key === MISSING_EXIT_TRIGGER_KEY) return !hasRealCompleteExitTrigger
      return true
    })

    return triggers.length === state.triggers.length ? state : { ...state, triggers }
  }

  private hasRealCompleteTrigger(
    state: SemanticState,
    phase: Extract<SemanticTriggerState['phase'], 'entry' | 'exit'>,
  ): boolean {
    return state.triggers.some(trigger =>
      trigger.phase === phase
      && !MISSING_TRIGGER_KEYS.has(trigger.key)
      && trigger.status !== 'superseded'
      && trigger.status !== 'open'
      && trigger.openSlots.every(slot => slot.status !== 'open'),
    )
  }
}
