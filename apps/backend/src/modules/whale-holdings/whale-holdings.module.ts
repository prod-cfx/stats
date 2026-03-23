import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { WhaleHoldingsController } from './whale-holdings.controller'
import { WhaleHoldingsRepository } from './whale-holdings.repository'
import { WhaleHoldingsService } from './whale-holdings.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleHoldingsController],
  providers: [WhaleHoldingsService, WhaleHoldingsRepository],
  exports: [WhaleHoldingsService],
})
export class WhaleHoldingsModule {}







