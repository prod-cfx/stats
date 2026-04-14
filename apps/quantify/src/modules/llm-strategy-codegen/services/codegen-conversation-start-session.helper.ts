import type { ChecklistPayload } from '../types/codegen-checklist'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { StrategyClarificationState } from '../types/strategy-clarification'

import { CodegenConversationContextHelper } from './codegen-conversation-context.helper'

export interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  logic?: ChecklistPayload
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
  plan: ConversationPlan
  compileability: CanonicalCompileabilityReport | null
}

export interface StartSessionBootstrapResult {
  status: LlmCodegenSessionStatus
  shouldGateChecklist: boolean
  assistantPrompt: string
  initialHistory: string[]
}

const helper = new CodegenConversationContextHelper()

export function buildStartSessionBootstrap(
  input: StartSessionBootstrapInput,
  buildCompileabilityAssistantPrompt: (report: CanonicalCompileabilityReport) => string,
): StartSessionBootstrapResult {
  const status: LlmCodegenSessionStatus = input.plannerStatus === 'CHECKLIST_GATE' && input.compileability?.canCompile === false
    ? 'DRAFTING'
    : input.plannerStatus
  const shouldGateChecklist = status === 'CHECKLIST_GATE'

  const assistantPrompt = input.clarificationState.status === 'NEEDS_CLARIFICATION' && input.clarificationPrompt
    ? input.clarificationPrompt
    : (shouldGateChecklist
        ? `${input.plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`
        : (input.compileability && !input.compileability.canCompile
            ? buildCompileabilityAssistantPrompt(input.compileability)
            : input.plan.assistantPrompt))

  return {
    status,
    shouldGateChecklist,
    assistantPrompt,
    initialHistory: helper.appendConversationHistory([], input.initialMessage, assistantPrompt),
  }
}
