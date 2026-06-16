import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PolymarketController } from './polymarket.controller'
import { PolymarketRepository } from './polymarket.repository'
import { PolymarketService } from './polymarket.service'

@Module({
  imports: [AuthModule],
  controllers: [PolymarketController],
  providers: [PolymarketRepository, PolymarketService],
})
export class PolymarketModule {}
