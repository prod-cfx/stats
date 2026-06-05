import { ErrorCode } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Interval } from '@nestjs/schedule'
import { ClsService } from 'nestjs-cls'
import { BacktestJobRepository } from './backtest-job.repository'
import { DEFAULT_BACKTEST_JOB_TIMEOUT_MS, DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS } from './backtest-queue.constants'

const BACKTEST_RECOVERY_INTERVAL_MS = 30_000

@Injectable()
export class BacktestRecoveryService {
  private readonly logger = new Logger(BacktestRecoveryService.name)
  private scheduledRecoveryRunning = false

  constructor(
    private readonly repository: BacktestJobRepository,
    private readonly config: ConfigService,
    @Optional() private readonly cls?: ClsService,
    @Optional() private readonly txHost?: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  @Interval(BACKTEST_RECOVERY_INTERVAL_MS)
  async handleScheduledRecovery(): Promise<void> {
    if (this.scheduledRecoveryRunning) {
      this.logger.warn('event=backtest_recovery_tick_skipped reason=previous_tick_running')
      return
    }

    this.scheduledRecoveryRunning = true
    try {
      if (this.cls && this.txHost) {
        await this.cls.run(async () => {
          await this.txHost!.withTransaction(async () => this.recoverStaleJobs())
        })
        return
      }

      await this.recoverStaleJobs()
    } catch (error) {
      this.logger.error(`event=backtest_recovery_tick_failed reason=${this.describeError(error)}`)
    } finally {
      this.scheduledRecoveryRunning = false
    }
  }

  async recoverStaleJobs(): Promise<void> {
    const now = Date.now()
    const jobTimeoutMs = this.readPositiveNumber('BACKTEST_JOB_TIMEOUT_MS', DEFAULT_BACKTEST_JOB_TIMEOUT_MS)
    const queueTimeoutMs = this.readPositiveNumber('BACKTEST_QUEUE_TIMEOUT_MS', DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS)

    const staleRunning = await this.repository.findStaleRunning(new Date(now - jobTimeoutMs))
    for (const job of staleRunning) {
      this.logger.warn(`event=backtest_recovery_stale_running jobId=${job.id}`)
      await this.repository.markFailedIfStatus(job.id, ['running'], {
        code: ErrorCode.BACKTEST_JOB_TIMEOUT,
        message: 'Backtest job timed out',
        finishedAt: new Date(),
      })
    }

    const staleQueued = await this.repository.findQueuedBefore(new Date(now - queueTimeoutMs))
    for (const job of staleQueued) {
      this.logger.warn(`event=backtest_recovery_stale_queued jobId=${job.id}`)
      await this.repository.markFailedIfStatus(job.id, ['queued'], {
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

  private describeError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }
}
