import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class WhaleAlertRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findManyAlerts(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
    skip: number,
  ) {
    return this.txHost.tx.hyperliquidWhaleAlert.findMany({
      where,
      orderBy: { createTime: 'desc' },
      take,
      skip,
    })
  }

  async countAlerts(where: Prisma.HyperliquidWhaleAlertWhereInput) {
    return this.txHost.tx.hyperliquidWhaleAlert.count({ where })
  }

  async findManyTrades(
    where: Prisma.HyperliquidWhaleTradeWhereInput,
    take: number,
    skip: number,
  ) {
    return this.txHost.tx.hyperliquidWhaleTrade.findMany({
      where,
      orderBy: { tradeTime: 'desc' },
      take,
      skip,
    })
  }

  async countTrades(where: Prisma.HyperliquidWhaleTradeWhereInput) {
    return this.txHost.tx.hyperliquidWhaleTrade.count({ where })
  }

  async findDistinctWhaleAddresses() {
    return this.txHost.tx.hyperliquidWhaleAlert.findMany({
      select: { userAddress: true },
      distinct: ['userAddress'],
    })
  }

  async createManyTrades(
    data: {
      userAddress: string
      symbol: string
      side: string
      tradeSize: number
      price: number
      tradeValueUsd: number
      tradeTime: Date
    }[],
  ) {
    return this.txHost.tx.hyperliquidWhaleTrade.createMany({
      data,
      skipDuplicates: true,
    })
  }
}
