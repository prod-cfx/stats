import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminTradesPairConfigController } from './controllers/admin-trades-pair-config.controller'
import { TradesPairConfigRepository } from './repositories/trades-pair-config.repository'
import { TradesPairConfigService } from './services/trades-pair-config.service'

@Module({
  imports: [AuthModule],
  providers: [TradesPairConfigService, TradesPairConfigRepository],
  controllers: [AdminTradesPairConfigController],
  exports: [TradesPairConfigService],
})
export class TradesConfigModule {}


