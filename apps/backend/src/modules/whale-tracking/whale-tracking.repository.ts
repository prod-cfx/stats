import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { HyperliquidWhaleAlert, Prisma  } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class WhaleTrackingRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async groupWhaleAlertsByAddress(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
  ) {
    return this.txHost.tx.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where,
      _sum: { positionValueUsd: true },
      _count: { _all: true },
      orderBy: { _sum: { positionValueUsd: 'desc' } },
      take,
    })
  }

  async findManyAlerts(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ): Promise<HyperliquidWhaleAlert[]> {
    return this.txHost.tx.hyperliquidWhaleAlert.findMany({ where })
  }

  async groupAlertsByAddressForSummary(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.txHost.tx.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where,
      _sum: { positionValueUsd: true },
      _count: { _all: true },
    })
  }

  async groupAlertsBySymbol(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.txHost.tx.hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _sum: { positionValueUsd: true },
      _count: { _all: true },
    })
  }

  async groupAlertsBySymbolWithPositionFilter(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.txHost.tx.hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _count: { _all: true },
    })
  }

  async findManyAlertsWithLimit(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
  ): Promise<HyperliquidWhaleAlert[]> {
    return this.txHost.tx.hyperliquidWhaleAlert.findMany({
      where,
      orderBy: { createTime: 'desc' },
      take,
    })
  }
}
