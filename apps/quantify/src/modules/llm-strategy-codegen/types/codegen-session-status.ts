export type LlmCodegenConversationStatus = 'DRAFTING' | 'CHECKLIST_GATE'
export type LlmCodegenPipelineStatus =
  | 'GENERATING'
  | 'VALIDATING_STATIC'
  | 'VALIDATING_RUNTIME'
  | 'VALIDATING_OUTPUT'
  | 'VALIDATING_CONSISTENCY'
export type LlmCodegenTerminalStatus = 'PUBLISHED' | 'CONSISTENCY_FAILED' | 'REJECTED'

export type LlmCodegenSessionStatus =
  | LlmCodegenConversationStatus
  | LlmCodegenPipelineStatus
  | LlmCodegenTerminalStatus

export const CODEGEN_CONFIRMABLE_SESSION_STATUSES = [
  'DRAFTING',
  'CHECKLIST_GATE',
] as const satisfies readonly LlmCodegenConversationStatus[]

export const CODEGEN_PROCESSING_SESSION_STATUSES = [
  'GENERATING',
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
  'VALIDATING_CONSISTENCY',
] as const satisfies readonly LlmCodegenPipelineStatus[]

export const CODEGEN_REQUEUEABLE_SESSION_STATUSES = [
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
  'VALIDATING_CONSISTENCY',
] as const satisfies readonly Exclude<LlmCodegenPipelineStatus, 'GENERATING'>[]

export const CODEGEN_TERMINAL_SESSION_STATUSES = [
  'PUBLISHED',
  'CONSISTENCY_FAILED',
  'REJECTED',
] as const satisfies readonly LlmCodegenTerminalStatus[]

function includesStatus<TStatus extends LlmCodegenSessionStatus>(
  collection: readonly TStatus[],
  status: LlmCodegenSessionStatus,
): status is TStatus {
  return collection.includes(status as TStatus)
}

export function isTerminalCodegenSessionStatus(status: LlmCodegenSessionStatus): status is LlmCodegenTerminalStatus {
  return includesStatus(CODEGEN_TERMINAL_SESSION_STATUSES, status)
}

export function isProcessingCodegenSessionStatus(status: LlmCodegenSessionStatus): status is LlmCodegenPipelineStatus {
  return includesStatus(CODEGEN_PROCESSING_SESSION_STATUSES, status)
}

export function isRequeueableCodegenSessionStatus(
  status: LlmCodegenSessionStatus,
): status is (typeof CODEGEN_REQUEUEABLE_SESSION_STATUSES)[number] {
  return includesStatus(CODEGEN_REQUEUEABLE_SESSION_STATUSES, status)
}
