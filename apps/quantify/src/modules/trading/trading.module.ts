import { Module } from '@nestjs/common'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { OkxPrivateWsClient } from './exchanges/okx-private-ws-client'
import { DbExchangeAccountStore } from './factory/account-store.impl'
import { ExchangeFactory } from './factory/exchange-factory'
import { RateLimiterRegistry } from './services/rate-limiter-registry.service'
import { TradingPriceInputService } from './services/trading-price-input.service'
import { TradingService } from './trading.service'

@Module({
  imports: [PrismaModule, MarketDataModule],
  providers: [
    ConfigCryptoService,
    TradingService,
    TradingPriceInputService,
    ExchangeFactory,
    RateLimiterRegistry,
    OkxPrivateWsClient,
    {
      provide: 'ExchangeAccountStore',
      useClass: DbExchangeAccountStore,
    },
  ],
  exports: [TradingService, TradingPriceInputService, ConfigCryptoService],
})
export class TradingModule {}
