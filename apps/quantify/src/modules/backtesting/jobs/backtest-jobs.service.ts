import type { BacktestSymbolAvailabilityResult } from '../services/backtest-symbol-availability.service'
import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import type { AiQuantConversationBacktestDraftConfigRecord } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
import { getMarketTimeframeMs } from '@/modules/market-data/utils/market-timeframe.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSymbolAvailabilityService } from '../services/backtest-symbol-availability.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSnapshotLoaderService } from '../services/backtest-snapshot-loader.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobRepository } from './backtest-job.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestQueueProducer } from './backtest-queue.producer'
import { DEFAULT_BACKTEST_JOB_TIMEOUT_MS, DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS } from './backtest-queue.constants'

interface LastBacktestRangeConfig {
  preset: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'
  startAt?: string
  endAt?: string
}

export type BacktestJobPhase = 'queued' | 'running' | 'succeeded' | 'failed'

const VALID_BACKTEST_JOB_PHASES = new Set<BacktestJobPhase>([
  'queued',
  'running',
  'succeeded',
  'failed',
])

const PRESET_RANGE_DAYS: Record<Exclude<LastBacktestRangeConfig['preset'], 'CUSTOM'>, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
}

const DAY_MS = 24 * 60 * 60 * 1000

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
    requestedRangeInput?: BacktestRunInput['requestedRangeInput']
    appliedRange?: BacktestRunInput['dataRange']
    allowPartial: boolean
    isPartial: boolean
    execution: BacktestRunInput['execution']
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

type PersistedBacktestJob = NonNullable<Awaited<ReturnType<BacktestJobRepository['findById']>>>

@Injectable()
export class BacktestJobsService {
  constructor(
    private readonly symbolAvailabilityService: BacktestSymbolAvailabilityService,
    private readonly conversationsRepo: AiQuantConversationsRepository,
    private readonly jobsRepository: BacktestJobRepository,
    private readonly queueProducer: BacktestQueueProducer,
    private readonly snapshotLoader: BacktestSnapshotLoaderService,
    private readonly config: ConfigService,
  ) {}

