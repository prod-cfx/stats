import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

@Injectable()
export class StrategySignalStateRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findByStrategyInstanceId(strategyInstanceId: string) {
    return this.txHost.tx.strategySignalState.findUnique({
      where: { strategyInstanceId },
    })
  }

  async incrementFailure(
    strategyInstanceId: string,
    options?: { lockedUntil?: Date; reset?: boolean },
  ) {
    const { lockedUntil, reset } = options ?? {}

    // 获取实例对应的模板ID
    const instance = await this.txHost.tx.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { strategyTemplateId: true },
    })

    if (!instance) {
      throw new DomainException('signal.instance_not_found', {
        code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: strategyInstanceId },
      })
    }

    await this.txHost.tx.strategySignalState.upsert({
      where: { strategyInstanceId },
      update: reset
        ? {
            consecutiveFailures: 0,
            lockedUntil,
          }
        : {
            consecutiveFailures: { increment: 1 },
            ...(lockedUntil ? { lockedUntil } : {}),
          },
      create: {
        strategyId: instance.strategyTemplateId,
        strategyInstance: { connect: { id: strategyInstanceId } },
        consecutiveFailures: reset ? 0 : 1,
        lockedUntil,
      },
    })
  }

  async reset(strategyInstanceId: string) {
    // 获取实例对应的模板ID
    const instance = await this.txHost.tx.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { strategyTemplateId: true },
    })

    if (!instance) {
      throw new DomainException('signal.instance_not_found', {
        code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: strategyInstanceId },
      })
    }

    await this.txHost.tx.strategySignalState.upsert({
      where: { strategyInstanceId },
      update: {
        consecutiveFailures: 0,
        lockedUntil: null,
      },
      create: {
        strategyId: instance.strategyTemplateId,
        strategyInstance: { connect: { id: strategyInstanceId } },
        consecutiveFailures: 0,
        lockedUntil: null,
      },
    })
  }
}
