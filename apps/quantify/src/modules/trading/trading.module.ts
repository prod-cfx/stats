import { Module } from '@nestjs/common'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { DbExchangeAccountStore } from './factory/account-store.impl'
import { ExchangeFactory } from './factory/exchange-factory'
import { TradingPriceInputService } from './services/trading-price-input.service'
import { TradingService } from './trading.service'

@Module({
  imports: [PrismaModule, MarketDataModule],
  providers: [
    ConfigCryptoService,
    TradingService,
    TradingPriceInputService,
    ExchangeFactory,
    {
      provide: 'ExchangeAccountStore',
      useClass: DbExchangeAccountStore,
    },
  ],
  exports: [TradingService, TradingPriceInputService, ConfigCryptoService],
})
export class TradingModule {}