  async createJob(input: BacktestRunInput, ownerUserId: string): Promise<BacktestJobView> {
    const resolvedInput = this.resolveRequestedPresetRange(input)
    await this.validateSymbolAvailability(resolvedInput)
    const conversationId = this.readConversationId(resolvedInput)
    await this.validateConversationOwnership(conversationId, ownerUserId)
    await this.writeBacktestDraftConfigIfEligible({
      input: resolvedInput,
      ownerUserId,
      conversationId,
    })
    const id = `btjob-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    const inputSummary = this.createInputSummary(resolvedInput)
    const job = await this.jobsRepository.create({
      id,
      ownerUserId,
      conversationId,
      status: 'queued',
      snapshotId: inputSummary.snapshotId ?? null,
      snapshotHash: inputSummary.snapshotHash ?? null,
      scriptHash: inputSummary.scriptHash ?? null,
      specHash: inputSummary.specHash ?? null,
      inputSummary: inputSummary as unknown as Prisma.InputJsonValue,
    })

    try {
      await this.queueProducer.enqueue(job.id)
    } catch (error) {
      const reasonMessage = this.describeError(error)
      await this.jobsRepository.markFailed(job.id, {
        code: ErrorCode.BACKTEST_QUEUE_UNAVAILABLE,
        message: 'Backtest queue unavailable',
        args: { reasonMessage },
        finishedAt: new Date(),
      })
      throw new DomainException('backtest.queue_unavailable', {
        code: ErrorCode.BACKTEST_QUEUE_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: { reasonMessage },
      })
    }

    return this.toView(job)
  }

  private resolveRequestedPresetRange(input: BacktestRunInput): BacktestRunInput {
    const requestedRangeInput = input.requestedRangeInput
    if (!requestedRangeInput || requestedRangeInput.preset === 'CUSTOM') {
      return input
    }

    const presetDays = PRESET_RANGE_DAYS[requestedRangeInput.preset]
    const timeframeMs = getMarketTimeframeMs(input.baseTimeframe)
    const currentBoundary = Math.floor(Date.now() / timeframeMs) * timeframeMs
    const toTs = currentBoundary - timeframeMs
    const fromTs = toTs - presetDays * DAY_MS

    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || fromTs >= toTs) {
      return input
    }

    return {
      ...input,
      dataRange: { fromTs, toTs },
    }
  }

  private async validateConversationOwnership(
    conversationId: string | null,
    ownerUserId: string,
  ): Promise<void> {
    if (!conversationId) {
      return
    }

    const isOwnedConversation = await this.conversationsRepo.existsActiveConversationForUser(
      conversationId,
      ownerUserId,
    )
    if (isOwnedConversation) {
      return
    }

    throw new DomainException('backtest.invalid_conversation_id', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { conversationId },
    })
  }

  private async validateSymbolAvailability(input: BacktestRunInput): Promise<void> {
    if (input.strategy.bindingSource !== 'PUBLISHED_SNAPSHOT_STRICT') {
      return
    }
    // Snapshot loader 已 strict parse 这四个字段；这里再 runtime guard 兜住「loader 契约
    // 被绕过 / 上游协议演进」的极端情况，让 missing 报到 snapshot_params_missing 而不是
    // 把 undefined 透传给下游 availability check 制造误导性报错。
    const params = input.strategy.params as Record<string, unknown>
    const exchange = typeof params.exchange === 'string' ? params.exchange : ''
    const symbol = typeof params.symbol === 'string' ? params.symbol : ''
    const baseTimeframe = typeof params.timeframe === 'string' ? params.timeframe : ''
    const marketType = params.marketType === 'spot' || params.marketType === 'perp' ? params.marketType : null
    const missingFields = [
      !exchange ? 'exchange' : null,
      !symbol ? 'symbol' : null,
      !baseTimeframe ? 'timeframe' : null,
      !marketType ? 'marketType' : null,
    ].filter((field): field is string => field !== null)
    if (missingFields.length > 0) {
      const snapshotId = this.readStrategyMetadata(input.strategy, 'snapshotId')
      throw new DomainException('backtest.snapshot_params_missing', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          ...(snapshotId ? { snapshotId } : {}),
          missingFields,
        },
      })
    }
    const availability = await this.symbolAvailabilityService.check({
      exchange,
      symbol,
      baseTimeframe,
      marketType,
    })
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
    const job = await this.reconcileStaleJobOnRead(
      await this.getOwnedJobOrThrowNotFound(id, ownerUserId),
    )
    return this.toView(job)
  }

  async getJobResult(id: string, ownerUserId: string): Promise<BacktestReport> {
    const job = await this.reconcileStaleJobOnRead(
      await this.getOwnedJobOrThrowNotFound(id, ownerUserId),
    )
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

  async getExecutionInput(id: string): Promise<{
    input: BacktestRunInput
    inputSummary: BacktestJobRecord['inputSummary']
  }> {
    const job = await this.jobsRepository.findById(id)
    if (!job) {
      throw new DomainException('backtest.job_not_found', {
        code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }

    const inputSummary = job.inputSummary as unknown as BacktestJobRecord['inputSummary']
    const publishedSnapshotId = inputSummary.publishedSnapshotId ?? inputSummary.snapshotId
    if (!publishedSnapshotId) {
      throw new DomainException('backtest.snapshot_required', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { id },
      })
    }

    const strategy = await this.snapshotLoader.load({
      id: inputSummary.strategyId,
      protocolVersion: 'v1',
      publishedSnapshotId,
      userId: job.ownerUserId,
    })

    return {
      inputSummary,
      input: {
        symbols: inputSummary.symbols,
        baseTimeframe: inputSummary.baseTimeframe,
        stateTimeframes: inputSummary.stateTimeframes,
        conversationId: inputSummary.conversationId,
        sessionId: inputSummary.sessionId,
        allowPartial: inputSummary.allowPartial,
        initialCash: inputSummary.initialCash,
        leverage: inputSummary.leverage,
        execution: inputSummary.execution,
        strategy,
        requestedRangeInput: inputSummary.requestedRangeInput,
        dataRange: inputSummary.dataRange,
        bars: [],
      },
    }
  }

  private async getOwnedJobOrThrowNotFound(id: string, ownerUserId: string) {
    const job = await this.jobsRepository.findById(id)
    if (!job || job.ownerUserId !== ownerUserId) {
      throw new DomainException('backtest.job_not_found', {
        code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    return job
  }

  private async reconcileStaleJobOnRead(job: PersistedBacktestJob): Promise<PersistedBacktestJob> {
    const now = Date.now()
    if (job.status === 'queued') {
      const queueTimeoutMs = this.readPositiveNumber('BACKTEST_QUEUE_TIMEOUT_MS', DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS)
      if (job.createdAt.getTime() <= now - queueTimeoutMs) {
        return await this.jobsRepository.markFailed(job.id, {
          code: ErrorCode.BACKTEST_QUEUE_TIMEOUT,
          message: 'Backtest queue wait timed out',
          finishedAt: new Date(now),
        })
      }
    }

    if (job.status === 'running' && job.startedAt) {
      const jobTimeoutMs = this.readPositiveNumber('BACKTEST_JOB_TIMEOUT_MS', DEFAULT_BACKTEST_JOB_TIMEOUT_MS)
      if (job.startedAt.getTime() <= now - jobTimeoutMs) {
        return await this.jobsRepository.markFailed(job.id, {
          code: ErrorCode.BACKTEST_JOB_TIMEOUT,
          message: 'Backtest job timed out',
          finishedAt: new Date(now),
        })
      }
    }

    return job
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
      requestedRangeInput: input.requestedRangeInput,
      allowPartial: input.allowPartial === true,
      isPartial: false,
      execution: input.execution,
      strategyId: input.strategy.id,
      strategyInstanceId: this.readStrategyIdentity(input.strategy, 'strategyInstanceId'),
      strategyTemplateId: this.readStrategyIdentity(input.strategy, 'strategyTemplateId'),
      conversationId: this.readInputConversationId(input),
      sessionId: this.readInputSessionId(input),
      publishedSnapshotId: this.readStrategyMetadata(input.strategy, 'snapshotId'),
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

  private readInputConversationId(input: BacktestRunInput): string | undefined {
    const candidate = input.conversationId
    if (typeof candidate !== 'string') return undefined
    const normalized = candidate.trim()
    return normalized || undefined
  }

  private readInputSessionId(input: BacktestRunInput): string | undefined {
    const candidate = input.sessionId
    if (typeof candidate !== 'string') return undefined
    const normalized = candidate.trim()
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

  private async writeBacktestDraftConfigIfEligible(params: {
    input: BacktestRunInput
    ownerUserId: string
    conversationId: string | null
  }): Promise<void> {
    const { input, ownerUserId, conversationId } = params
    if (input.strategy.bindingSource !== 'PUBLISHED_SNAPSHOT_STRICT' || !conversationId) {
      return
    }

    await this.conversationsRepo.updateBacktestDraftConfig({
      conversationId,
      userId: ownerUserId,
      backtestDraftConfig: this.buildBacktestDraftConfig(input),
    })
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
      const base = {
        preset: requestedRangeInput.preset,
      } as LastBacktestRangeConfig
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

  private readPositiveNumber(key: string, fallback: number): number {
    const raw = this.config.get<number | string>(key)
    if (raw === undefined || raw === null || raw === '') return fallback
    const parsed = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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

}
