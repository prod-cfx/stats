import type { LiquidationTimeframe } from './dto/aggregated-liquidation.dto'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AggregatedLiquidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findLatestBySymbolAndInterval(symbol: string, interval: LiquidationTimeframe) {
    return this.getClient().aggregatedLiquidationHistory.findFirst({
      where: { symbol, interval },
      orderBy: { timestamp: 'desc' },
    })
  }

  async findManyBySymbolIntervalAndTimestamp(
    symbol: string,
    interval: LiquidationTimeframe,
    timestamp: Date,
    orderBy?: { exchangeCode: 'asc' | 'desc' },
  ) {
    return this.getClient().aggregatedLiquidationHistory.findMany({
      where: { symbol, interval, timestamp },
      ...(orderBy ? { orderBy } : {}),
    })
  }
}
