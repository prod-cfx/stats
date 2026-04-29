import type { SemanticRiskState, SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type {
  NormalizedTriggerAtom,
  StrategyNormalizedIntent,
} from '../types/strategy-normalized-intent'

/**
 * Legacy adapter: projects SemanticState into StrategyNormalizedIntent for compatibility paths.
 * New semantic mainline code should build canonical specs from SemanticState contracts directly.
 */
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

const RISK_BASIS_OPEN_SLOT_PATTERN = /(?:^|\.)(?:basis|stopLossBasis|takeProfitBasis)$/u
const RISK_BASIS_SLOT_KEYS = new Set([
  'risk.stopLossBasis',
  'risk.takeProfitBasis',
  'risk.stop_loss_pct.basis',
  'risk.take_profit_pct.basis',
])

export function normalizeRiskSemantics(risks: SemanticRiskState[]): SemanticRiskState[] {
  return risks.map((risk, index) => normalizeRiskSemantic(risk, index))
}

export function normalizeRiskSemantic(risk: SemanticRiskState, index = 0): SemanticRiskState {
  const params = { ...risk.params }
  const isStopLoss = risk.key === 'risk.stop_loss_pct'
  const isTakeProfit = risk.key === 'risk.take_profit_pct'

  if (!isStopLoss && !isTakeProfit) {
    if (risk.key === 'risk.condition_expression') {
      return {
        ...risk,
        params: {
          capabilityStatus: 'recognized_unsupported',
          ...params,
        },
        openSlots: risk.openSlots.filter(slot => !isRiskBasisOpenSlot(slot.slotKey, slot.fieldPath)),
      }
    }

    return {
      ...risk,
      params,
      openSlots: [...risk.openSlots],
    }
  }

  if (typeof params.direction !== 'string') {
    params.direction = isStopLoss ? 'loss' : 'profit'
  }

  if (typeof params.basis !== 'string') {
    params.basis = 'entry_avg_price'
  }

  if (params.basis === 'position_pnl' && params.basisSource == null) {
    params.basisSource = 'user_explicit'
  }

  if (params.basis === 'entry_avg_price' && params.basisSource == null) {
    params.basisSource = 'system_default'
  }

  if (typeof params.effect !== 'string') {
    params.effect = 'close_position'
  }

  if (typeof params.scope !== 'string') {
    params.scope = 'current_position'
  }

  const openSlots = risk.openSlots.filter(slot => !isRiskBasisOpenSlot(slot.slotKey, slot.fieldPath))
  const status = typeof params.valuePct === 'number' && Number.isFinite(params.valuePct) && params.valuePct > 0 && openSlots.length === 0
    ? 'locked'
    : risk.status

  return {
    ...risk,
    id: risk.id || `normalized-risk-${index + 1}`,
    params,
    status,
    openSlots,
  }
}

function isRiskBasisOpenSlot(slotKey: string, fieldPath: string): boolean {
  return RISK_BASIS_SLOT_KEYS.has(slotKey) || RISK_BASIS_OPEN_SLOT_PATTERN.test(fieldPath)
}
