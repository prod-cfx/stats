import type { StrategyLogicSnapshot } from '../types/strategy-logic-snapshot'
import type { SemanticSlotState, SemanticState } from '../types/semantic-state'
import type { StrategyExecutionContext, StrategyExecutionContextResolution } from '../types/strategy-execution-context'
import { Injectable } from '@nestjs/common'
import { resolveStrategyDefaultTimeframe } from './rule-draft-projection'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

type ExecutionContextField = StrategyExecutionContextResolution['ambiguities'][number]['field']
type ExecutionContextMissingReason = StrategyExecutionContextResolution['ambiguities'][number]['reason']

@Injectable()
export class StrategyExecutionContextService {
  resolve(checklist: StrategyLogicSnapshot): StrategyExecutionContextResolution {
    const context: StrategyExecutionContext = {
      exchange: this.readExchange(checklist),
      symbol: this.readPrimaryValue(checklist.symbols),
      marketType: this.readMarketType(checklist),
      timeframe: resolveStrategyDefaultTimeframe(checklist),
    }

    const timeframeOptional = !context.timeframe && this.looksTimeframeOptional(checklist)
    const artifacts = this.buildMissingContextArtifacts(context, { timeframeOptional })

    return { context, ...artifacts }
  }

  resolveFromSemanticState(state: SemanticState): StrategyExecutionContextResolution {
    const context: StrategyExecutionContext = {
      exchange: this.readSemanticExchange(state.contextSlots.exchange),
      symbol: this.readSemanticSymbol(state.contextSlots.symbol),
      marketType: this.readSemanticMarketType(state.contextSlots.marketType),
      timeframe: this.readSemanticString(state.contextSlots.timeframe),
    }
    const timeframeOptional = !context.timeframe && this.hasSemanticGridTrigger(state)
    const artifacts = this.buildMissingContextArtifacts(context, { timeframeOptional })

    return { context, ...artifacts }
  }

  private buildExecutionContextMissingAmbiguity(
    field: ExecutionContextField,
    reason: ExecutionContextMissingReason,
  ): StrategyExecutionContextResolution['ambiguities'][number] {
    return { kind: 'execution_context_missing', field, reason }
  }

  private buildMissingContextArtifacts(
    context: StrategyExecutionContext,
    options: { timeframeOptional: boolean },
  ): Pick<StrategyExecutionContextResolution, 'ambiguities' | 'evidence'> {
    const ambiguities: StrategyExecutionContextResolution['ambiguities'] = []
    const evidence: StrategyExecutionContextResolution['evidence'] = []

    if (!context.exchange) {
      ambiguities.push(this.buildExecutionContextMissingAmbiguity('exchange', 'missing_exchange'))
      evidence.push({
        key: 'market.exchange',
        reason: 'runtime_context_missing',
        priority: 100,
        question: '请确认交易所（binance / okx / hyperliquid）。',
      })
    }

    if (!context.symbol) {
      ambiguities.push(this.buildExecutionContextMissingAmbiguity('symbol', 'missing_symbol'))
      evidence.push({
        key: 'market.symbol',
        reason: 'runtime_context_missing',
        priority: 95,
        question: '请确认策略交易标的（例如 BTCUSDT）。',
      })
    }

    if (!context.marketType) {
      ambiguities.push(this.buildExecutionContextMissingAmbiguity('marketType', 'missing_market_type'))
      evidence.push({
        key: 'market.marketType',
        reason: 'runtime_context_missing',
        priority: 90,
        question: '请确认市场类型（现货或合约/perp）。',
      })
    }

    if (!context.timeframe && !options.timeframeOptional) {
      ambiguities.push(this.buildExecutionContextMissingAmbiguity('timeframe', 'missing_timeframe'))
      evidence.push({
        key: 'market.timeframe',
        reason: 'runtime_context_missing',
        priority: 80,
        question: '请确认策略主周期（例如 15m 或 1h）。',
      })
    }

    if (options.timeframeOptional) {
      evidence.push({
        key: 'timeframe_not_required_for_uniqueness',
        reason: 'timeframe_optional',
        priority: 10,
      })
    }

    return { ambiguities, evidence }
  }

  private readSemanticString(slot: SemanticSlotState | null): string | null {
    const value = slot?.status === 'locked' && typeof slot?.value === 'string' ? slot.value.trim() : ''
    return value ? value : null
  }

  private readSemanticSymbol(slot: SemanticSlotState | null): string | null {
    const value = this.readSemanticString(slot)
    return value ? canonicalizeStrategySymbolInput(value) : null
  }

  private readSemanticExchange(slot: SemanticSlotState | null): StrategyExecutionContext['exchange'] {
    const normalized = this.readSemanticString(slot)?.toLowerCase()
    return normalized === 'okx' || normalized === 'binance' || normalized === 'hyperliquid' ? normalized : null
  }

  private readSemanticMarketType(slot: SemanticSlotState | null): StrategyExecutionContext['marketType'] {
    const normalized = this.readSemanticString(slot)?.toLowerCase()
    return normalized === 'spot' || normalized === 'perp' ? normalized : null
  }

  private hasSemanticGridTrigger(state: SemanticState): boolean {
    return state.triggers.some(trigger => trigger.status !== 'superseded' && trigger.key === 'grid.range_rebalance')
  }

  private readPrimaryValue(values: string[] | undefined): string | null {
    const raw = values?.[0]
    if (typeof raw !== 'string') return null

    return canonicalizeStrategySymbolInput(raw)
  }

  private readExchange(checklist: StrategyLogicSnapshot): StrategyExecutionContext['exchange'] {
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

  private readMarketType(checklist: StrategyLogicSnapshot): StrategyExecutionContext['marketType'] {
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

  private looksTimeframeOptional(checklist: StrategyLogicSnapshot): boolean {
    const texts = [
      ...(checklist.entryRules ?? []),
      ...(checklist.exitRules ?? []),
    ].join(' ')

    return /网格/u.test(texts) && /低买高卖|高卖低买|上方网格卖出|网格卖出/u.test(texts)
  }
}
