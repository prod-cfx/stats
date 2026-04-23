import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable, HttpStatus, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from '../core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataService } from '../services/backtest-market-data.service'
import type { BacktestSymbolAvailabilityResult } from '../services/backtest-symbol-availability.service'
import { extractSnapshotBoundSymbolAvailabilityInput } from '../services/backtest-snapshot-loader.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSymbolAvailabilityService } from '../services/backtest-symbol-availability.service'

export type BacktestJobPhase = 'queued' | 'running' | 'succeeded' | 'failed'

const VALID_BACKTEST_JOB_PHASES = new Set<BacktestJobPhase>([
  'queued',
  'running',
  'succeeded',
  'failed',
])

interface BacktestJobRecord {
  id: string
  ownerUserId: string
  status: BacktestJobPhase
  snapshotId?: string
  snapshotHash?: string
  scriptHash?: string
  specHash?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  errorDetails?: BacktestJobErrorDetails
  inputSummary: {
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
    snapshotId?: string
    snapshotHash?: string
    scriptHash?: string
    specHash?: string
  }
  result?: BacktestReport
}

interface BacktestJobErrorDetails {
  code?: string
  message: string
  args?: Record<string, unknown>
}

type BacktestJobView = Omit<BacktestJobRecord, 'result' | 'ownerUserId'> & {
  resultSummary?: BacktestReport['summary']
}

