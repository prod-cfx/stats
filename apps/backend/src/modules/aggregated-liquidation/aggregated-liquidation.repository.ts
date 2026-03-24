import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { LiquidationTimeframe } from './dto/aggregated-liquidation.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AggregatedLiquidationRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findLatestBySymbolAndInterval(symbol: string, interval: LiquidationTimeframe) {
    return this.txHost.tx.aggregatedLiquidationHistory.findFirst({
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
    return this.txHost.tx.aggregatedLiquidationHistory.findMany({
      where: { symbol, interval, timestamp },
      ...(orderBy ? { orderBy } : {}),
    })
  }
}
