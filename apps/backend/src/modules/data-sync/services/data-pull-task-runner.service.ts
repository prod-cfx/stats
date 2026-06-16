import type { DataPullJob, DataPullJobContext } from '../contracts/data-pull-job'
import type { DataPullExecution } from '../repositories/data-pull-execution.repository'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import { Injectable } from '@nestjs/common'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { DataPullExecutionRepository } from '../repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from '../repositories/data-pull-task.repository'

export type DataPullTaskRunSuccess = Omit<
  DataPullExecution,
  'cursor' | 'errorMessage' | 'fetchedCount' | 'finishedAt' | 'meta' | 'status'
> & {
  status: 'SUCCESS'
  fetchedCount: number
  cursor: string | null
  finishedAt: Date
  errorMessage: null
  meta: Record<string, unknown> | null
}

@Injectable()
export class DataPullTaskRunnerService {
  constructor(
    private readonly taskRepo: DataPullTaskRepository,
    private readonly execRepo: DataPullExecutionRepository,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async runClaimedTask(
    task: DataPullTask,
    job: DataPullJob,
    now: Date,
  ): Promise<DataPullTaskRunSuccess> {
    const exec = await this.execRepo.createStart(task.id, now)

    try {
      const ctx: DataPullJobContext<Record<string, unknown>> = {
        taskId: task.id,
        key: task.key,
        cursor: task.cursor ?? null,
        meta: (task.meta ?? null) as Record<string, unknown> | null,
        now,
      }

      const result = await this.txEvents.withAfterCommit(() => job.run(ctx))
      const finished = new Date()

      await this.execRepo.markSuccess(exec.id, finished, result)
      await this.taskRepo.markSuccess(
        task.id,
        finished,
        result.newCursor ?? task.cursor ?? null,
        result.meta,
      )

      return {
        ...exec,
        status: 'SUCCESS',
        fetchedCount: result.fetchedCount,
        cursor: result.newCursor ?? task.cursor ?? null,
        finishedAt: finished,
        errorMessage: null,
        meta: result.meta ?? null,
      }
    } catch (error) {
      const finished = new Date()
      await this.execRepo.markFailed(exec.id, finished, error)
      await this.taskRepo.markFailed(task.id, finished, error)
      throw error
    }
  }
}
