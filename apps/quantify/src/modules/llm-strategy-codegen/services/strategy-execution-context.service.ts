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

    const timeframeOptional = !context.timeframe && this.looksTimeframeOptional(checklist)

    const ambiguities = [
      ...(!context.exchange ? [{ kind: 'execution_context_missing', field: 'exchange', reason: 'missing_exchange' }] : []),
      ...(!context.symbol ? [{ kind: 'execution_context_missing', field: 'symbol', reason: 'missing_symbol' }] : []),
      ...(!context.marketType ? [{ kind: 'execution_context_missing', field: 'marketType', reason: 'missing_market_type' }] : []),
      ...(!context.timeframe && !timeframeOptional ? [{ kind: 'execution_context_missing', field: 'timeframe', reason: 'missing_timeframe' }] : []),
    ] as StrategyExecutionContextResolution['ambiguities']

    const evidence: StrategyExecutionContextResolution['evidence'] = []
    if (!context.exchange) {
      evidence.push({
        key: 'market.exchange',
        reason: 'runtime_context_missing',
        priority: 100,
        question: '请确认交易所（binance / okx / hyperliquid）。',
      })
    }
    if (!context.symbol) {
      evidence.push({
        key: 'market.symbol',
        reason: 'runtime_context_missing',
        priority: 95,
        question: '请确认策略交易标的（例如 BTCUSDT）。',
      })
    }
    if (!context.marketType) {
      evidence.push({
        key: 'market.marketType',
        reason: 'runtime_context_missing',
        priority: 90,
        question: '请确认市场类型（现货或合约/perp）。',
      })
    }
    if (!context.timeframe && !timeframeOptional) {
      evidence.push({
        key: 'market.timeframe',
        reason: 'runtime_context_missing',
        priority: 80,
        question: '请确认策略主周期（例如 15m 或 1h）。',
      })
    }
    if (timeframeOptional) {
      evidence.push({
        key: 'timeframe_not_required_for_uniqueness',
        reason: 'timeframe_optional',
        priority: 10,
      })
    }

    return {
      context,
      ambiguities,
      evidence,
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

  private looksTimeframeOptional(checklist: ChecklistPayload): boolean {
    const texts = [
      ...(checklist.entryRules ?? []),
      ...(checklist.exitRules ?? []),
    ].join(' ')

    return /网格/u.test(texts) && /低买高卖|高卖低买/u.test(texts)
  }
}
