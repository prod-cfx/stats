import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ExecutionStage } from '@/modules/trading/core/execution-stage'
import type { PrismaClient, Prisma, UserSignalExecution } from '@/prisma/prisma.types'
import { ExecutionStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'

import { Injectable } from '@nestjs/common'

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
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(data: Prisma.UserSignalExecutionCreateInput): Promise<UserSignalExecution> {
    return this.txHost.tx.userSignalExecution.create({ data })
  }

  async markStage(id: string, stage: ExecutionStage, metadataPatch: Prisma.JsonObject = {}) {
    const existing = await this.txHost.tx.userSignalExecution.findUnique({
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

    await this.txHost.tx.userSignalExecution.update({
      where: { id },
      data: {
        metadata: nextMetadata,
      },
    })
  }

  async markExecuted(id: string, payload: ExecutionUpdatePayload = {}) {
    const existing = await this.txHost.tx.userSignalExecution.findUnique({
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

    await this.txHost.tx.userSignalExecution.update({
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
    await this.txHost.tx.userSignalExecution.update({
      where: { id },
      data: {
        status: ExecutionStatus.FAILED,
        errorMessage,
        executedAt: new Date(),
      },
    })
  }

  async markSkipped(id: string, reason: string) {
    await this.txHost.tx.userSignalExecution.update({
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
