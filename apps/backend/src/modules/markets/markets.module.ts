import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { MarketsController } from './markets.controller'
import { MarketsService } from './markets.service'
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [MarketsService, LongShortRatioRepository],
  controllers: [MarketsController],
})
export class MarketsModule {}


