import type { StrategyLogicGraph } from './logic-graph-model'

interface CodegenSpecMarket {
  symbols?: string[]
  timeframes?: string[]
}

interface CodegenSpec {
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
  market?: CodegenSpecMarket
}

interface GraphFallbackMeta {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  baseTimeframe: string
  positionPct: number
  executionTags?: string[]
}

function asStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function stringifyRiskRule(key: string, value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`
  }
  return `${key}: ${JSON.stringify(value)}`
}

export function buildLogicGraphFromCodegenSpec(
  spec: unknown,
  fallback: GraphFallbackMeta,
  version: number,
  status: StrategyLogicGraph['status'] = 'draft',
): StrategyLogicGraph {
  const typed = (spec && typeof spec === 'object' ? spec : {}) as CodegenSpec
  const entryRules = asStringList(typed.entryRules)
  const exitRules = asStringList(typed.exitRules)
  const marketSymbols = asStringList(typed.market?.symbols)
  const timeframes = asStringList(typed.market?.timeframes)
  const riskRules = typed.riskRules && typeof typed.riskRules === 'object' ? typed.riskRules : {}

  const symbol = marketSymbols[0] || fallback.symbol
  const trigger = [
    ...entryRules.map((rule, idx) => ({
      id: `trigger-entry-${version}-${idx}`,
      subject: symbol,
      operator: rule,
      value: 'true',
      join: (idx > 0 ? 'AND' : undefined) as 'AND' | undefined,
    })),
    ...exitRules.map((rule, idx) => ({
      id: `trigger-exit-${version}-${idx}`,
      subject: symbol,
      operator: rule,
      value: 'true',
      join: ((idx > 0 || entryRules.length > 0) ? 'AND' : undefined) as 'AND' | undefined,
    })),
  ]

  const risk = Object.entries(riskRules).map(([key, value]) => stringifyRiskRule(key, value))
  if (risk.length === 0) {
    risk.push('等待风控规则补充')
  }

  const actions: StrategyLogicGraph['actions'] = []
  if (entryRules.length > 0) {
    actions.push({
      id: `action-buy-${version}`,
      action: 'BUY',
      target: symbol,
      amount: `${fallback.positionPct}%`,
    })
  }
  if (exitRules.length > 0) {
    actions.push({
      id: `action-sell-${version}`,
      action: 'SELL',
      target: symbol,
      amount: `${fallback.positionPct}%`,
    })
  }

  return {
    version,
    status,
    trigger: trigger.length > 0
      ? trigger
      : [{
          id: `trigger-default-${version}`,
          subject: symbol,
          operator: '等待策略规则补充',
          value: 'true',
        }],
    actions,
    risk,
    meta: {
      exchange: fallback.exchange,
      symbol,
      timeframe: timeframes.length > 0 ? timeframes.join('/') : fallback.baseTimeframe,
      positionPct: fallback.positionPct,
      executionTags: fallback.executionTags ?? [],
    },
  }
}
