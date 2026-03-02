import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { PolymarketController } from './polymarket.controller'
import { PolymarketRepository } from './polymarket.repository'
import { PolymarketService } from './polymarket.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PolymarketController],
  providers: [PolymarketRepository, PolymarketService],
})
export class PolymarketModule {}
