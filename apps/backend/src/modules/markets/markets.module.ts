import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MarketsController } from './markets.controller'
import { MarketsService } from './markets.service'

@Module({
  imports: [AuthModule],
  providers: [MarketsService],
  controllers: [MarketsController],
})
export class MarketsModule {}


