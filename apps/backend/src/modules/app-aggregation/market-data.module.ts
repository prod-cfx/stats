import { Module } from '@nestjs/common'
import { AggregatedLiquidationModule } from '../aggregated-liquidation/aggregated-liquidation.module'
import { AggregatedOrderbookModule } from '../aggregated-orderbook/aggregated-orderbook.module'
import { CryptoStockQuotesModule } from '../crypto-stock-quotes/crypto-stock-quotes.module'
import { ExchangeConfigModule } from '../exchange-config/exchange-config.module'
import { KlineModule } from '../kline/kline.module'
import { LiquidationHeatmapModule } from '../liquidation-heatmap/liquidation-heatmap.module'
import { MarketsModule } from '../markets/markets.module'
import { OpenInterestModule } from '../open-interest/open-interest.module'
import { OrderbookConfigModule } from '../orderbook-config/orderbook-config.module'
import { PolymarketModule } from '../polymarket/polymarket.module'
import { TradesConfigModule } from '../trades-config/trades-config.module'

@Module({
  imports: [
    MarketsModule,
    LiquidationHeatmapModule,
    AggregatedLiquidationModule,
    OrderbookConfigModule,
    AggregatedOrderbookModule,
    KlineModule,
    TradesConfigModule,
    ExchangeConfigModule,
    OpenInterestModule,
    PolymarketModule,
    CryptoStockQuotesModule,
  ],
})
export class MarketDataModule {}
