import type { HyperliquidWhaleAlert, Prisma  } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class WhaleTrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async groupWhaleAlertsByAddress(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
  ) {
    return this.getClient().hyperliquidWhaleAlert.groupBy({
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
    return this.getClient().hyperliquidWhaleAlert.findMany({ where })
  }

  async groupAlertsByAddressForSummary(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.getClient().hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where,
      _sum: { positionValueUsd: true },
      _count: { _all: true },
    })
  }

  async groupAlertsBySymbol(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.getClient().hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _sum: { positionValueUsd: true },
      _count: { _all: true },
    })
  }

  async groupAlertsBySymbolWithPositionFilter(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
  ) {
    return this.getClient().hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _count: { _all: true },
    })
  }

  async findManyAlertsWithLimit(
    where: Prisma.HyperliquidWhaleAlertWhereInput,
    take: number,
  ): Promise<HyperliquidWhaleAlert[]> {
    return this.getClient().hyperliquidWhaleAlert.findMany({
      where,
      orderBy: { createTime: 'desc' },
      take,
    })
  }
}
