import { Injectable } from '@nestjs/common'
import type {
  StrategyBlockingReason,
  StrategyDecision,
  StrategyInferredAssumption,
} from '../types/strategy-decision'

@Injectable()
export class StrategyCompileabilityDecisionService {
  decide(input: {
    normalizedSummary: string
    blockingReasons: StrategyBlockingReason[]
    inferredAssumptions: StrategyInferredAssumption[]
  }): StrategyDecision {
    const blockingReasons = [...input.blockingReasons].sort((a, b) => b.priority - a.priority)

    if (blockingReasons.length > 0) {
      return {
        kind: 'ASK_CLARIFY',
        normalizedSummary: input.normalizedSummary,
        blockingReasons,
        inferredAssumptions: input.inferredAssumptions,
        nextActionPayload: {
          mode: 'ask_clarify',
          question: blockingReasons[0],
        },
      }
    }

    if (input.inferredAssumptions.length > 0) {
      return {
        kind: 'CONFIRM_INFERRED',
        normalizedSummary: input.normalizedSummary,
        blockingReasons: [],
        inferredAssumptions: input.inferredAssumptions,
        nextActionPayload: { mode: 'confirm_inferred' },
      }
    }

    return {
      kind: 'DIRECT_COMPILE',
      normalizedSummary: input.normalizedSummary,
      blockingReasons: [],
      inferredAssumptions: [],
      nextActionPayload: { mode: 'compile' },
    }
  }
}
