import type { ChecklistPayload } from '../types/checklist-compat'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { StrategyClarificationState } from '../types/strategy-clarification'

import { CodegenConversationContextHelper } from './codegen-conversation-context.helper'

export interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  logic?: ChecklistPayload
  semanticPatch?: CodegenSemanticPatch
}

export interface CanonicalCompileabilityReport {
  canCompile: boolean
  entryRuleCount: number
  exitRuleCount: number
  reasons: string[]
}

export interface StartSessionBootstrapInput {
  initialMessage?: string
  plannerStatus: LlmCodegenSessionStatus
  clarificationState: StrategyClarificationState & { summary?: string | null }
  clarificationPrompt: string | null
  confirmationAssistantPrompt?: string | null
  decisionKind?: 'DIRECT_COMPILE' | 'CONFIRM_INFERRED' | 'ASK_CLARIFY'
  plan: ConversationPlan
  compileability: CanonicalCompileabilityReport | null
  normalizationBlocked?: boolean
  normalizationAssistantPrompt?: string
}

export interface StartSessionBootstrapResult {
  status: LlmCodegenSessionStatus
  shouldEnterConfirmationGate: boolean
  assistantPrompt: string
  initialHistory: string[]
}

const helper = new CodegenConversationContextHelper()

export function buildStartSessionBootstrap(
  input: StartSessionBootstrapInput,
  buildCompileabilityAssistantPrompt: (report: CanonicalCompileabilityReport) => string,
): StartSessionBootstrapResult {
  const status: LlmCodegenSessionStatus = input.decisionKind === 'CONFIRM_INFERRED'
    ? 'DRAFTING'
    : (input.plannerStatus === 'CONFIRM_GATE'
    && (input.compileability?.canCompile === false || input.normalizationBlocked === true)
    ? 'DRAFTING'
    : input.plannerStatus)
  const shouldEnterConfirmationGate = status === 'CONFIRM_GATE'

  const assistantPrompt = ((input.clarificationState.status === 'NEEDS_CLARIFICATION') || input.decisionKind === 'CONFIRM_INFERRED') && input.clarificationPrompt
    ? input.clarificationPrompt
    : (shouldEnterConfirmationGate
        ? (input.confirmationAssistantPrompt?.trim()
            ? input.confirmationAssistantPrompt.trim()
            : `${input.plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`)
        : (input.normalizationBlocked && input.normalizationAssistantPrompt
            ? input.normalizationAssistantPrompt
            : (input.compileability && !input.compileability.canCompile
            ? buildCompileabilityAssistantPrompt(input.compileability)
            : input.plan.assistantPrompt)))

  return {
    status,
    shouldEnterConfirmationGate,
    assistantPrompt,
    initialHistory: helper.appendConversationHistory([], input.initialMessage, assistantPrompt),
  }
}
