import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CleanupOldTradesJob } from './jobs/cleanup-old-trades.job'
import { MarketsController } from './markets.controller'
import { MarketsService } from './markets.service'
import { FuturesPairsMarketRepository } from './repositories/futures-pairs-market.repository'
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'
import { MarketTradesRepository } from './repositories/market-trades.repository'
import { TakerBuySellVolumeRepository } from './repositories/taker-buy-sell-volume.repository'

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    MarketsService,
    LongShortRatioRepository,
    MarketTradesRepository,
    FuturesPairsMarketRepository,
    TakerBuySellVolumeRepository,
    CleanupOldTradesJob,
  ],
  controllers: [MarketsController],
  exports: [TakerBuySellVolumeRepository],
})
export class MarketsModule {}