@Injectable()
export class BacktestJobsService {
  private readonly logger = new Logger(BacktestJobsService.name)
  private readonly fallbackJobs = new Map<string, BacktestJobRecord>()

  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly marketDataService: BacktestMarketDataService,
    private readonly symbolAvailabilityService: BacktestSymbolAvailabilityService,
    private readonly conversationsRepo: AiQuantConversationsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createJob(input: BacktestRunInput, ownerUserId: string): Promise<BacktestJobView> {
    await this.validateSymbolAvailability(input)
    const id = `btjob-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    const inputSummary = this.createInputSummary(input)
    try {
      const conversationId = this.readConversationId(input)
      const job = await this.prisma.backtestJob.create({
        data: {
          id,
          ownerUserId,
          conversationId,
          status: 'queued',
          snapshotId: inputSummary.snapshotId ?? null,
          snapshotHash: inputSummary.snapshotHash ?? null,
          scriptHash: inputSummary.scriptHash ?? null,
          specHash: inputSummary.specHash ?? null,
          inputSummary: inputSummary as Prisma.InputJsonValue,
        },
      })
      queueMicrotask(() => {
        void this.executePersistedJob(id, input, inputSummary)
      })
      return this.toView(job)
    } catch (error) {
      if (!this.isBacktestJobPersistenceUnavailable(error)) {
        throw error
      }

      this.logger.warn(
        `event=backtest_job_persistence_unavailable mode=fallback_memory reason=${this.describeError(error)} jobId=${id}`,
      )
      const fallbackJob: BacktestJobRecord = {
        id,
        ownerUserId,
        status: 'queued',
        createdAt: new Date().toISOString(),
        inputSummary,
      }
      this.fallbackJobs.set(id, fallbackJob)
      queueMicrotask(() => {
        void this.executeFallbackJob(id, input, inputSummary)
      })
      return this.toFallbackView(fallbackJob)
    }
  }

  private async validateSymbolAvailability(input: BacktestRunInput): Promise<void> {
    const availabilityInput = extractSnapshotBoundSymbolAvailabilityInput(input.strategy)
    if (!availabilityInput) {
      return
    }

    const availability = await this.symbolAvailabilityService.check(availabilityInput)
    if (availability.supported) {
      return
    }

    const failure = availability as Extract<BacktestSymbolAvailabilityResult, { supported: false }>
    const snapshotId = this.readStrategyMetadata(input.strategy, 'snapshotId')
    throw new DomainException('backtesting.symbol_unavailable', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        ...(failure.args ?? {}),
        reasonCode: failure.reasonCode,
        ...(snapshotId ? { snapshotId } : {}),
      },
    })
  }

  async getJob(id: string, ownerUserId: string): Promise<BacktestJobView> {
    const fallbackJob = this.fallbackJobs.get(id)
    if (fallbackJob) {
      if (fallbackJob.ownerUserId !== ownerUserId) {
        throw new DomainException('backtest.job_not_found', {
          code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
          args: { id },
        })
      }
      return this.toFallbackView(fallbackJob)
    }
    const job = await this.getOwnedJobOrThrowNotFound(id, ownerUserId)
    return this.toView(job)
  }

  async getJobResult(id: string, ownerUserId: string): Promise<BacktestReport> {
    const fallbackJob = this.fallbackJobs.get(id)
    if (fallbackJob) {
      if (fallbackJob.ownerUserId !== ownerUserId) {
        throw new DomainException('backtest.job_not_found', {
          code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
          args: { id },
        })
      }
      if (fallbackJob.status === 'failed') throw new DomainException('backtest.job_failed', { code: ErrorCode.BACKTEST_JOB_CONFLICT, status: HttpStatus.CONFLICT, args: { id, error: fallbackJob.error } })
      if (fallbackJob.status !== 'succeeded' || !fallbackJob.result) throw new DomainException('backtest.job_not_completed', { code: ErrorCode.BACKTEST_JOB_CONFLICT, status: HttpStatus.CONFLICT, args: { id, status: fallbackJob.status } })
      return fallbackJob.result
    }
    const job = await this.getOwnedJobOrThrowNotFound(id, ownerUserId)
    const status = this.normalizePersistedStatus(job.status, job.id)
    if (status === 'failed')
      throw new DomainException('backtest.job_failed', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { id, error: job.error, errorDetails: this.extractStoredFailureDetails(job.result) },
      })
    if (status !== 'succeeded' || !job.result)
      throw new DomainException('backtest.job_not_completed', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { id, status },
      })
    return job.result as unknown as BacktestReport
  }

  private async getOwnedJobOrThrowNotFound(id: string, ownerUserId: string) {
    const job = await this.prisma.backtestJob.findUnique({ where: { id } })
    if (!job || job.ownerUserId !== ownerUserId) {
      throw new DomainException('backtest.job_not_found', {
        code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    return job
  }

  private async executePersistedJob(
    id: string,
    input: BacktestRunInput,
    initialSummary: BacktestJobRecord['inputSummary'],
  ) {
    const job = await this.prisma.backtestJob.findUnique({ where: { id } })
    if (!job) return

    await this.prisma.backtestJob.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    try {
      const { resolvedSummary, result } = await this.runBacktestJob(input, initialSummary)
      const completedAt = new Date()
      await this.prisma.backtestJob.update({
        where: { id },
        data: {
          status: 'succeeded',
          inputSummary: resolvedSummary as Prisma.InputJsonValue,
          result: result as unknown as Prisma.InputJsonValue,
          error: null,
          finishedAt: completedAt,
        },
      })

      if (this.shouldWriteLastBacktestRef(input, job.conversationId, resolvedSummary.snapshotId)) {
        await this.conversationsRepo.updateLastBacktestRef({
          conversationId: job.conversationId,
          userId: job.ownerUserId,
          lastBacktestRef: {
            jobId: id,
            publishedSnapshotId: resolvedSummary.snapshotId,
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
              marketType: resolvedSummary.marketType,
            },
            completedAt,
          },
        })
      }
    } catch (error) {
      await this.prisma.backtestJob.update({
        where: { id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          result: this.buildFailureResult(error),
          finishedAt: new Date(),
        },
      })
    }
  }

  private async executeFallbackJob(id: string, input: BacktestRunInput, initialSummary: BacktestJobRecord['inputSummary']) {
    const job = this.fallbackJobs.get(id)
    if (!job) return

    job.status = 'running'
    job.startedAt = new Date().toISOString()

    try {
      const { resolvedSummary, result } = await this.runBacktestJob(input, initialSummary)
      job.status = 'succeeded'
      job.inputSummary = resolvedSummary
      job.result = result
      job.error = undefined
      job.finishedAt = new Date().toISOString()
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : String(error)
      job.errorDetails = this.extractErrorDetails(error)
      job.finishedAt = new Date().toISOString()
    }
  }

  private async runBacktestJob(
    input: BacktestRunInput,
    initialSummary: BacktestJobRecord['inputSummary'],
  ): Promise<{ resolvedSummary: BacktestJobRecord['inputSummary']; result: BacktestReport }> {
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

    const resolvedSummary: BacktestJobRecord['inputSummary'] = {
      ...initialSummary,
      appliedRange: coverage.appliedRange,
      isPartial: coverage.kind === 'partial',
    }

    const bars = await this.marketDataService.loadBars({ ...input, dataRange: coverage.appliedRange })
    if (bars.length === 0) {
      throw new DomainException('backtest.market_data_empty', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { symbols: input.symbols, fromTs: coverage.appliedRange.fromTs, toTs: coverage.appliedRange.toTs },
      })
    }
    const result = await this.runner.run({ ...input, dataRange: coverage.appliedRange, bars })
    return { resolvedSummary, result }
  }

  private toView(job: {
    id: string
    status: string
    createdAt: Date
    startedAt: Date | null
    finishedAt: Date | null
    error: string | null
    inputSummary: Prisma.JsonValue
    result?: Prisma.JsonValue | null
  }): BacktestJobView {
    const resultSummary = this.extractResultSummary(job.result)

    return {
      id: job.id,
      status: this.normalizePersistedStatus(job.status, job.id),
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
      error: job.error ?? undefined,
      errorDetails: this.extractStoredFailureDetails(job.result),
      inputSummary: job.inputSummary as unknown as BacktestJobRecord['inputSummary'],
      resultSummary,
    }
  }

  private toFallbackView(job: BacktestJobRecord): BacktestJobView {
    const resultSummary = job.result?.summary

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      errorDetails: job.errorDetails,
      inputSummary: job.inputSummary,
      resultSummary,
    }
  }

  private createInputSummary(input: BacktestRunInput): BacktestJobRecord['inputSummary'] {
    const marketType = this.readStrategyMarketType(input.strategy)
    return {
      symbols: input.symbols,
      baseTimeframe: input.baseTimeframe,
      stateTimeframes: input.stateTimeframes,
      initialCash: input.initialCash,
      leverage: typeof input.leverage === 'number' && Number.isFinite(input.leverage) ? input.leverage : null,
      marketType,
      dataRange: input.dataRange,
      requestedRange: input.dataRange,
      allowPartial: input.allowPartial === true,
      isPartial: false,
      strategyId: input.strategy.id,
      strategyInstanceId: this.readStrategyIdentity(input.strategy, 'strategyInstanceId'),
      strategyTemplateId: this.readStrategyIdentity(input.strategy, 'strategyTemplateId'),
      snapshotId: this.readStrategyMetadata(input.strategy, 'snapshotId'),
      snapshotHash: this.readStrategyMetadata(input.strategy, 'snapshotHash'),
      scriptHash: this.readStrategyMetadata(input.strategy, 'scriptHash'),
      specHash: this.readStrategyMetadata(input.strategy, 'specHash'),
    }
  }

  private readStrategyIdentity(strategy: BacktestRunInput['strategy'], key: 'strategyInstanceId' | 'strategyTemplateId'): string | undefined {
    const value = strategy[key]
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized || undefined
  }

  private readStrategyMetadata(strategy: BacktestRunInput['strategy'], key: 'snapshotId' | 'snapshotHash' | 'scriptHash' | 'specHash'): string | undefined {
    const value = (strategy as Record<string, unknown>)[key]
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized || undefined
  }

  private readStrategyMarketType(strategy: BacktestRunInput['strategy']): 'spot' | 'perp' {
    const value = strategy.params?.marketType
    return value === 'perp' ? 'perp' : 'spot'
  }

  private readConversationId(input: BacktestRunInput): string | null {
    const candidate = input.conversationId
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
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

  private normalizePersistedStatus(status: string, id: string): BacktestJobPhase {
    if (VALID_BACKTEST_JOB_PHASES.has(status as BacktestJobPhase)) {
      return status as BacktestJobPhase
    }

    throw new DomainException('backtest.job_invalid_status', {
      code: ErrorCode.DATA_CONSISTENCY_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { id, status },
    })
  }

  private isBacktestJobPersistenceUnavailable(error: unknown): boolean {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
    if (code === 'P2021' || code === 'P1001' || code === 'P1008' || code === 'P1017') {
      return true
    }

    const message = this.describeError(error).toLowerCase()
    return message.includes('backtest_jobs')
      && (message.includes('does not exist') || message.includes('relation') || message.includes('table'))
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return String(error)
  }

  private extractResultSummary(
    result: Prisma.JsonValue | null | undefined,
  ): BacktestReport['summary'] | undefined {
    if (!result || typeof result !== 'object' || !('summary' in result)) {
      return undefined
    }

    const summary = (result as { summary?: BacktestReport['summary'] }).summary
    if (!summary || typeof summary !== 'object') {
      return undefined
    }

    const openPositions = 'openPositions' in result && Array.isArray((result as { openPositions?: unknown }).openPositions)
      ? ((result as { openPositions?: Array<{ unrealizedPnl?: unknown }> }).openPositions ?? [])
      : []

    if (typeof summary.totalOpenTrades === 'number' && typeof summary.openPnl === 'number') {
      return summary
    }

    return {
      ...summary,
      totalOpenTrades: typeof summary.totalOpenTrades === 'number' ? summary.totalOpenTrades : openPositions.length,
      openPnl: typeof summary.openPnl === 'number'
        ? summary.openPnl
        : openPositions.reduce((sum, position) => sum + (typeof position?.unrealizedPnl === 'number' ? position.unrealizedPnl : 0), 0),
    }
  }

  private buildFailureResult(error: unknown): Prisma.InputJsonValue | null {
    const details = this.extractErrorDetails(error)
    if (!details) {
      return null
    }

    return JSON.parse(JSON.stringify({
      failure: details,
    })) as Prisma.InputJsonValue
  }

  private extractStoredFailureDetails(
    result: Prisma.JsonValue | null | undefined,
  ): BacktestJobErrorDetails | undefined {
    if (!result || typeof result !== 'object' || !('failure' in result)) {
      return undefined
    }

    const failure = (result as { failure?: unknown }).failure
    if (!failure || typeof failure !== 'object') {
      return undefined
    }

    const candidate = failure as Record<string, unknown>
    if (typeof candidate.message !== 'string' || !candidate.message.trim()) {
      return undefined
    }

    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: candidate.message,
      args: candidate.args && typeof candidate.args === 'object'
        ? candidate.args as Record<string, unknown>
        : undefined,
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
      return {
        message: error.message,
      }
    }

    return undefined
  }
}
