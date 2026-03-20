import type { BacktestReport, BacktestRunInput } from '../types/backtesting.types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { BacktestRunnerService } from '../core/backtest-runner.service'

export type BacktestJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

interface BacktestJobRecord {
  id: string
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
    strategyId: string
  }
  result?: BacktestReport
}

type BacktestJobView = Omit<BacktestJobRecord, 'result'>

@Injectable()
export class BacktestJobsService {
  private static readonly COMPLETED_JOB_RETENTION_MS = 1000 * 60 * 60 * 24
  private static readonly MAX_JOBS = 1000

  private readonly jobs = new Map<string, BacktestJobRecord>()

  constructor(private readonly runner: BacktestRunnerService) {}

  createJob(input: BacktestRunInput): BacktestJobView {
    this.pruneJobs()
    this.ensureCapacityForNewJob()

    const id = `btjob-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    const job: BacktestJobRecord = {
      id,
      status: 'queued',
      createdAt: new Date().toISOString(),
      inputSummary: {
        symbols: input.symbols,
        baseTimeframe: input.baseTimeframe,
        stateTimeframes: input.stateTimeframes,
        initialCash: input.initialCash,
        leverage: input.leverage,
        dataRange: input.dataRange,
        strategyId: input.strategy.id,
      },
    }
    this.jobs.set(id, job)
    queueMicrotask(() => this.executeJob(id, input))
    return this.toView(job)
  }

  getJob(id: string): BacktestJobView {
    const job = this.jobs.get(id)
    if (!job) throw new NotFoundException(`Backtest job not found: ${id}`)
    return this.toView(job)
  }

  getJobResult(id: string): BacktestReport {
    const job = this.jobs.get(id)
    if (!job) throw new NotFoundException(`Backtest job not found: ${id}`)
    if (job.status === 'failed') throw new ConflictException(job.error || 'Backtest job failed')
    if (job.status !== 'succeeded' || !job.result) throw new ConflictException('Backtest job is not completed')
    return job.result
  }

  private async executeJob(id: string, input: BacktestRunInput) {
    const job = this.jobs.get(id)
    if (!job) return

    job.status = 'running'
    job.startedAt = new Date().toISOString()

    try {
      const result = await this.runner.run(input)
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
      throw new ConflictException('Backtest job queue is full, please retry later')
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
