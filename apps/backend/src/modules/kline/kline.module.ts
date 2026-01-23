import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { BinanceWsService } from './binance-ws.service'
import { KlineAggregatorService } from './kline-aggregator.service'
import { KlineController } from './kline.controller'
import { KlineGateway } from './kline.gateway'
import { KlineService } from './kline.service'

@Module({
  imports: [AuthModule],
  controllers: [KlineController],
  providers: [KlineService, KlineGateway, BinanceWsService, KlineAggregatorService],
})
export class KlineModule {}
