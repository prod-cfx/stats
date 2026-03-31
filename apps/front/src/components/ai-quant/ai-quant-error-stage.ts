export type AiQuantErrorStage = 'capability' | 'codegen' | 'backtest' | 'deploy' | 'unknown'

export interface AiQuantErrorMeta {
  message?: string
  code?: string
  stage: AiQuantErrorStage
  requestId?: string
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function parseStage(value: unknown): AiQuantErrorStage {
  const stage = toNonEmptyString(value)?.toLowerCase()
  if (stage === 'capability' || stage === 'codegen' || stage === 'backtest' || stage === 'deploy') {
    return stage
  }
  return 'unknown'
}

export function parseAiQuantErrorMeta(payload: unknown): AiQuantErrorMeta {
  if (!payload || typeof payload !== 'object') {
    return { stage: 'unknown' }
  }

  const root = payload as Record<string, unknown>
  const nested = root.error && typeof root.error === 'object'
    ? root.error as Record<string, unknown>
    : undefined
  const nestedArgs = nested?.args && typeof nested.args === 'object'
    ? nested.args as Record<string, unknown>
    : undefined

  const message = toNonEmptyString(nestedArgs?.reasonMessage)
    ?? toNonEmptyString(nested?.message)
    ?? toNonEmptyString(root.message)
  const code = toNonEmptyString(nested?.code) ?? toNonEmptyString(root.code)
  const stage = parseStage(nested?.stage ?? root.stage)
  const requestId = toNonEmptyString(nested?.requestId) ?? toNonEmptyString(root.requestId)

  return { message, code, stage, requestId }
}

export function buildAiQuantStageFallbackMessage(
  fallback: string,
  status: number,
  meta: AiQuantErrorMeta,
): string {
  const stageLabel = meta.stage !== 'unknown' ? ` ${meta.stage}` : ''
  if (meta.code) {
    return `${fallback}${stageLabel} (${meta.code}, HTTP ${status})`
  }
  return `${fallback}${stageLabel} (HTTP ${status})`
}
