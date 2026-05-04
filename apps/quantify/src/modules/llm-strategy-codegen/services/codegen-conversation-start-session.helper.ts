import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { StrategyClarificationState } from '../types/strategy-clarification'

import { CodegenConversationContextHelper } from './codegen-conversation-context.helper'

export interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
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
  initialStatus: LlmCodegenSessionStatus
  clarificationState: StrategyClarificationState & { summary?: string | null }
  clarificationPrompt: string | null
  confirmationAssistantPrompt?: string | null
  decisionKind?: 'DIRECT_COMPILE' | 'CONFIRM_INFERRED' | 'ASK_CLARIFY'
  plan: ConversationPlan
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
): StartSessionBootstrapResult {
  const status: LlmCodegenSessionStatus = input.decisionKind === 'CONFIRM_INFERRED'
    ? 'DRAFTING'
    : (input.initialStatus === 'CONFIRM_GATE'
    && input.normalizationBlocked === true
    ? 'DRAFTING'
    : input.initialStatus)
  const shouldEnterConfirmationGate = status === 'CONFIRM_GATE'

  const assistantPrompt = ((input.clarificationState.status === 'NEEDS_CLARIFICATION') || input.decisionKind === 'CONFIRM_INFERRED') && input.clarificationPrompt
    ? input.clarificationPrompt
    : (shouldEnterConfirmationGate
        ? (input.confirmationAssistantPrompt?.trim()
            ? input.confirmationAssistantPrompt.trim()
            : `${input.plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`)
        : (input.normalizationBlocked && input.normalizationAssistantPrompt
            ? input.normalizationAssistantPrompt
            : input.plan.assistantPrompt))

  return {
    status,
    shouldEnterConfirmationGate,
    assistantPrompt,
    initialHistory: helper.appendConversationHistory([], input.initialMessage, assistantPrompt),
  }
}
