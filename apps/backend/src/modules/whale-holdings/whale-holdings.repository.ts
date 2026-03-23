import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class WhaleHoldingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findManyPositions(
    where: { positionValueUsd: { gte: number }; symbol?: string },
    orderBy: { positionValueUsd: 'desc' },
    take: number,
    skip: number,
  ) {
    return this.getClient().hyperliquidWhalePosition.findMany({
      where,
      orderBy,
      take,
      skip,
    })
  }

  async countPositions(where: { positionValueUsd: { gte: number }; symbol?: string }) {
    return this.getClient().hyperliquidWhalePosition.count({ where })
  }
}
