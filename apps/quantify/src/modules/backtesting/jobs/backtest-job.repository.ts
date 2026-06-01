import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { Prisma, PrismaClient } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'

export interface BacktestJobFailureInput {
  code?: string
  message: string
  args?: Record<string, unknown>
  finishedAt: Date
}

@Injectable()
export class BacktestJobRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  private getClient() {
    return this.txHost.tx
  }

  create(data: Prisma.BacktestJobUncheckedCreateInput) {
    return this.getClient().backtestJob.create({ data })
  }

  findById(id: string) {
    return this.getClient().backtestJob.findUnique({ where: { id } })
  }

  findOwnedById(id: string, ownerUserId: string) {
    return this.getClient().backtestJob.findFirst({ where: { id, ownerUserId } })
  }

  async markRunning(id: string, startedAt: Date) {
    const result = await this.getClient().backtestJob.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'running', startedAt },
    })
    if (result.count !== 1) return null
    return this.findById(id)
  }

  markSucceeded(id: string, input: {
    inputSummary: Prisma.InputJsonValue
    result: Prisma.InputJsonValue
    finishedAt: Date
  }) {
    return this.getClient().backtestJob.update({
      where: { id },
      data: {
        status: 'succeeded',
        inputSummary: input.inputSummary,
        result: input.result,
        error: null,
        finishedAt: input.finishedAt,
      },
    })
  }

  markFailed(id: string, input: BacktestJobFailureInput) {
    const failure: Record<string, unknown> = {
      message: input.message,
    }
    if (input.code) failure.code = input.code
    if (input.args) failure.args = input.args

    return this.getClient().backtestJob.update({
      where: { id },
      data: {
        status: 'failed',
        error: input.message,
        result: { failure } as Prisma.InputJsonValue,
        finishedAt: input.finishedAt,
      },
    })
  }

  findStaleRunning(cutoff: Date, limit = 100) {
    return this.getClient().backtestJob.findMany({
      where: { status: 'running', startedAt: { lt: cutoff } },
      orderBy: { startedAt: 'asc' },
      take: limit,
    })
  }

  findQueuedBefore(cutoff: Date, limit = 100) {
    return this.getClient().backtestJob.findMany({
      where: { status: 'queued', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }
}
