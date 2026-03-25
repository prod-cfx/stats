import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { Injectable, HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
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

type BacktestJobView = Omit<BacktestJobRecord, 'result' | 'ownerUserId'>

@Injectable()
export class BacktestJobsService {
  private static readonly COMPLETED_JOB_RETENTION_MS = 1000 * 60 * 60 * 24
  private static readonly MAX_JOBS = 1000

  private readonly jobs = new Map<string, BacktestJobRecord>()

  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly marketDataService: BacktestMarketDataService,
  ) {}

  createJob(input: BacktestRunInput, ownerUserId: string): BacktestJobView {
    this.pruneJobs()
    this.ensureCapacityForNewJob()

    const id = `btjob-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    const job: BacktestJobRecord = {
      id,
      ownerUserId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      inputSummary: {
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
      },
    }
    this.jobs.set(id, job)
    queueMicrotask(() => this.executeJob(id, input))
    return this.toView(job)
  }

  getJob(id: string, ownerUserId: string): BacktestJobView {
    const job = this.getOwnedJobOrThrowNotFound(id, ownerUserId)
    return this.toView(job)
  }

  getJobResult(id: string, ownerUserId: string): BacktestReport {
    const job = this.getOwnedJobOrThrowNotFound(id, ownerUserId)
    if (job.status === 'failed') throw new DomainException('backtest.job_failed', { code: ErrorCode.BACKTEST_JOB_CONFLICT, status: HttpStatus.CONFLICT, args: { id, error: job.error } })
    if (job.status !== 'succeeded' || !job.result) throw new DomainException('backtest.job_not_completed', { code: ErrorCode.BACKTEST_JOB_CONFLICT, status: HttpStatus.CONFLICT, args: { id, status: job.status } })
    return job.result
  }

  private getOwnedJobOrThrowNotFound(id: string, ownerUserId: string): BacktestJobRecord {
    const job = this.jobs.get(id)
    if (!job || job.ownerUserId !== ownerUserId) {
      throw new DomainException('backtest.job_not_found', {
        code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    return job
  }

  private async executeJob(id: string, input: BacktestRunInput) {
    const job = this.jobs.get(id)
    if (!job) return

    job.status = 'running'
    job.startedAt = new Date().toISOString()

    try {
      const coverage = await this.marketDataService.resolveCoverage(input)
      if (coverage.kind === 'empty' || !coverage.appliedRange) {
        throw new DomainException('backtest.market_data_empty', {
          code: ErrorCode.BACKTEST_JOB_CONFLICT,
          status: HttpStatus.CONFLICT,
          args: { symbols: input.symbols, fromTs: input.dataRange.fromTs, toTs: input.dataRange.toTs },
        })
      }
      if (coverage.kind === 'partial' && input.allowPartial === false) {
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

      job.inputSummary.appliedRange = coverage.appliedRange
      job.inputSummary.isPartial = coverage.kind === 'partial'

      const bars = await this.marketDataService.loadBars({ ...input, dataRange: coverage.appliedRange })
      if (bars.length === 0) {
        throw new DomainException('backtest.market_data_empty', {
          code: ErrorCode.BACKTEST_JOB_CONFLICT,
          status: HttpStatus.CONFLICT,
          args: { symbols: input.symbols, fromTs: coverage.appliedRange.fromTs, toTs: coverage.appliedRange.toTs },
        })
      }
      const result = await this.runner.run({ ...input, dataRange: coverage.appliedRange, bars })
      job.status = 'succeeded'
      job.result = result
      job.finishedAt = new Date().toISOString()
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : String(error)
      job.finishedAt = new Date().toISOString()
    }
  }

  private toView(job: BacktestJobRecord): BacktestJobView {
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      inputSummary: job.inputSummary,
    }
  }

  private pruneJobs() {
    const now = Date.now()
    for (const [id, job] of this.jobs) {
      if (!job.finishedAt) continue
      const finishedAtMs = Date.parse(job.finishedAt)
      if (Number.isNaN(finishedAtMs)) continue
      if (now - finishedAtMs > BacktestJobsService.COMPLETED_JOB_RETENTION_MS) {
        this.jobs.delete(id)
      }
    }
  }

  private ensureCapacityForNewJob() {
    if (this.jobs.size < BacktestJobsService.MAX_JOBS) return
    const targetSize = BacktestJobsService.MAX_JOBS - 1
    this.evictCompletedJobs(targetSize)
    if (this.jobs.size > targetSize) {
      throw new DomainException('backtest.job_queue_full', { code: ErrorCode.BACKTEST_JOB_CONFLICT, status: HttpStatus.CONFLICT })
    }
  }

  private evictCompletedJobs(targetSize: number) {
    if (this.jobs.size <= targetSize) return
    for (const [id, job] of this.jobs) {
      if (this.jobs.size <= targetSize) break
      if (job.status === 'queued' || job.status === 'running') continue
      this.jobs.delete(id)
    }
  }
}
