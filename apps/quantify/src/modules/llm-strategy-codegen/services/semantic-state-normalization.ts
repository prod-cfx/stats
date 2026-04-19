import type { SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type {
  NormalizedTriggerAtom,
  StrategyNormalizedIntent,
} from '../types/strategy-normalized-intent'

export function buildNormalizedIntentFromSemanticState(state: SemanticState): StrategyNormalizedIntent {
  const families = new Set(state.families)
  if (state.triggers.some(trigger => trigger.phase === 'gate')) {
    families.add('state-gated')
  }
  const grid = buildGridIntent(state.triggers)

  return {
    families: Array.from(families) as StrategyNormalizedIntent['families'],
    triggers: state.triggers
      .filter(trigger => trigger.status !== 'superseded')
      .map(trigger => toNormalizedTrigger(trigger)),
    actions: state.actions.map(action => ({
      key: action.key,
      ...(action.params ? { params: { ...action.params } } : {}),
    })),
    risk: state.risk.map(risk => ({
      key: risk.key,
      params: { ...risk.params },
    })),
    position: state.position
      ? {
          mode: state.position.mode as StrategyNormalizedIntent['position']['mode'],
          value: state.position.value,
          positionMode: state.position.positionMode as StrategyNormalizedIntent['position']['positionMode'],
        }
      : null,
    ...(grid ? { grid } : {}),
    unresolved: [],
    normalizationNotes: [...state.normalizationNotes],
  }
}

function buildGridIntent(
  triggers: SemanticTriggerState[],
): StrategyNormalizedIntent['grid'] {
  const activeGrid = triggers.find(trigger =>
    trigger.key === 'grid.range_rebalance'
    && trigger.status !== 'superseded'
    && typeof trigger.params.rangeLower === 'number'
    && typeof trigger.params.rangeUpper === 'number'
    && typeof trigger.params.stepPct === 'number',
  )
  if (!activeGrid) {
    return null
  }

  return {
    family: 'grid.range_rebalance',
    range: {
      lower: activeGrid.params.rangeLower as number,
      upper: activeGrid.params.rangeUpper as number,
    },
    stepPct: activeGrid.params.stepPct as number,
    sideMode: (activeGrid.params.sideMode as StrategyNormalizedIntent['grid']['sideMode']) ?? 'bidirectional',
    recycle: activeGrid.params.recycle !== false,
    ...(activeGrid.params.breakoutAction === 'pause' || activeGrid.params.breakoutAction === 'continue'
      ? { breakoutAction: activeGrid.params.breakoutAction }
      : {}),
  }
}

function toNormalizedTrigger(trigger: SemanticTriggerState): NormalizedTriggerAtom {
  const confirmationMode = typeof trigger.params.confirmationMode === 'string'
    ? trigger.params.confirmationMode
    : null
  const unresolvedSlots = trigger.openSlots.map(slot => toUnresolvedSlot(slot))

  return {
    key: trigger.key as NormalizedTriggerAtom['key'],
    phase: trigger.phase,
    ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
    params: { ...trigger.params } as NormalizedTriggerAtom['params'],
    ...(confirmationMode === 'touch'
      || confirmationMode === 'close_confirm'
      || confirmationMode === 'ambiguous_touch_or_close_confirm'
      ? { resolutionHints: { confirmation: confirmationMode } }
      : {}),
    closureStatus: trigger.status === 'locked' && unresolvedSlots.length === 0 ? 'closed' : 'open',
    unresolvedSlots,
    ...(trigger.evidence?.text ? { evidenceText: trigger.evidence.text } : {}),
  }
}

function toUnresolvedSlot(slot: SemanticSlotState): NormalizedTriggerAtom['unresolvedSlots'][number] {
  return {
    slotKey: slot.slotKey,
    fieldPath: slot.fieldPath,
    reason: 'missing_definition',
    questionHint: slot.questionHint,
    priority: slot.priority,
    affectsExecution: slot.affectsExecution,
    ...(slot.evidence?.text ? { evidenceText: slot.evidence.text } : {}),
  }
}
