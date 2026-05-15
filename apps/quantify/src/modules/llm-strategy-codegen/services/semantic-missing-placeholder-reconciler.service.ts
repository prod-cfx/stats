import { Injectable } from '@nestjs/common'

import type { SemanticState } from '../types/semantic-state'
import { SemanticExecutableSemanticsService } from './semantic-executable-semantics.service'

const MISSING_ENTRY_TRIGGER_KEY = 'semantic.missing_entry_atom'
const MISSING_EXIT_TRIGGER_KEY = 'semantic.missing_exit_atom'

/**
 * Issue #1383 Lane A：placeholder 出清判定改为读 SemanticExecutableSemanticsService —
 * 入场/出场语义是否已存在不再依赖"是否真的有一个非 placeholder trigger"，
 * 而是统一查 registry-driven 的 hasExecutableEntry/ExitSemantics。
 *
 * 这样，当 order_program contract / DCA schedule / forced-exit 风险 atom 等
 * 非 trigger 形态的语义满足后，对应 placeholder 也会被回收，不再残留误导用户问询。
 */
@Injectable()
export class SemanticMissingPlaceholderReconcilerService {
  constructor(
    private readonly executableSemantics: SemanticExecutableSemanticsService,
  ) {}

  reconcile(state: SemanticState): SemanticState {
    const hasEntry = this.executableSemantics.hasExecutableEntrySemantics(state)
    const hasExit = this.executableSemantics.hasExecutableExitSemantics(state)
    if (!hasEntry && !hasExit) {
      return state
    }

    const triggers = state.trigger.filter((trigger) => {
      if (trigger.status !== 'open') return true
      if (trigger.key === MISSING_ENTRY_TRIGGER_KEY) return !hasEntry
      if (trigger.key === MISSING_EXIT_TRIGGER_KEY) return !hasExit
      return true
    })

    return triggers.length === state.trigger.length ? state : { ...state, trigger: triggers }
  }
}
