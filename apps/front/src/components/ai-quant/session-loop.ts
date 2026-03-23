import type { StrategyLogicGraph } from './logic-graph-model'

export interface SessionChecklistPayload {
  entryRules?: string[]
  exitRules?: string[]
  symbols?: string[]
  timeframes?: string[]
  riskRules?: {
    positionPct: number
    maxDrawdownPct: number
  }
}

export interface SessionLoopParams {
  symbol: string
  buyWindowMin: number
  buyDropPct: number
  sellWindowMin: number
  sellRisePct: number
  positionPct: number
}

export function inferChecklistFromGraph(
  graph: StrategyLogicGraph | null | undefined,
): SessionChecklistPayload {
  if (!graph) return {}

  const entryRules: string[] = []
  const exitRules: string[] = []

  for (const node of graph.trigger) {
    const id = node.id.toLowerCase()
    if (id.includes('entry') || id.includes('buy')) {
      entryRules.push(node.operator)
      continue
    }
    if (id.includes('exit') || id.includes('sell')) {
      exitRules.push(node.operator)
    }
  }

  const dedupe = (items: string[]) => Array.from(new Set(items.map(x => x.trim()).filter(Boolean)))
  const normalizedEntry = dedupe(entryRules)
  const normalizedExit = dedupe(exitRules)

  return {
    entryRules: normalizedEntry.length > 0 ? normalizedEntry : undefined,
    exitRules: normalizedExit.length > 0 ? normalizedExit : undefined,
  }
}

export function buildLockedChecklistFromGraph(
  graph: StrategyLogicGraph | null | undefined,
  params: SessionLoopParams,
): SessionChecklistPayload {
  const base = inferChecklistFromGraph(graph)
  return {
    ...base,
    symbols: [params.symbol],
    timeframes: [`${params.buyWindowMin}m`, `${params.sellWindowMin}m`],
    riskRules: {
      positionPct: params.positionPct,
      maxDrawdownPct: 20,
    },
  }
}

export function isStrategyModificationIntent(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (!text) return false
  return /改|修改|调整|替换|变更|优化|调参|把.+改为|update|change|revise/i.test(text)
}

export function resolveChecklistPayload(input: {
  usePresetRules: boolean
  confirmGenerate: boolean
  message: string
  sessionId: string | null
  graph: StrategyLogicGraph | null | undefined
  params: SessionLoopParams
}): SessionChecklistPayload {
  if (input.usePresetRules) {
    return {
      symbols: [input.params.symbol],
      timeframes: [`${input.params.buyWindowMin}m`, `${input.params.sellWindowMin}m`],
      entryRules: [`${input.params.buyWindowMin}m 内下跌 ${input.params.buyDropPct}%`],
      exitRules: [`${input.params.sellWindowMin}m 内上涨 ${input.params.sellRisePct}%`],
      riskRules: {
        positionPct: input.params.positionPct,
        maxDrawdownPct: 20,
      },
    }
  }

  if (input.confirmGenerate && input.graph) {
    return buildLockedChecklistFromGraph(input.graph, input.params)
  }

  const shouldReuseGraphChecklist = Boolean(input.sessionId) || isStrategyModificationIntent(input.message)
  if (shouldReuseGraphChecklist) {
    return inferChecklistFromGraph(input.graph)
  }

  return {}
}

export function isShortConfirmationMessage(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (!text) return false
  return /^(?:可以|确认|继续|按你说的来|就这样|好的?|行|ok|okay|yes|yep|同意|没问题)[。.!！?？\s]*$/i.test(text)
}

export function isAssistantDraftLikeMessage(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /策略逻辑|草案|入场|出场|均线|rsi|请确认逻辑图|逻辑图已更新|确认后我再生成策略代码/i.test(text)
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
