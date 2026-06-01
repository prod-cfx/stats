import type { Job } from 'bull'
import { Process, Processor } from '@nestjs/bull'
import { Injectable, Logger } from '@nestjs/common'
import { BacktestJobExecutorService } from './backtest-job-executor.service'
import { BACKTEST_QUEUE, BACKTEST_QUEUE_JOB_RUN, type BacktestQueueJobData } from './backtest-queue.constants'
import { BacktestJobsService } from './backtest-jobs.service'

@Injectable()
@Processor(BACKTEST_QUEUE)
export class BacktestWorkerProcessor {
  private readonly logger = new Logger(BacktestWorkerProcessor.name)

  constructor(
    private readonly jobsService: BacktestJobsService,
    private readonly executor: BacktestJobExecutorService,
  ) {}

  @Process(BACKTEST_QUEUE_JOB_RUN)
  async handle(job: Job<BacktestQueueJobData>): Promise<void> {
    const jobId = job.data.jobId
    this.logger.log(`event=backtest_worker_job_received jobId=${jobId}`)
    const execution = await this.jobsService.getExecutionInput(jobId)
    await this.executor.execute(jobId, execution.input, execution.inputSummary)
  }
}
