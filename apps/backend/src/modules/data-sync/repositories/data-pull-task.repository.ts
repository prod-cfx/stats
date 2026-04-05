import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { DataPullTask as DataPullTaskModel } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export type DataPullTaskRunState = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export type DataPullTask = DataPullTaskModel

@Injectable()
export class DataPullTaskRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  /**
   * 查找「当前时刻应该被调度」的任务列表。
   *
   * 逻辑：
   * - 仅选取 enabled = true 的任务
   * - 如果 intervalSeconds 为空，则视为始终 due（由外部控制频率）
   * - 否则，要求 lastRunAt 为空或 lastRunAt 距离当前时间已超过 intervalSeconds
   */
  async findDueTasks(_now: Date): Promise<DataPullTask[]> {

    const allEnabled = await this.txHost.tx.dataPullTask.findMany({
      where: {
        enabled: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    const now = _now.getTime()

    return allEnabled.filter((task) => {
      if (task.intervalSeconds == null) {
        // 没有配置 interval 时，交由外部统一 Cron 控制频率
        return true
      }

      if (!task.lastRunAt) {
        return true
      }

      const intervalMs = task.intervalSeconds * 1000
      return now - task.lastRunAt.getTime() >= intervalMs
    })
  }

  async findByKey(key: string): Promise<DataPullTask | null> {
    return this.txHost.tx.dataPullTask.findUnique({
      where: { key },
    })
  }

  /**
   * 原子性地“抢占”一批 due 任务，避免多实例重复执行同一任务。
   *
   * 实现思路（乐观并发控制）：
   * - 先用 findDueTasks 计算候选任务列表
   * - 针对每个候选任务，使用 updateMany(where: { id, lastStatus != RUNNING }) 进行抢占
   * - 只有 count === 1 的更新才视为当前实例成功 claim
   */
  async claimDueTasks(now: Date, maxTasks = 10): Promise<DataPullTask[]> {
    const candidates = await this.findDueTasks(now)

    const claimed: DataPullTask[] = []

    for (const task of candidates) {
      if (claimed.length >= maxTasks) break

      const result = await this.txHost.tx.dataPullTask.updateMany({
        where: {
          id: task.id,
          // 显式处理 null：lastStatus 为 null 或不等于 'RUNNING'
          OR: [
            { lastStatus: null },
            { lastStatus: { not: 'RUNNING' } },
          ],
        },
        data: {
          lastStatus: 'RUNNING',
          lastRunAt: now,
          lastError: null,
        },
      })

      if (result.count === 1) {
        claimed.push({
          ...task,
          lastStatus: 'RUNNING',
          lastRunAt: now,
          lastError: null,
        })
      }
    }

    return claimed
  }

  async markRunning(taskId: number, startedAt: Date): Promise<void> {
    await this.txHost.tx.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'RUNNING',
        lastRunAt: startedAt,
        lastError: null,
      },
    })
  }

  /**
   * 尝试以乐观锁的方式将单个任务标记为 RUNNING。
   *
   * - 仅当当前 lastStatus 不是 RUNNING（或为 null）时，才会成功更新
   * - 返回 true 表示本次调用成功“抢占”到了该任务
   * - 返回 false 表示任务已在运行中，或被其他实例/请求抢占
   */
  async tryMarkRunningOnce(taskId: number, startedAt: Date): Promise<boolean> {
    const result = await this.txHost.tx.dataPullTask.updateMany({
      where: {
        id: taskId,
        OR: [
          { lastStatus: null },
          { lastStatus: { not: 'RUNNING' } },
        ],
      },
      data: {
        lastStatus: 'RUNNING',
        lastRunAt: startedAt,
        lastError: null,
      },
    })

    return result.count === 1
  }

  async markSuccess(
    taskId: number,
    finishedAt: Date,
    newCursor: string | null,
    _resultMeta: Record<string, any> | undefined,
  ): Promise<void> {
    await this.txHost.tx.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'SUCCESS',
        lastRunAt: finishedAt,
        lastSuccessAt: finishedAt,
        cursor: newCursor,
        lastError: null,
      },
    })
  }

  async markFailed(taskId: number, finishedAt: Date, error: any): Promise<void> {
    const message = this.truncateError(error)
    await this.txHost.tx.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'FAILED',
        lastRunAt: finishedAt,
        lastError: message,
      },
    })
  }

  /**
   * 强制重置任务状态（用于中断卡住的任务）
   * 仅当 lastStatus 为 RUNNING 时才会重置
   * @returns true 表示成功重置，false 表示任务不在 RUNNING 状态
   */
  async forceResetStatus(taskId: number): Promise<boolean> {
    const result = await this.txHost.tx.dataPullTask.updateMany({
      where: {
        id: taskId,
        lastStatus: 'RUNNING',
      },
      data: {
        lastStatus: 'IDLE',
        lastError: '任务被管理员手动中断',
      },
    })
    return result.count === 1
  }

  private truncateError(error: any, maxLength = 1000): string {
    const raw =
      typeof error === 'string'
        ? error
        : error?.message
          ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
          : JSON.stringify(error)

    const sanitized = this.sanitizeError(raw)

    if (sanitized.length <= maxLength) return sanitized
    return `${sanitized.slice(0, maxLength)}...`
  }

  /**
   * 对常见敏感信息（apiKey、Authorization 等）做简单脱敏，避免直接落库。
   */
  private sanitizeError(input: string): string {
    let result = input

    // 掩码形如 apiKey=xxxx / api_key=xxxx
    result = result.replace(
      /(api[_-]?key)\s*=\s*([^\s&]+)/gi,
      (_match, p1) => `${p1}=***`,
    )

    // 掩码 Authorization: Bearer xxx
    result = result.replace(
      /(Authorization:\s*Bearer\s+)\S+/gi,
      '$1***',
    )

    return result
  }

  // ===== 管理后台使用的通用 CRUD 能力 =====

  async findById(id: number): Promise<DataPullTask | null> {
    return this.txHost.tx.dataPullTask.findUnique({
      where: { id },
    })
  }

  async listTasks(params: {
    page: number
    limit: number
    key?: string
    name?: string
    enabled?: boolean
  }): Promise<{ total: number; items: DataPullTask[] }> {
    const { page, limit, key, name, enabled } = params
    const where: Record<string, any> = {}

    if (key) {
      where.key = {
        contains: key,
        mode: 'insensitive',
      }
    }

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    if (typeof enabled === 'boolean') {
      where.enabled = enabled
    }

    const [total, items] = await Promise.all([
      this.txHost.tx.dataPullTask.count({ where }),
      this.txHost.tx.dataPullTask.findMany({
        where,
        orderBy: {
          id: 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { total, items }
  }

  async createTask(payload: {
    key: string
    name: string
    source?: string
    type?: string
    cron?: string
    intervalSeconds?: number | null
    enabled?: boolean
    cursor?: string | null
    /**
     * 任务级自定义配置参数，将直接写入 data_pull_tasks.meta（Json）
     */
    meta?: Record<string, any> | null
  }): Promise<DataPullTask> {
    return this.txHost.tx.dataPullTask.create({
      data: {
        key: payload.key,
        name: payload.name,
        source: payload.source,
        type: payload.type,
        cron: payload.cron,
        intervalSeconds: payload.intervalSeconds ?? null,
        enabled: payload.enabled ?? true,
        cursor: payload.cursor ?? null,
        meta: payload.meta ?? undefined,
      },
    })
  }

  async updateTask(
    id: number,
    payload: {
      name?: string
      source?: string | null
      type?: string | null
      cron?: string | null
      intervalSeconds?: number | null
      enabled?: boolean
      cursor?: string | null
      /**
       * 任务级自定义配置参数，将直接写入 data_pull_tasks.meta（Json）
       */
      meta?: Record<string, any> | null
    },
  ): Promise<DataPullTask> {
    return this.txHost.tx.dataPullTask.update({
      where: { id },
      data: {
        ...payload,
      },
    })
  }

  async deleteTask(id: number): Promise<void> {
    // 级联删除：先删除执行记录再删除任务（事务由上层 @Transactional 保证）
    await this.txHost.tx.dataPullExecution.deleteMany({
      where: { taskId: id },
    })
    await this.txHost.tx.dataPullTask.delete({
      where: { id },
    })
  }
}
