import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { JobRunResult } from '../contracts/data-pull-job'
import type { DataPullExecution as DataPullExecutionModel } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { formatDataPullError } from './data-pull-error-message'

export type DataPullExecutionOutcome = 'SUCCESS' | 'FAILED' | 'SKIPPED'

export type DataPullExecution = DataPullExecutionModel

@Injectable()
export class DataPullExecutionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async createStart(taskId: number, startedAt: Date): Promise<DataPullExecution> {
    return this.txHost.tx.dataPullExecution.create({
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
    await this.txHost.tx.dataPullExecution.update({
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
    const message = this.truncateError(error)
    await this.txHost.tx.dataPullExecution.update({
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
    const [total, items] = await Promise.all([
      this.txHost.tx.dataPullExecution.count({
        where: { taskId },
      }),
      this.txHost.tx.dataPullExecution.findMany({
        where: { taskId },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { total, items }
  }

  private truncateError(error: any, maxLength = 2000): string {
    return formatDataPullError(error, maxLength)
  }
}
