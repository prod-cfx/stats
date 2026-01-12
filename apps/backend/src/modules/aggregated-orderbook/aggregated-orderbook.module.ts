import { Module } from '@nestjs/common'
import { AggregatedOrderbookController } from './aggregated-orderbook.controller'
import { AggregatedOrderbookService } from './aggregated-orderbook.service'

@Module({
  controllers: [AggregatedOrderbookController],
  providers: [AggregatedOrderbookService],
  exports: [AggregatedOrderbookService],
})
export class AggregatedOrderbookModule {}
