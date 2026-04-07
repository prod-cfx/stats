export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
}

export type CanonicalConditionNode = CanonicalConditionAtom | CanonicalConditionGroup

export type CanonicalRuleActionType =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'FORCE_EXIT'
  | 'REDUCE_POSITION'
  | 'BLOCK_NEW_ENTRY'
  | 'ADJUST_POSITION'

export interface CanonicalRuleAction {
  type: CanonicalRuleActionType
  sizing?: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
  }
  params?: Record<string, number | string | boolean>
}

export interface CanonicalRuleV2 {
  id: string
  phase: CanonicalRulePhase
  sideScope?: CanonicalRuleSideScope
  priority: number
  condition: CanonicalConditionNode
  actions: CanonicalRuleAction[]
}

export interface CanonicalStrategySpecV2 {
  version: 2
  rules: CanonicalRuleV2[]
}
