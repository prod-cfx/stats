import type { Prisma } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class WhaleAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findManyAlerts(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
    skip: number,
  ) {
    return this.getClient().hyperliquidWhaleAlert.findMany({
      where,
      orderBy: { createTime: 'desc' },
      take,
      skip,
    })
  }

  async countAlerts(where: Prisma.HyperliquidWhaleAlertWhereInput) {
    return this.getClient().hyperliquidWhaleAlert.count({ where })
  }

  async findManyTrades(
    where: Prisma.HyperliquidWhaleTradeWhereInput,
    take: number,
    skip: number,
  ) {
    return this.getClient().hyperliquidWhaleTrade.findMany({
      where,
      orderBy: { tradeTime: 'desc' },
      take,
      skip,
    })
  }

  async countTrades(where: Prisma.HyperliquidWhaleTradeWhereInput) {
    return this.getClient().hyperliquidWhaleTrade.count({ where })
  }

  async findDistinctWhaleAddresses() {
    return this.getClient().hyperliquidWhaleAlert.findMany({
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
    return this.getClient().hyperliquidWhaleTrade.createMany({
      data,
      skipDuplicates: true,
    })
  }
}
