import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { CleanupOldTradesJob } from './jobs/cleanup-old-trades.job'
import { MarketsController } from './markets.controller'
import { MarketsService } from './markets.service'
import { FuturesPairsMarketRepository } from './repositories/futures-pairs-market.repository'
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'
import { MarketTradesRepository } from './repositories/market-trades.repository'

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    MarketsService,
    LongShortRatioRepository,
    MarketTradesRepository,
    FuturesPairsMarketRepository,
    CleanupOldTradesJob,
  ],
  controllers: [MarketsController],
})
export class MarketsModule {}


