import { Module } from '@nestjs/common'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { DbExchangeAccountStore } from './factory/account-store.impl'
import { ExchangeFactory } from './factory/exchange-factory'
import { TradingService } from './trading.service'

@Module({
  imports: [PrismaModule],
  providers: [
    ConfigCryptoService,
    TradingService,
    ExchangeFactory,
    {
      provide: 'ExchangeAccountStore',
      useClass: DbExchangeAccountStore,
    },
  ],
  exports: [TradingService, ConfigCryptoService],
})
export class TradingModule {}
