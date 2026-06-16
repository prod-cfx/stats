import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PolymarketController } from './polymarket.controller'
import { PolymarketIngestionService } from './polymarket-ingestion.service'
import { PolymarketRepository } from './polymarket.repository'
import { PolymarketService } from './polymarket.service'

@Module({
  imports: [AuthModule],
  controllers: [PolymarketController],
  providers: [PolymarketRepository, PolymarketService, PolymarketIngestionService],
  exports: [PolymarketIngestionService],
})
export class PolymarketModule {}
