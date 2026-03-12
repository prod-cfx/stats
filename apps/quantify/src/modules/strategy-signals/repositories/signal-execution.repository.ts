import type { Prisma, UserSignalExecution } from '@prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { ExecutionStatus } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'

interface ExecutionUpdatePayload {
  executedPrice?: number
  executedQuantity?: number
  fee?: number
  feeCurrency?: string
  tradeId?: string
  executedAt?: Date
  positionId?: string
  metadata?: Prisma.JsonValue
}

@Injectable()
export class SignalExecutionRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(data: Prisma.UserSignalExecutionCreateInput): Promise<UserSignalExecution> {
    return this.prisma.userSignalExecution.create({ data })
  }

  async markExecuted(id: string, payload: ExecutionUpdatePayload = {}) {
    await this.prisma.userSignalExecution.update({
      where: { id },
      data: {
        status: ExecutionStatus.EXECUTED,
        executedPrice: payload.executedPrice,
        executedQuantity: payload.executedQuantity,
        fee: payload.fee,
        feeCurrency: payload.feeCurrency,
        tradeId: payload.tradeId,
        positionId: payload.positionId,
        executedAt: payload.executedAt ?? new Date(),
        metadata: payload.metadata,
        errorMessage: null,
      },
    })
  }

  async markFailed(id: string, errorMessage: string) {
    await this.prisma.userSignalExecution.update({
      where: { id },
      data: {
        status: ExecutionStatus.FAILED,
        errorMessage,
        executedAt: new Date(),
      },
    })
  }

  async markSkipped(id: string, reason: string) {
    await this.prisma.userSignalExecution.update({
      where: { id },
      data: {
        status: ExecutionStatus.SKIPPED,
        errorMessage: reason,
        executedAt: new Date(),
      },
    })
  }
}
