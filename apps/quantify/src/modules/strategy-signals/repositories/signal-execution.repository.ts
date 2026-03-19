import type { Prisma, UserSignalExecution } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import type { ExecutionStage } from '@/modules/trading/core/execution-stage'
import { PrismaService } from '@/prisma/prisma.service'

import { ExecutionStatus } from '@/prisma/prisma.types'

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

interface ExecutionStageMetadata extends Prisma.JsonObject {
  stage?: ExecutionStage
  stageHistory?: Prisma.JsonArray
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

  async markStage(id: string, stage: ExecutionStage, metadataPatch: Prisma.JsonObject = {}) {
    const existing = await this.prisma.userSignalExecution.findUnique({
      where: { id },
      select: { metadata: true },
    })

    const current = this.asExecutionMetadata(existing?.metadata)
    const currentHistory = Array.isArray(current.stageHistory) ? current.stageHistory : []
    const nextMetadata: Prisma.JsonObject = {
      ...current,
      ...metadataPatch,
      stage,
      stageHistory: [
        ...currentHistory,
        {
          stage,
          at: new Date().toISOString(),
        },
      ] as Prisma.JsonArray,
    }

    await this.prisma.userSignalExecution.update({
      where: { id },
      data: {
        metadata: nextMetadata,
      },
    })
  }

  async markExecuted(id: string, payload: ExecutionUpdatePayload = {}) {
    const existing = await this.prisma.userSignalExecution.findUnique({
      where: { id },
      select: { metadata: true },
    })
    const current = this.asExecutionMetadata(existing?.metadata)
    const nextMetadata
      = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? {
            ...current,
            ...(payload.metadata as Prisma.JsonObject),
          }
        : current

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
        metadata: nextMetadata,
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

  private asExecutionMetadata(metadata: Prisma.JsonValue | null | undefined): ExecutionStageMetadata {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      return {}
    }

    return metadata as ExecutionStageMetadata
  }
}
