import { ErrorCode } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BacktestJobRepository } from './backtest-job.repository'
import { DEFAULT_BACKTEST_JOB_TIMEOUT_MS, DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS } from './backtest-queue.constants'

@Injectable()
export class BacktestRecoveryService {
  private readonly logger = new Logger(BacktestRecoveryService.name)

  constructor(
    private readonly repository: BacktestJobRepository,
    private readonly config: ConfigService,
  ) {}

  async recoverStaleJobs(): Promise<void> {
    const now = Date.now()
    const jobTimeoutMs = this.readPositiveNumber('BACKTEST_JOB_TIMEOUT_MS', DEFAULT_BACKTEST_JOB_TIMEOUT_MS)
    const queueTimeoutMs = this.readPositiveNumber('BACKTEST_QUEUE_TIMEOUT_MS', DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS)

    const staleRunning = await this.repository.findStaleRunning(new Date(now - jobTimeoutMs))
    for (const job of staleRunning) {
      this.logger.warn(`event=backtest_recovery_stale_running jobId=${job.id}`)
      await this.repository.markFailed(job.id, {
        code: ErrorCode.BACKTEST_JOB_TIMEOUT,
        message: 'Backtest job timed out',
        finishedAt: new Date(),
      })
    }

    const staleQueued = await this.repository.findQueuedBefore(new Date(now - queueTimeoutMs))
    for (const job of staleQueued) {
      this.logger.warn(`event=backtest_recovery_stale_queued jobId=${job.id}`)
      await this.repository.markFailed(job.id, {
        code: ErrorCode.BACKTEST_QUEUE_TIMEOUT,
        message: 'Backtest queue wait timed out',
        finishedAt: new Date(),
      })
    }
  }

  private readPositiveNumber(key: string, fallback: number): number {
    const raw = this.config.get<number | string>(key)
    if (raw === undefined || raw === null || raw === '') return fallback
    const parsed = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
}
