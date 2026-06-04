import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import type { AiQuantConversationBacktestDraftConfigRecord } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
import type { MarketQuote, Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
import { OkxMarketDataProvider } from '@/modules/market-data/providers/okx-market-data.provider'
import { getMarketTimeframeMs } from '@/modules/market-data/utils/market-timeframe.util'
import { SignalGeneratorRepository } from '@/modules/strategy-signals/repositories/signal-generator.repository'
import { readEventStreamsFromExprPool } from '@/modules/strategy-runtime/runtime-data-plan.resolver'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from '../core/backtest-runner.service'
import { BacktestMarketDataRepository } from '../repositories/backtest-market-data.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataService } from '../services/backtest-market-data.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobRepository } from './backtest-job.repository'

interface LastBacktestRangeConfig {
  preset: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'
  startAt?: string
  endAt?: string
}

interface LastBacktestExecutionConfig {
  initialCash: number
  leverage: number | null
  slippageBps: number
  feeBps: number
  priceSource: 'open' | 'close' | 'mid'
  allowPartial: boolean
}

export interface BacktestJobInputSummary {
  symbols: string[]
  baseTimeframe: BacktestRunInput['baseTimeframe']
  stateTimeframes: BacktestRunInput['stateTimeframes']
  initialCash: number
  leverage?: number | null
  marketType: 'spot' | 'perp'
  dataRange: BacktestRunInput['dataRange']
  requestedRange: BacktestRunInput['dataRange']
  appliedRange?: BacktestRunInput['dataRange']
  allowPartial: boolean
  isPartial: boolean
  strategyId: string
  strategyInstanceId?: string
  strategyTemplateId?: string
  conversationId?: string
  sessionId?: string
  publishedSnapshotId?: string
  snapshotId?: string
  snapshotHash?: string
  scriptHash?: string
  specHash?: string
}

interface BacktestJobErrorDetails {
  code?: string
  message: string
  args?: Record<string, unknown>
}

