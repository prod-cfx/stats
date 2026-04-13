export const STRATEGY_CLARIFICATION_REASONS = [
  'missing_entry_rules',
  'missing_exit_rules',
  'missing_stop_loss_rule',
  'missing_take_profit_rule',
  'missing_action_uniqueness',
  'missing_side_scope',
  'direction_ambiguous',
  'ambiguous_risk_effect',
  'ambiguous_condition_basis',
  'missing_exchange',
  'missing_symbol',
  'missing_timeframe',
  'missing_market_type',
  'missing_position_pct',
  'missing_position_mode',
  'conflicting_market_scope',
  'invalid_spot_short_combo',
] as const

export const STRATEGY_CLARIFICATION_ITEM_STATUSES = ['pending', 'answered'] as const
export const STRATEGY_CLARIFICATION_STATUSES = ['CLEAR', 'NEEDS_CLARIFICATION'] as const

type StrategyClarificationReasonLiteral = typeof STRATEGY_CLARIFICATION_REASONS[number]
export type StrategyClarificationItemStatus = typeof STRATEGY_CLARIFICATION_ITEM_STATUSES[number]
export type StrategyClarificationStatus = typeof STRATEGY_CLARIFICATION_STATUSES[number]
export type StrategyClarificationReason = StrategyClarificationReasonLiteral | (string & {})
export const STRATEGY_CLARIFICATION_FIELDS = [
  'entryRules',
  'exitRules',
  'exchange',
  'symbol',
  'timeframe',
  'marketType',
  'positionMode',
  'riskRules.positionPct',
  'riskRules.stopLossPct',
  'riskRules.takeProfitPct',
  'entryRules.basis',
  'exitRules.basis',
  'riskRules.stopLossBasis',
  'riskRules.takeProfitBasis',
  'riskRules.maxDrawdownBasis',
  'riskRules.earlyStop.action',
] as const
type StrategyClarificationFieldLiteral = typeof STRATEGY_CLARIFICATION_FIELDS[number]
export type StrategyClarificationField = StrategyClarificationFieldLiteral | (string & {})

export interface StrategyClarificationItem {
  key: string
  reason: StrategyClarificationReason
  field: StrategyClarificationField
  allowedAnswers?: string[]
  blocking: true
  ruleId?: string
  question: string
  status: StrategyClarificationItemStatus
  answer?: string
}

export interface StrategyClarificationState {
  status: StrategyClarificationStatus
  items: StrategyClarificationItem[]
}
