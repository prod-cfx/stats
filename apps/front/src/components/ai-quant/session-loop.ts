export function isStrategyModificationIntent(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (!text) return false
  return /改|修改|调整|替换|变更|优化|调参|把.+改为|update|change|revise/i.test(text)
}

export function isShortConfirmationMessage(message: string): boolean {
  const text = message.trim().toLowerCase()
  const normalized = text.replace(/[。.!！、；;：:\s]+$/g, '')
  if (!normalized) return false
  if (normalized.length > 12) return false
  if (/[?？吗嘛吧呢]/.test(normalized)) return false
  if (/(不|别|不要|不是|没问题吗|有问题|再改|修改|调整)/.test(normalized)) return false

  return /^(?:这样)?可以(?:了)?$/.test(normalized)
    || /^(?:就这样|确认正确|正确|继续|按你说的来|好的?|行|ok|okay|yes|yep|同意|没问题|这样对的|按这个来|确认)$/.test(normalized)
}

export function isAssistantDraftLikeMessage(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /策略逻辑|草案|入场|出场|均线|rsi|请确认逻辑图|请确认这版逻辑|主线流程图|逻辑图已更新|确认后我再生成策略代码/i.test(text)
}

export function shouldAutoAdvanceOnConfirmation(input: {
  userMessage: string
  lastAssistantMessage?: string | null
  hasLogicGraph: boolean
}): boolean {
  if (!isShortConfirmationMessage(input.userMessage)) return false
  if (input.hasLogicGraph) return true
  return isAssistantDraftLikeMessage(input.lastAssistantMessage ?? '')
}

export function buildAutoAdvanceMessage(lastAssistantMessage?: string | null): string {
  const base = '请基于你上一条给出的策略草案，直接整理完整入场和出场规则并更新逻辑图，不要继续追问。'
  if (!lastAssistantMessage?.trim()) {
    return `${base} 然后直接生成策略代码。`
  }
  return `${base}\n上一条草案：${lastAssistantMessage.trim()}\n然后直接生成策略代码。`
}
