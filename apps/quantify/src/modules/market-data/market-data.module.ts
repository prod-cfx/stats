import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ConfigService } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
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

@Module({
  imports: [ConfigModule.forFeature(marketDataConfig), HttpModule, IndicatorsModule, EventEmitterModule],
  controllers: [MarketDataController, OpsMarketSymbolsController],
  providers: [
    MarketDataService,
    MarketDataRepository,
    MarketDataReadGateway,
    MarketDataHealthService,
    MarketDataIngestionService,
    MarketDataStreamService,
    BinanceMarketDataProvider,
    OkxMarketDataProvider,
    HyperliquidMarketDataProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService, BinanceMarketDataProvider, OkxMarketDataProvider, HyperliquidMarketDataProvider],
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
  exports: [MarketDataService, MarketDataReadGateway, MarketDataHealthService],
})
export class MarketDataModule {}
