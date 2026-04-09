export const STRATEGY_CLARIFICATION_REASONS = [
  'missing_action_uniqueness',
  'missing_side_scope',
  'direction_ambiguous',
  'ambiguous_risk_effect',
  'ambiguous_condition_basis',
  'missing_exchange',
  'missing_symbol',
  'missing_timeframe',
  'missing_market_type',
  'missing_position_mode',
  'conflicting_market_scope',
  'invalid_spot_short_combo',
] as const

export const STRATEGY_CLARIFICATION_ITEM_STATUSES = ['pending', 'answered'] as const
export const STRATEGY_CLARIFICATION_STATUSES = ['CLEAR', 'NEEDS_CLARIFICATION'] as const

export type StrategyClarificationReason = typeof STRATEGY_CLARIFICATION_REASONS[number]
export type StrategyClarificationItemStatus = typeof STRATEGY_CLARIFICATION_ITEM_STATUSES[number]
export type StrategyClarificationStatus = typeof STRATEGY_CLARIFICATION_STATUSES[number]
export type StrategyClarificationField
  = 'exchange'
    | 'symbol'
    | 'timeframe'
    | 'marketType'
    | 'positionMode'
    | 'riskRules.earlyStop.action'

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
