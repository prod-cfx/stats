export type QuantEditSessionSource = 'account-detail' | 'backtest' | 'plaza' | 'ai-quant'

export type QuantReturnIntent =
  | { type: 'run', strategyId: string, ts?: number }
  | { type: 'edit', strategyId: string, ts?: number }
  | { type: 'plaza-run', templateId: string, ts?: number }
  | { type: 'plaza-edit', templateId: string, ts?: number }
  | { type: 'plaza-chat-session', sessionId: string, ts?: number }
  | { type: 'chat', draft: string, ts?: number }
  | {
      type: 'strategy-edit-session'
      strategyInstanceId: string
      publishedSnapshotId?: string
      conversationId?: string
      sessionId?: string
      source?: QuantEditSessionSource
      ts?: number
    }

export type QuantReturnIntentInput =
  | { type: 'run', strategyId: string }
  | { type: 'edit', strategyId: string }
  | { type: 'plaza-run', templateId: string }
  | { type: 'plaza-edit', templateId: string }
  | { type: 'plaza-chat-session', sessionId: string }
  | { type: 'chat', draft: string }
  | {
      type: 'strategy-edit-session'
      strategyInstanceId: string
      publishedSnapshotId?: string
      conversationId?: string
      sessionId?: string
      source?: QuantEditSessionSource
    }

const INTENT_STORAGE_KEY = 'ai_quant_return_intent_v1'

export function setIntent(intent: QuantReturnIntentInput) {
  const payload: QuantReturnIntent = { ...intent, ts: Date.now() }
  localStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(payload))
}

export function getIntent(ttlMs: number): QuantReturnIntent | null {
  const raw = localStorage.getItem(INTENT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as QuantReturnIntent
    if (!parsed?.ts || Date.now() - parsed.ts > ttlMs) {
      clearIntent()
      return null
    }
    return parsed
  } catch {
    clearIntent()
    return null
  }
}

export function clearIntent() {
  localStorage.removeItem(INTENT_STORAGE_KEY)
}