@Injectable()
export class BacktestJobExecutorService {
  private readonly logger = new Logger(BacktestJobExecutorService.name)

  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly marketDataService: BacktestMarketDataService,
    private readonly conversationsRepo: AiQuantConversationsRepository,
    private readonly jobsRepository: BacktestJobRepository,
    @Optional() private readonly okxMarketDataProvider?: OkxMarketDataProvider,
    @Optional() private readonly signalGeneratorRepository?: SignalGeneratorRepository,
    @Optional() private readonly backtestMarketDataRepository?: BacktestMarketDataRepository,
  ) {}

  async execute(
    id: string,
    input: BacktestRunInput,
    initialSummary: BacktestJobInputSummary,
  ): Promise<void> {
    const job = await this.jobsRepository.markRunning(id, new Date())
    if (!job) {
      this.logger.warn(`event=backtest_job_already_consumed jobId=${id}`)
      return
    }

    try {
      const { resolvedSummary, result } = await this.runBacktestJob(input, initialSummary)
      const enrichedResult = this.enrichResultWithDiagnosticReason(result)
      const completedAt = new Date()
      await this.jobsRepository.markSucceeded(id, {
        inputSummary: resolvedSummary as unknown as Prisma.InputJsonValue,
        result: enrichedResult as unknown as Prisma.InputJsonValue,
        finishedAt: completedAt,
      })

      await this.writeLastBacktestRefIfEligible({
        id,
        input,
        ownerUserId: job.ownerUserId,
        conversationId: job.conversationId,
        snapshotId: resolvedSummary.snapshotId,
        marketType: resolvedSummary.marketType,
        result: enrichedResult,
        completedAt,
      })
    } catch (error) {
      const details = this.extractErrorDetails(error)
      await this.jobsRepository.markFailed(id, {
        code: details?.code,
        message: details?.message ?? this.describeError(error),
        args: details?.args,
        finishedAt: new Date(),
      })
    }
  }

  private async runBacktestJob(
    input: BacktestRunInput,
    initialSummary: BacktestJobInputSummary,
  ): Promise<{ resolvedSummary: BacktestJobInputSummary; result: BacktestReport }> {
    const initialEventStreams = await this.resolveBacktestEventStreams(input)
    if (this.hasMissingRequiredEventStreams(input.strategy, initialEventStreams)) {
      const result = await this.runner.run({ ...input, bars: [], eventStreams: initialEventStreams })
      return {
        resolvedSummary: {
          ...initialSummary,
          appliedRange: input.dataRange,
          isPartial: false,
        },
        result,
      }
    }

    await this.marketDataService.prepareData(input)
    const coverage = await this.marketDataService.resolveCoverage(input)
    if (coverage.kind === 'empty' || !coverage.appliedRange) {
      throw new DomainException('backtest.market_data_empty', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { symbols: input.symbols, fromTs: input.dataRange.fromTs, toTs: input.dataRange.toTs },
      })
    }
    if (coverage.kind === 'partial' && input.allowPartial !== true) {
      throw new DomainException('backtest.data_range_out_of_coverage', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: {
          requestedRange: input.dataRange,
          availableRange: coverage.availableRange,
          suggestedRange: coverage.appliedRange,
        },
      })
    }

    const resolvedSummary: BacktestJobInputSummary = {
      ...initialSummary,
      appliedRange: coverage.appliedRange,
      isPartial: coverage.kind === 'partial',
    }

    const eventStreams = await this.resolveBacktestEventStreams({ ...input, dataRange: coverage.appliedRange })
    if (this.hasMissingRequiredEventStreams(input.strategy, eventStreams)) {
      const result = await this.runner.run({ ...input, dataRange: coverage.appliedRange, bars: [], eventStreams })
      return { resolvedSummary, result }
    }

    const bars = await this.marketDataService.loadBars({ ...input, dataRange: coverage.appliedRange })
    if (bars.length === 0) {
      throw new DomainException('backtest.market_data_empty', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { symbols: input.symbols, fromTs: coverage.appliedRange.fromTs, toTs: coverage.appliedRange.toTs },
      })
    }
    const result = await this.runner.run({ ...input, dataRange: coverage.appliedRange, bars, eventStreams })
    return { resolvedSummary, result }
  }

  private hasMissingRequiredEventStreams(
    strategy: BacktestRunInput['strategy'],
    eventStreams: BacktestRunInput['eventStreams'],
  ): boolean {
    const streams = this.resolveRequiredEventStreams(strategy)
    if (streams.length === 0) return false
    const suppliedStreams = eventStreams ?? {}
    return streams.some((stream) => {
      const events = suppliedStreams[stream.sourceFeedId]
      if (!Array.isArray(events)) return true
      return events.length < this.resolveRequiredEventStreamMinimum(stream.schemaRef)
    })
  }

  private resolveRequiredEventStreamMinimum(schemaRef: string): number {
    if (schemaRef === 'open_interest') return 2
    return 1
  }

  private async resolveBacktestEventStreams(input: BacktestRunInput): Promise<BacktestRunInput['eventStreams']> {
    const existing = input.eventStreams ?? {}
    const streams = this.resolveRequiredEventStreams(input.strategy)
    const output: NonNullable<BacktestRunInput['eventStreams']> = { ...existing }

    for (const stream of streams) {
      if (Array.isArray(output[stream.sourceFeedId])) continue
      if (stream.provider === 'webhook') {
        const webhookEvents = await this.loadWebhookRuntimeEvents(input, streams.filter(item => item.provider === 'webhook'))
        Object.assign(output, webhookEvents)
        continue
      }
      if (stream.provider !== 'external_feed') continue
      if (!this.okxMarketDataProvider) continue

      const symbol = input.symbols[0]
      if (!symbol) continue
      if (stream.schemaRef === 'funding') {
        output[stream.sourceFeedId] = await this.okxMarketDataProvider.fetchFundingRateEvents({
          symbol,
          startMs: input.dataRange.fromTs,
          endMs: input.dataRange.toTs,
        })
      } else if (stream.schemaRef === 'liquidation') {
        output[stream.sourceFeedId] = await this.okxMarketDataProvider.fetchLiquidationEvents({
          symbol,
          startMs: input.dataRange.fromTs,
          endMs: input.dataRange.toTs,
        })
      } else if (stream.schemaRef === 'orderbook') {
        const events = await this.okxMarketDataProvider.fetchOrderbookImbalanceEvents({
          symbol,
          startMs: input.dataRange.fromTs,
          endMs: input.dataRange.toTs,
        })
        output[stream.sourceFeedId] = events.length > 0
          ? events
          : await this.loadHistoricalOrderbookEventsFromQuotes({
            symbol,
            fromTs: input.dataRange.fromTs,
            toTs: input.dataRange.toTs,
          })
      } else if (stream.schemaRef === 'open_interest') {
        output[stream.sourceFeedId] = await this.okxMarketDataProvider.fetchOpenInterestEvents({
          symbol,
          startMs: input.dataRange.fromTs,
          endMs: input.dataRange.toTs,
        })
      }
    }

    return Object.keys(output).length > 0 ? output : undefined
  }

  private async loadHistoricalOrderbookEventsFromQuotes(params: {
    symbol: string
    fromTs: number
    toTs: number
  }): Promise<NonNullable<BacktestRunInput['eventStreams']>[string]> {
    if (!this.backtestMarketDataRepository) return []
    const quotes = await this.backtestMarketDataRepository.findHistoricalQuotes({
      symbol: params.symbol,
      fromTs: params.fromTs,
      toTs: params.toTs,
      limit: 10_000,
    })
    return quotes
      .map(quote => this.toOrderbookRuntimeEvent(quote))
      .filter((event): event is NonNullable<BacktestRunInput['eventStreams']>[string][number] => event !== null)
  }

  private toOrderbookRuntimeEvent(quote: Pick<MarketQuote, 'id' | 'eventTime' | 'bidPrice' | 'bidQty' | 'askPrice' | 'askQty'>): NonNullable<BacktestRunInput['eventStreams']>[string][number] | null {
    const bidDepth = this.readFiniteNumber(quote.bidQty)
    const askDepth = this.readFiniteNumber(quote.askQty)
    const bestBid = this.readFiniteNumber(quote.bidPrice)
    const bestAsk = this.readFiniteNumber(quote.askPrice)
    if (bidDepth === null || askDepth === null || bestBid === null || bestAsk === null) return null
    if (bidDepth <= 0 || askDepth <= 0 || bestBid <= 0 || bestAsk <= 0) return null
    const spreadPct = bestAsk >= bestBid
      ? ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100
      : null
    return {
      id: `quote-orderbook:${quote.id}`,
      ts: quote.eventTime.getTime(),
      payload: {
        bidDepth,
        askDepth,
        imbalanceRatio: bidDepth / askDepth,
        bestBid,
        bestAsk,
        ...(spreadPct !== null ? { spreadPct } : {}),
      },
    }
  }

  private async loadWebhookRuntimeEvents(
    input: BacktestRunInput,
    webhookStreams: ReturnType<typeof readEventStreamsFromExprPool>,
  ): Promise<NonNullable<BacktestRunInput['eventStreams']>> {
    if (!this.signalGeneratorRepository || webhookStreams.length === 0) return {}
    const strategyInstanceId = input.strategy.strategyInstanceId
    if (!strategyInstanceId) return {}

    const signalIds = [...new Set(webhookStreams.map(stream => stream.signalId).filter(Boolean))]
    if (signalIds.length === 0) return {}

    const subscriptions = await this.signalGeneratorRepository.findActiveWebhookSignalSubscriptions({
      strategyInstanceId,
      signalIds,
    })
    const activeSignalIds = new Set(subscriptions.map(item => item.signalId))
    const activeStreams = subscriptions.length > 0
      ? webhookStreams.filter(stream => activeSignalIds.has(stream.signalId))
      : webhookStreams
    if (activeStreams.length === 0) return {}

    const events = await this.signalGeneratorRepository.findAcceptedWebhookRuntimeEvents({
      strategyInstanceId,
      signalIds: [...new Set(activeStreams.map(stream => stream.signalId))],
      since: new Date(input.dataRange.fromTs),
      until: new Date(input.dataRange.toTs),
    })
    const output: NonNullable<BacktestRunInput['eventStreams']> = {}
    for (const stream of activeStreams) {
      const streamEvents = events
        .filter(event => event.signalId === stream.signalId)
        .map(event => ({
          id: event.id,
          ts: (event.sourceTimestamp ?? event.receivedAt).getTime(),
          payload: this.normalizeRuntimeEventPayload(event.payload, event.signalId),
        }))
      output[stream.sourceFeedId] = streamEvents.length > 0
        ? streamEvents
        : this.buildSyntheticWebhookBacktestEvents(input, stream)
    }
    return output
  }

  private buildSyntheticWebhookBacktestEvents(
    input: BacktestRunInput,
    stream: ReturnType<typeof readEventStreamsFromExprPool>[number],
  ): NonNullable<BacktestRunInput['eventStreams']>[string] {
    const timeframeMs = getMarketTimeframeMs(input.baseTimeframe)
    const stepMs = Number.isFinite(timeframeMs) && timeframeMs > 0 ? timeframeMs : 60_000
    const side = this.inferSyntheticWebhookSide(stream.signalId)
    const events: NonNullable<BacktestRunInput['eventStreams']>[string] = []
    for (let ts = input.dataRange.fromTs; ts <= input.dataRange.toTs; ts += stepMs) {
      events.push({
        id: `synthetic-${stream.sourceFeedId}-${ts}`,
        ts,
        payload: {
          signalId: stream.signalId,
          ...(side ? { side } : {}),
          synthetic: true,
        },
      })
    }
    return events
  }

  private inferSyntheticWebhookSide(signalId: string): 'buy' | 'sell' | undefined {
    const normalized = signalId.trim().toLowerCase()
    if (/\b(buy|long)\b|买|多/u.test(normalized)) return 'buy'
    if (/\b(sell|short)\b|卖|空/u.test(normalized)) return 'sell'
    return undefined
  }

  private normalizeRuntimeEventPayload(payload: unknown, signalId: string): Record<string, unknown> {
    const record = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {}
    return {
      signalId,
      ...record,
    }
  }

  private readFiniteNumber(value: unknown): number | null {
    const numeric = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function'
          ? Number((value as { toString: () => string }).toString())
          : NaN
    return Number.isFinite(numeric) ? numeric : null
  }

  private resolveRequiredEventStreams(strategy: BacktestRunInput['strategy']): ReturnType<typeof readEventStreamsFromExprPool> {
    const candidates = [
      this.readRecord(strategy.astSnapshot)?.exprPool,
      this.readRecord(strategy.irSnapshot)?.exprPool,
      this.readRecord(strategy.specSnapshot)?.exprPool,
    ]
    const streams = candidates.flatMap(candidate => readEventStreamsFromExprPool(candidate))
    const byFeedId = new Map<string, (typeof streams)[number]>()
    streams.forEach((stream) => {
      if (!byFeedId.has(stream.sourceFeedId)) byFeedId.set(stream.sourceFeedId, stream)
    })
    return [...byFeedId.values()]
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private enrichResultWithDiagnosticReason(result: BacktestReport): BacktestReport {
    if (result.summary.totalTrades > 0 || (result.summary.totalOpenTrades ?? 0) > 0 || result.summary.diagnosticReason || !result.diagnostics) {
      return result
    }
    const { compiledRulesCount, signalTriggerCount, fillCount, dataRequirementMissingCount, eventStreamMissingCount } = result.diagnostics
    let diagnosticReason: BacktestReport['summary']['diagnosticReason']
    if (compiledRulesCount === 0) {
      diagnosticReason = ErrorCode.BACKTEST_NO_RULES_COMPILED as BacktestReport['summary']['diagnosticReason']
    } else if (dataRequirementMissingCount && dataRequirementMissingCount > 0) {
      diagnosticReason = ErrorCode.BACKTEST_DATA_REQUIREMENT_UNAVAILABLE as BacktestReport['summary']['diagnosticReason']
    } else if (eventStreamMissingCount && eventStreamMissingCount > 0) {
      diagnosticReason = ErrorCode.BACKTEST_EVENT_STREAM_UNAVAILABLE as BacktestReport['summary']['diagnosticReason']
    } else if (signalTriggerCount === 0) {
      diagnosticReason = ErrorCode.BACKTEST_NO_SIGNAL_FIRED_IN_RANGE as BacktestReport['summary']['diagnosticReason']
    } else if (fillCount === 0) {
      diagnosticReason = ErrorCode.BACKTEST_SIGNAL_FIRED_BUT_NO_FILL as BacktestReport['summary']['diagnosticReason']
    }
    if (!diagnosticReason) return result
    return {
      ...result,
      summary: {
        ...result.summary,
        diagnosticReason,
      },
    }
  }

  private async writeLastBacktestRefIfEligible(params: {
    id: string
    input: BacktestRunInput
    ownerUserId: string
    conversationId: string | null | undefined
    snapshotId: string | undefined
    marketType: 'spot' | 'perp'
    result: BacktestReport
    completedAt: Date
  }): Promise<void> {
    const { id, input, ownerUserId, conversationId, snapshotId, marketType, result, completedAt } = params
    if (!this.shouldWriteLastBacktestRef(input, conversationId, snapshotId)) {
      return
    }

    try {
      await this.conversationsRepo.updateLastBacktestRef({
        conversationId,
        userId: ownerUserId,
        lastBacktestRef: {
          jobId: id,
          publishedSnapshotId: snapshotId,
          config: this.buildLastBacktestConfig(input),
          summary: {
            maxDrawdownPct: Number(result.summary.maxDrawdownPct.toFixed(2)),
            totalReturnPct: Number(result.summary.netProfitPct.toFixed(2)),
            winRatePct: Number(
              (
                result.summary.winRate <= 1
                  ? result.summary.winRate * 100
                  : result.summary.winRate
              ).toFixed(2),
            ),
            tradeCount: result.summary.totalTrades,
            ...(typeof result.summary.totalOpenTrades === 'number'
              ? { openTradeCount: result.summary.totalOpenTrades }
              : {}),
            ...(typeof result.summary.openPnl === 'number'
              ? { openPnl: Number(result.summary.openPnl.toFixed(2)) }
              : {}),
            ...(result.summary.diagnosticReason ? { diagnosticReason: result.summary.diagnosticReason } : {}),
            marketType,
          },
          completedAt,
        },
      })
    } catch (error) {
      this.logger.warn(
        `event=backtest_last_backtest_ref_write_failed jobId=${id} conversationId=${conversationId} reason=${this.describeError(error)}`,
      )
    }
  }

  private shouldWriteLastBacktestRef(
    input: BacktestRunInput,
    conversationId: string | null | undefined,
    snapshotId: string | undefined,
  ): conversationId is string {
    return (
      input.strategy.bindingSource === 'PUBLISHED_SNAPSHOT_STRICT'
      && typeof conversationId === 'string'
      && conversationId.length > 0
      && typeof snapshotId === 'string'
      && snapshotId.length > 0
    )
  }

  private buildLastBacktestConfig(input: BacktestRunInput): {
    range: LastBacktestRangeConfig
    execution: LastBacktestExecutionConfig
  } {
    return this.buildBacktestDraftConfig(input)
  }

  private buildBacktestDraftConfig(
    input: BacktestRunInput,
  ): AiQuantConversationBacktestDraftConfigRecord {
    return {
      range: this.buildLastBacktestRangeConfig(input),
      execution: {
        initialCash: input.initialCash,
        leverage: typeof input.leverage === 'number' && Number.isFinite(input.leverage) ? input.leverage : null,
        slippageBps: input.execution.slippageBps,
        feeBps: input.execution.feeBps,
        priceSource: input.execution.priceSource,
        allowPartial: input.allowPartial === true,
      },
    }
  }

  private buildLastBacktestRangeConfig(input: BacktestRunInput): LastBacktestRangeConfig {
    const requestedRangeInput = input.requestedRangeInput
    if (requestedRangeInput) {
      const base = { preset: requestedRangeInput.preset } as LastBacktestRangeConfig
      if (requestedRangeInput.preset === 'CUSTOM') {
        return {
          ...base,
          ...(typeof requestedRangeInput.startAt === 'string' ? { startAt: requestedRangeInput.startAt } : {}),
          ...(typeof requestedRangeInput.endAt === 'string' ? { endAt: requestedRangeInput.endAt } : {}),
        }
      }
      return base
    }

    return {
      preset: 'CUSTOM',
      startAt: new Date(input.dataRange.fromTs).toISOString(),
      endAt: new Date(input.dataRange.toTs).toISOString(),
    }
  }

  private extractErrorDetails(error: unknown): BacktestJobErrorDetails | undefined {
    if (error instanceof DomainException) {
      return {
        code: error.message,
        message: error.message,
        args: error.args,
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return { message: error.message }
    }

    return undefined
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return String(error)
  }
}
