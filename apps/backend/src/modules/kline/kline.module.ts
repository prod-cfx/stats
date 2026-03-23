import { Module } from '@nestjs/common'
import { RedisModule } from '@/common/modules/redis.module'
import { AggregatedOrderbookModule } from '@/modules/aggregated-orderbook/aggregated-orderbook.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { MarketsModule } from '@/modules/markets/markets.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { BinanceWsService } from './binance-ws.service'
import { KlineAggregatorService } from './kline-aggregator.service'
import { KlineController } from './kline.controller'
import { KlineGateway } from './kline.gateway'
import { KlineService } from './kline.service'
import { KlineRepository } from './repositories/kline.repository'

@Module({
  imports: [AuthModule, AggregatedOrderbookModule, RedisModule, MarketsModule, PrismaModule],
  controllers: [KlineController],
  providers: [KlineRepository, KlineService, KlineGateway, BinanceWsService, KlineAggregatorService],
})
export class KlineModule {}
