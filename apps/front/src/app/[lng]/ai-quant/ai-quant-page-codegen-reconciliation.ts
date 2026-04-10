import type { ConversationState } from './ai-quant-page-conversation'
import type { LlmCodegenSessionResponse } from '@/lib/api'
import { readCanonicalDigest } from '@/components/ai-quant/canonical-confirmation'

export type CodegenSessionReconciliationAction = 'reuse' | 'apply-server' | 'restart'

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function hasBlockingClarificationGate(gate: unknown): boolean {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
    return false
  }
  const record = gate as Record<string, unknown>
  const items = Array.isArray(record.items)
    ? record.items
    : (Array.isArray(record.pendingItems) ? record.pendingItems : [])
  return record.blocked === true || items.length > 0
}

function readConversationCanonicalDigest(
  conversation: Pick<ConversationState, 'pendingCanonicalDigest' | 'codegenSpecDesc'>,
): string | null {
  return normalizeString(conversation.pendingCanonicalDigest)
    ?? readCanonicalDigest(conversation.codegenSpecDesc)
}

function readResponseCanonicalDigest(response: LlmCodegenSessionResponse): string | null {
  return normalizeString(response.canonicalDigest) ?? readCanonicalDigest(response.specDesc)
}

function isIrrecoverablePublishedResponse(response: LlmCodegenSessionResponse): boolean {
  if (response.status !== 'PUBLISHED') {
    return false
  }
  const hasTerminalArtifact = Boolean(
    normalizeString(response.publishedSnapshotId)
      || normalizeString(response.scriptCode)
      || response.specDesc
      || response.semanticGraph
      || response.validationReport,
  )
  return !hasTerminalArtifact
}

export function getCodegenSessionReconciliationAction(args: {
  conversation: Pick<
    ConversationState,
    'clarificationGate' | 'codegenSpecDesc' | 'pendingCanonicalDigest' | 'publishedSnapshotId'
  >
  response: LlmCodegenSessionResponse
}): CodegenSessionReconciliationAction {
  const { conversation, response } = args

  if (isIrrecoverablePublishedResponse(response)) {
    return 'restart'
  }

  if (response.status === 'PUBLISHED' || response.status === 'REJECTED') {
    return 'apply-server'
  }

  if (
    hasBlockingClarificationGate(response.clarificationGate)
    && !hasBlockingClarificationGate(conversation.clarificationGate)
  ) {
    return 'apply-server'
  }

  const localDigest = readConversationCanonicalDigest(conversation)
  const remoteDigest = readResponseCanonicalDigest(response)
  if (localDigest && remoteDigest && localDigest !== remoteDigest) {
    return 'restart'
  }

  const localPublishedSnapshotId = normalizeString(conversation.publishedSnapshotId)
  const remotePublishedSnapshotId = normalizeString(response.publishedSnapshotId)
  if (localPublishedSnapshotId && localPublishedSnapshotId !== remotePublishedSnapshotId) {
    return 'restart'
  }

  return 'reuse'
}
