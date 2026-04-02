import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { marketDataConfig } from '@/config'
import { IndicatorsModule } from '@/modules/indicators/indicators.module'
import { MARKET_DATA_PROVIDER } from './constants/market-data.constants'
import { MarketDataController } from './controllers/market-data.controller'
import { OpsMarketSymbolsController } from './controllers/ops-market-symbols.controller'
import { BinanceMarketDataProvider } from './providers/binance-market-data.provider'
import { HyperliquidMarketDataProvider } from './providers/hyperliquid-market-data.provider'
import { OkxMarketDataProvider } from './providers/okx-market-data.provider'
import { MarketDataHealthService } from './services/market-data-health.service'
import { MarketDataIngestionService } from './services/market-data-ingestion.service'
import { MarketDataReadGateway } from './services/market-data-read.gateway'
import { MarketDataStreamService } from './services/market-data-stream.service'
import { MarketDataRepository } from './services/market-data.repository'
import { MarketDataService } from './services/market-data.service'
import { MarketSymbolCatalogService } from './services/market-symbol-catalog.service'

@Module({
  imports: [ConfigModule.forFeature(marketDataConfig), HttpModule, IndicatorsModule],
  controllers: [MarketDataController, OpsMarketSymbolsController],
  providers: [
    MarketDataService,
    MarketDataRepository,
    MarketDataReadGateway,
    MarketDataHealthService,
    MarketDataIngestionService,
    MarketSymbolCatalogService,
    MarketDataStreamService,
    BinanceMarketDataProvider,
    OkxMarketDataProvider,
    HyperliquidMarketDataProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService, BinanceMarketDataProvider, OkxMarketDataProvider, HyperliquidMarketDataProvider],
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix -- NestJS API requires the `useFactory` key name.
      useFactory: (
        configService: ConfigService,
        binanceProvider: BinanceMarketDataProvider,
        okxProvider: OkxMarketDataProvider,
        hyperliquidProvider: HyperliquidMarketDataProvider,
      ) => {
        const provider = (configService.get<string>('marketData.provider') ?? 'binance').toLowerCase()
        if (provider === 'okx') return okxProvider
        if (provider === 'hyperliquid') return hyperliquidProvider
        return binanceProvider
      },
    },
  ],
  exports: [
    MarketDataService,
    MarketDataReadGateway,
    MarketDataHealthService,
    MarketDataIngestionService,
    MarketSymbolCatalogService,
    BinanceMarketDataProvider,
    OkxMarketDataProvider,
    HyperliquidMarketDataProvider,
  ],
})
export class MarketDataModule {}
