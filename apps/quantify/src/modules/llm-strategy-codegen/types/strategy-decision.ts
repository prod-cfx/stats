export type StrategyDecisionKind = 'DIRECT_COMPILE' | 'CONFIRM_INFERRED' | 'ASK_CLARIFY'

export interface StrategyBlockingReason {
  key: string
  reason: string
  priority: number
  question: string
}

export interface StrategyInferredAssumption {
  key: string
  value: string
  source: 'system_default'
}

export type StrategyDecision =
  | {
      kind: 'DIRECT_COMPILE'
      normalizedSummary: string
      blockingReasons: []
      inferredAssumptions: []
      nextActionPayload: { mode: 'compile' }
    }
  | {
      kind: 'CONFIRM_INFERRED'
      normalizedSummary: string
      blockingReasons: []
      inferredAssumptions: StrategyInferredAssumption[]
      nextActionPayload: { mode: 'confirm_inferred' }
    }
  | {
      kind: 'ASK_CLARIFY'
      normalizedSummary: string
      blockingReasons: StrategyBlockingReason[]
      inferredAssumptions: StrategyInferredAssumption[]
      nextActionPayload: { mode: 'ask_clarify', question: StrategyBlockingReason }
    }
