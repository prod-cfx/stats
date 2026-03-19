import type { DataPullJob, DataPullJobContext } from './contracts/data-pull-job'
import type { DataPullTask } from './repositories/data-pull-task.repository'
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
   * 根据任务 key 查找对应的 Job 实现
   * 支持两种匹配模式：
   * 1. 精确匹配：taskKey === job.key
   * 2. 前缀匹配：taskKey 以 "job.key:" 开头（用于支持同一 Job 类型的多个任务实例）
   *
   * 例如：
   * - taskKey = "coinglass-aggregated-liquidation" 精确匹配 job.key = "coinglass-aggregated-liquidation"
   * - taskKey = "coinglass-aggregated-liquidation:BTC" 前缀匹配 job.key = "coinglass-aggregated-liquidation"
   */
  private findJobForTask(taskKey: string): DataPullJob | undefined {
    // 优先精确匹配
    const exactMatch = this.jobMap.get(taskKey)
    if (exactMatch) {
      return exactMatch
    }

    // 前缀匹配：taskKey 格式为 "jobKey:suffix"
    const colonIndex = taskKey.indexOf(':')
    if (colonIndex > 0) {
      const jobKeyPrefix = taskKey.slice(0, colonIndex)
      return this.jobMap.get(jobKeyPrefix)
    }

    return undefined
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
      const job = this.findJobForTask(task.key)
      if (!job) {
        this.logger.error(`No DataPullJob implementation found for key=${task.key}`)
        continue
      }

      await this.runSingleTask(task, job, now)
    }
  }

  private async runSingleTask(task: DataPullTask, job: DataPullJob, now: Date): Promise<void> {
    const start = new Date()
    const exec = await this.execRepo.createStart(task.id, start)

    try {
      const ctx: DataPullJobContext = {
        taskId: task.id,
        key: task.key,
        cursor: task.cursor ?? null,
        meta: (task.meta ?? null) as any,
        now,
      }

      this.logger.log(
        `Running data-pull task key=${job.key}, cursor=${ctx.cursor ?? 'null'}`,
      )

      const result = await job.run(ctx)

      const finished = new Date()
      await this.execRepo.markSuccess(exec.id, finished, result)
      await this.taskRepo.markSuccess(
        task.id,
        finished,
        result.newCursor ?? task.cursor,
        result.meta,
      )

      this.logger.log(
        `Data-pull task key=${job.key} success, fetched=${result.fetchedCount}, cursor=${result.newCursor ?? task.cursor}`,
      )
    } catch (error) {
      const finished = new Date()
      await this.execRepo.markFailed(exec.id, finished, error)
      await this.taskRepo.markFailed(task.id, finished, error)

      this.logger.error(
        `Data-pull task key=${job.key} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

