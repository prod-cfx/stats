import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable, HttpStatus, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from '../core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataService } from '../services/backtest-market-data.service'

export type BacktestJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

interface BacktestJobRecord {
  id: string
  ownerUserId: string
  status: BacktestJobStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  inputSummary: {
    symbols: string[]
    baseTimeframe: BacktestRunInput['baseTimeframe']
    stateTimeframes: BacktestRunInput['stateTimeframes']
    initialCash: number
    leverage: number
    dataRange: BacktestRunInput['dataRange']
    requestedRange: BacktestRunInput['dataRange']
    appliedRange?: BacktestRunInput['dataRange']
    allowPartial: boolean
    isPartial: boolean
    strategyId: string
  }
  result?: BacktestReport
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
    private readonly prisma: PrismaService,
  ) {}

  async createJob(input: BacktestRunInput, ownerUserId: string): Promise<BacktestJobView> {
    const id = `btjob-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    const inputSummary = this.createInputSummary(input)
    try {
      const job = await this.prisma.backtestJob.create({
        data: {
          id,
          ownerUserId,
          status: 'queued',
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
    if (job.status === 'failed')
      throw new DomainException('backtest.job_failed', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { id, error: job.error },
      })
    if (job.status !== 'succeeded' || !job.result)
      throw new DomainException('backtest.job_not_completed', {
        code: ErrorCode.BACKTEST_JOB_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { id, status: job.status },
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
      await this.prisma.backtestJob.update({
        where: { id },
        data: {
          status: 'succeeded',
          inputSummary: resolvedSummary as Prisma.InputJsonValue,
          result: result as unknown as Prisma.InputJsonValue,
          error: null,
          finishedAt: new Date(),
        },
      })
    } catch (error) {
      await this.prisma.backtestJob.update({
        where: { id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
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
    status: BacktestJobStatus
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
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
      error: job.error ?? undefined,
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
      inputSummary: job.inputSummary,
      resultSummary,
    }
  }

  private createInputSummary(input: BacktestRunInput): BacktestJobRecord['inputSummary'] {
    return {
      symbols: input.symbols,
      baseTimeframe: input.baseTimeframe,
      stateTimeframes: input.stateTimeframes,
      initialCash: input.initialCash,
      leverage: input.leverage,
      dataRange: input.dataRange,
      requestedRange: input.dataRange,
      allowPartial: input.allowPartial === true,
      isPartial: false,
      strategyId: input.strategy.id,
    }
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
    return summary && typeof summary === 'object' ? summary : undefined
  }
}
