import type { ChecklistPayload } from '../types/codegen-checklist'
import type { StrategyExecutionContext, StrategyExecutionContextResolution } from '../types/strategy-execution-context'
import { Injectable } from '@nestjs/common'
import { resolveChecklistDefaultTimeframe } from './checklist-rule-drafts'

@Injectable()
export class StrategyExecutionContextService {
  resolve(checklist: ChecklistPayload): StrategyExecutionContextResolution {
    const context: StrategyExecutionContext = {
      exchange: this.readExchange(checklist),
      symbol: this.readPrimaryValue(checklist.symbols),
      marketType: this.readMarketType(checklist),
      timeframe: resolveChecklistDefaultTimeframe(checklist),
    }

    const ambiguities = [
      ...(!context.exchange ? [{ kind: 'execution_context_missing', field: 'exchange', reason: 'missing_exchange' }] : []),
      ...(!context.symbol ? [{ kind: 'execution_context_missing', field: 'symbol', reason: 'missing_symbol' }] : []),
      ...(!context.marketType ? [{ kind: 'execution_context_missing', field: 'marketType', reason: 'missing_market_type' }] : []),
      ...(!context.timeframe ? [{ kind: 'execution_context_missing', field: 'timeframe', reason: 'missing_timeframe' }] : []),
    ] as StrategyExecutionContextResolution['ambiguities']

    return {
      context,
      ambiguities,
    }
  }

  private readPrimaryValue(values: string[] | undefined): string | null {
    const raw = values?.[0]
    if (typeof raw !== 'string') return null

    const normalized = raw.trim()
    return normalized.length > 0 ? normalized : null
  }

  private readExchange(checklist: ChecklistPayload): StrategyExecutionContext['exchange'] {
    const raw = typeof checklist.market?.exchange === 'string'
      ? checklist.market.exchange
      : checklist.riskRules?.exchange
    if (typeof raw !== 'string') return null

    const normalized = raw.trim().toLowerCase()
    if (normalized === 'okx' || normalized === 'binance' || normalized === 'hyperliquid') {
      return normalized
    }

    return null
  }

  private readMarketType(checklist: ChecklistPayload): StrategyExecutionContext['marketType'] {
    const raw = typeof checklist.market?.marketType === 'string'
      ? checklist.market.marketType
      : checklist.riskRules?.marketType
    if (typeof raw !== 'string') return null

    const normalized = raw.trim().toLowerCase()
    if (normalized === 'spot' || normalized === 'perp') {
      return normalized
    }

    return null
  }
}
