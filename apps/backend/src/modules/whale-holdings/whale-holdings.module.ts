import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { WhaleHoldingsController } from './whale-holdings.controller'
import { WhaleHoldingsRepository } from './whale-holdings.repository'
import { WhaleHoldingsService } from './whale-holdings.service'

@Module({
  imports: [AuthModule],
  controllers: [WhaleHoldingsController],
  providers: [WhaleHoldingsService, WhaleHoldingsRepository],
  exports: [WhaleHoldingsService],
})
export class WhaleHoldingsModule {}







