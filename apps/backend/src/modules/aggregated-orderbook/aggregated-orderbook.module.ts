import { Module } from '@nestjs/common'
import { RedisModule } from '@/common/modules/redis.module'
import { AggregatedOrderbookController } from './aggregated-orderbook.controller'
import { AggregatedOrderbookService } from './aggregated-orderbook.service'

@Module({
  imports: [RedisModule],
  controllers: [AggregatedOrderbookController],
  providers: [AggregatedOrderbookService],
  exports: [AggregatedOrderbookService],
})
export class AggregatedOrderbookModule {}
