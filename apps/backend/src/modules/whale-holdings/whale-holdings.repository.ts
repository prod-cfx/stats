import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class WhaleHoldingsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findManyPositions(
    where: { positionValueUsd: { gte: number }; symbol?: string },
    orderBy: { positionValueUsd: 'desc' },
    take: number,
    skip: number,
  ) {
    return this.txHost.tx.hyperliquidWhalePosition.findMany({
      where,
      orderBy,
      take,
      skip,
    })
  }

  async countPositions(where: { positionValueUsd: { gte: number }; symbol?: string }) {
    return this.txHost.tx.hyperliquidWhalePosition.count({ where })
  }
}
