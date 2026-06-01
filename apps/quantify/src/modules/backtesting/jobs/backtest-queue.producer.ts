import type { Queue } from 'bull'
import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { ConfigService } from '@nestjs/config'
import {
  BACKTEST_QUEUE,
  BACKTEST_QUEUE_JOB_RUN,
  DEFAULT_BACKTEST_JOB_TIMEOUT_MS,
} from './backtest-queue.constants'

@Injectable()
export class BacktestQueueProducer {
  constructor(
    @InjectQueue(BACKTEST_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async enqueue(jobId: string): Promise<string> {
    const timeout = this.config.get<number>('BACKTEST_JOB_TIMEOUT_MS', DEFAULT_BACKTEST_JOB_TIMEOUT_MS)
      ?? DEFAULT_BACKTEST_JOB_TIMEOUT_MS
    const job = await this.queue.add(
      BACKTEST_QUEUE_JOB_RUN,
      { jobId },
      {
        jobId,
        attempts: 1,
        timeout,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    return String(job.id)
  }
}
