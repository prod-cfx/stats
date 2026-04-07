export type StrategyClarificationKind = 'missing_parameter' | 'semantic_ambiguity'

export type StrategyClarificationStrategyType = 'price_change_pct' | 'grid' | 'bollinger' | 'custom'

export type StrategyClarificationStatus = 'pending' | 'resolved' | 'skipped'

export interface StrategyClarificationItem {
  id?: string
  kind?: StrategyClarificationKind | string
  strategyType?: StrategyClarificationStrategyType | string
  field?: string
  reason?: string
  question?: string
  priority?: number
  status?: StrategyClarificationStatus | string
  resolvedValue?: unknown
  [key: string]: unknown
}

export interface StrategyClarificationState {
  strategyType?: StrategyClarificationStrategyType | string
  items?: StrategyClarificationItem[]
  lastAskedItemId?: string | null
  [key: string]: unknown
}
