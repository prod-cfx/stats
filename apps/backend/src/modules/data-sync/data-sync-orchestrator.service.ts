import type { DataPullJob } from './contracts/data-pull-job'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { DATA_PULL_JOB_REGISTRY } from './data-sync.tokens'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
// eslint-disable-next-line ts/consistent-type-imports
import { DataPullTaskRepository } from './repositories/data-pull-task.repository'

@Injectable()
export class DataSyncOrchestrator {
  private readonly logger = new Logger(DataSyncOrchestrator.name)
  private readonly jobMap = new Map<string, DataPullJob>()

  constructor(
    @Inject(DATA_PULL_JOB_REGISTRY)
    jobs: DataPullJob[],
    private readonly taskRepo: DataPullTaskRepository,
    private readonly execRepo: DataPullExecutionRepository,
  ) {
    for (const job of jobs) {
      this.jobMap.set(job.key, job)
    }
  }

  /**
   * 由 Cron 周期性调用，负责：
   * - 找出当前需要执行的任务
   * - 为每个任务创建执行记录
   * - 调用对应的 Job
   * - 根据结果更新任务状态和执行历史
   */
  async runDueTasks(): Promise<void> {
    const now = new Date()
    const tasks = await this.taskRepo.claimDueTasks(now, 10)

    if (!tasks.length) {
      this.logger.debug('No due data-pull tasks')
      return
    }

    this.logger.log(`Found ${tasks.length} due data-pull tasks`)

    for (const task of tasks) {
      const job = this.jobMap.get(task.key)
      if (!job) {
        this.logger.error(`No DataPullJob implementation found for key=${task.key}`)
        continue
      }

      await this.runSingleTask(task.id, job, task.cursor)
    }
  }

  private async runSingleTask(
    taskId: number,
    job: DataPullJob,
    cursor: string | null,
  ): Promise<void> {
    const start = new Date()
    const exec = await this.execRepo.createStart(taskId, start)

    try {
      this.logger.log(`Running data-pull task key=${job.key}, cursor=${cursor ?? 'null'}`)

      const result = await job.run(cursor)

      const finished = new Date()
      await this.execRepo.markSuccess(exec.id, finished, result)
      await this.taskRepo.markSuccess(
        taskId,
        finished,
        result.newCursor ?? cursor,
        result.meta,
      )

      this.logger.log(
        `Data-pull task key=${job.key} success, fetched=${result.fetchedCount}, cursor=${result.newCursor ?? cursor}`,
      )
    } catch (error) {
      const finished = new Date()
      await this.execRepo.markFailed(exec.id, finished, error)
      await this.taskRepo.markFailed(taskId, finished, error)

      this.logger.error(
        `Data-pull task key=${job.key} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

