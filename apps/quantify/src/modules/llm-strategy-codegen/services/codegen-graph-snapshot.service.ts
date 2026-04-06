import type { StrategyLogicGraphActionNode, StrategyLogicGraphSnapshot, StrategyLogicGraphTriggerNode } from '../types/strategy-logic-graph-snapshot'
import { Injectable } from '@nestjs/common'

interface GraphSpecMarket {
  symbols?: unknown
  timeframes?: unknown
}

interface GraphSpecDesc {
  market?: GraphSpecMarket
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

interface BuildGraphSnapshotInput {
  version: number
  specDesc: Record<string, unknown>
  fallback: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
    executionTags?: string[]
  }
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

@Injectable()
export class CodegenGraphSnapshotService {
  build(input: BuildGraphSnapshotInput): StrategyLogicGraphSnapshot {
    const spec = (input.specDesc && typeof input.specDesc === 'object' ? input.specDesc : {}) as GraphSpecDesc
    const entryRules = asStringList(spec.entryRules)
    const exitRules = asStringList(spec.exitRules)
    const marketSymbols = asStringList(spec.market?.symbols)
    const timeframes = asStringList(spec.market?.timeframes)
    const riskRules = spec.riskRules && typeof spec.riskRules === 'object' ? spec.riskRules : {}
    const symbol = marketSymbols[0] || input.fallback.symbol

    return {
      version: input.version,
      status: 'confirmed',
      trigger: this.buildTriggerNodes(input.version, entryRules, exitRules),
      actions: this.buildActionNodes(input.version, symbol, input.fallback.positionPct, entryRules, exitRules),
      risk: Object.entries(riskRules).map(([key, value]) => stringifyRiskRule(key, value)),
      meta: {
        exchange: input.fallback.exchange,
        symbol,
        timeframe: timeframes.length > 0 ? timeframes.join('/') : input.fallback.baseTimeframe,
        positionPct: input.fallback.positionPct,
        executionTags: input.fallback.executionTags ?? [],
      },
    }
  }

  private buildTriggerNodes(version: number, entryRules: string[], exitRules: string[]): StrategyLogicGraphTriggerNode[] {
    return [
      ...entryRules.map((rule, index) => ({
        id: `trigger-entry-${version}-${index}`,
        phase: 'entry' as const,
        operator: rule,
        join: index > 0 ? 'AND' as const : undefined,
      })),
      ...exitRules.map((rule, index) => ({
        id: `trigger-exit-${version}-${index}`,
        phase: 'exit' as const,
        operator: rule,
        join: (index > 0 || entryRules.length > 0) ? 'AND' as const : undefined,
      })),
    ]
  }

  private buildActionNodes(
    version: number,
    symbol: string,
    positionPct: number,
    entryRules: string[],
    exitRules: string[],
  ): StrategyLogicGraphActionNode[] {
    const actions: StrategyLogicGraphActionNode[] = []

    if (entryRules.length > 0) {
      actions.push({
        id: `action-buy-${version}`,
        action: 'BUY',
        target: symbol,
        amount: `${positionPct}%`,
      })
    }

    if (exitRules.length > 0) {
      actions.push({
        id: `action-sell-${version}`,
        action: 'SELL',
        target: symbol,
        amount: `${positionPct}%`,
      })
    }

    return actions
  }
}
