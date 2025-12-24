import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminOrderbookPairConfigController } from './controllers/admin-orderbook-pair-config.controller'
import { OrderbookPairConfigRepository } from './repositories/orderbook-pair-config.repository'
import { OrderbookPairConfigService } from './services/orderbook-pair-config.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminOrderbookPairConfigController],
  providers: [OrderbookPairConfigService, OrderbookPairConfigRepository],
  exports: [OrderbookPairConfigService],
})
export class OrderbookConfigModule {}
