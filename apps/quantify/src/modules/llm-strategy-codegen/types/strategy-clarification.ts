export const STRATEGY_CLARIFICATION_REASONS = [
  'missing_action_uniqueness',
  'direction_ambiguous',
  'ambiguous_risk_effect',
  'ambiguous_condition_basis',
] as const

export const STRATEGY_CLARIFICATION_ITEM_STATUSES = ['pending', 'answered'] as const
export const STRATEGY_CLARIFICATION_STATUSES = ['CLEAR', 'NEEDS_CLARIFICATION'] as const

export type StrategyClarificationReason = typeof STRATEGY_CLARIFICATION_REASONS[number]
export type StrategyClarificationItemStatus = typeof STRATEGY_CLARIFICATION_ITEM_STATUSES[number]
export type StrategyClarificationStatus = typeof STRATEGY_CLARIFICATION_STATUSES[number]

export interface StrategyClarificationItem {
  key: string
  reason: StrategyClarificationReason
  ruleId?: string
  question: string
  status: StrategyClarificationItemStatus
  answer?: string
}

export interface StrategyClarificationState {
  status: StrategyClarificationStatus
  items: StrategyClarificationItem[]
}
