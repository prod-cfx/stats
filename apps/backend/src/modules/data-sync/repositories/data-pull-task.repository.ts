import type { DataPullTask as DataPullTaskModel } from '@prisma/client'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export type DataPullTaskStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export type DataPullTask = DataPullTaskModel

@Injectable()
export class DataPullTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /**
   * 查找「当前时刻应该被调度」的任务列表。
   *
   * 逻辑：
   * - 仅选取 enabled = true 的任务
   * - 如果 intervalSeconds 为空，则视为始终 due（由外部控制频率）
   * - 否则，要求 lastRunAt 为空或 lastRunAt 距离当前时间已超过 intervalSeconds
   */
  async findDueTasks(_now: Date): Promise<DataPullTask[]> {
    const client = this.getClient()

    const allEnabled = await client.dataPullTask.findMany({
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
    const client = this.getClient()
    return client.dataPullTask.findUnique({
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
    const client = this.getClient()
    const candidates = await this.findDueTasks(now)

    const claimed: DataPullTask[] = []

    for (const task of candidates) {
      if (claimed.length >= maxTasks) break

      const result = await client.dataPullTask.updateMany({
        where: {
          id: task.id,
          lastStatus: { not: 'RUNNING' },
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
    const client = this.getClient()
    await client.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'RUNNING',
        lastRunAt: startedAt,
        lastError: null,
      },
    })
  }

  async markSuccess(
    taskId: number,
    finishedAt: Date,
    newCursor: string | null,
    resultMeta: Record<string, any> | undefined,
  ): Promise<void> {
    const client = this.getClient()
    await client.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'SUCCESS',
        lastRunAt: finishedAt,
        lastSuccessAt: finishedAt,
        cursor: newCursor,
        lastError: null,
        meta: resultMeta ?? undefined,
      },
    })
  }

  async markFailed(taskId: number, finishedAt: Date, error: any): Promise<void> {
    const client = this.getClient()
    const message = this.truncateError(error)
    await client.dataPullTask.update({
      where: { id: taskId },
      data: {
        lastStatus: 'FAILED',
        lastRunAt: finishedAt,
        lastError: message,
      },
    })
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
}

