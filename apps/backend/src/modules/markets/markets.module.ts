import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MarketsController } from './markets.controller'
import { MarketsService } from './markets.service'
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'

@Module({
  imports: [AuthModule],
  providers: [MarketsService, LongShortRatioRepository],
  controllers: [MarketsController],
})
export class MarketsModule {}


