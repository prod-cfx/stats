import { Injectable } from '@nestjs/common'
import type { CanonicalCompileabilityReport } from './codegen-conversation-start-session.helper'
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
    compileability: CanonicalCompileabilityReport | null
  }): StrategyDecision {
    const blockingReasons = [...input.blockingReasons].sort((a, b) => b.priority - a.priority)
    const compileabilityReason = blockingReasons.length === 0 && input.compileability && !input.compileability.canCompile
      ? {
          key: 'compileability',
          reason: 'compileability_blocked',
          priority: 40,
          question: `当前规则还不能稳定生成脚本：${input.compileability.reasons.join('，')}。请补充能明确落成主链规则的入场/出场条件后再确认逻辑图。`,
        }
      : null

    if (compileabilityReason) {
      blockingReasons.push(compileabilityReason)
      blockingReasons.sort((a, b) => b.priority - a.priority)
    }

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
