import type { DataPullExecution as DataPullExecutionModel } from '@prisma/client'
import type { JobRunResult } from '../contracts/data-pull-job'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export type DataPullExecutionStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED'

export type DataPullExecution = DataPullExecutionModel

@Injectable()
export class DataPullExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async createStart(taskId: number, startedAt: Date): Promise<DataPullExecution> {
    const client = this.getClient()
    return client.dataPullExecution.create({
      data: {
        taskId,
        startedAt,
        status: 'SKIPPED', // 先占位，后续会被成功/失败覆盖
      },
    })
  }

  async markSuccess(
    executionId: number,
    finishedAt: Date,
    result: JobRunResult,
  ): Promise<void> {
    const client = this.getClient()
    await client.dataPullExecution.update({
      where: { id: executionId },
      data: {
        finishedAt,
        status: 'SUCCESS',
        fetchedCount: result.fetchedCount,
        errorMessage: null,
        meta: result.meta ?? undefined,
      },
    })
  }

  async markFailed(executionId: number, finishedAt: Date, error: any): Promise<void> {
    const client = this.getClient()
    const message = this.truncateError(error)
    await client.dataPullExecution.update({
      where: { id: executionId },
      data: {
        finishedAt,
        status: 'FAILED',
        errorMessage: message,
      },
    })
  }

  /**
   * 按任务 ID 分页查询执行历史（按 id 倒序）
   */
  async listByTaskId(taskId: number, page: number, limit: number): Promise<{
    total: number
    items: DataPullExecution[]
  }> {
    const client = this.getClient()
    const [total, items] = await client.$transaction([
      client.dataPullExecution.count({
        where: { taskId },
      }),
      client.dataPullExecution.findMany({
        where: { taskId },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { total, items }
  }

  private truncateError(error: any, maxLength = 2000): string {
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

    result = result.replace(
      /(api[_-]?key)\s*=\s*([^\s&]+)/gi,
      (_match, p1) => `${p1}=***`,
    )

    result = result.replace(
      /(Authorization:\s*Bearer\s+)\S+/gi,
      '$1***',
    )

    return result
  }
}

