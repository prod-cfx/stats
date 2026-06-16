import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { AdminExchangeConfigController } from './controllers/admin-exchange-config.controller'
import { ExchangeConfigRepository } from './repositories/exchange-config.repository'
import { ExchangeConfigService } from './services/exchange-config.service'

@Module({
  imports: [AuthModule],
  controllers: [AdminExchangeConfigController],
  providers: [ExchangeConfigService, ExchangeConfigRepository],
  exports: [ExchangeConfigService],
})
export class ExchangeConfigModule {}

