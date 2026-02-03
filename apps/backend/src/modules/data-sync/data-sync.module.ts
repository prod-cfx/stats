import type { DataPullJob } from './contracts/data-pull-job'
import { forwardRef, Module } from '@nestjs/common'
import { PolymarketClobClient, PolymarketGammaClient } from '@/clients/polymarket'
import { AuthModule } from '@/modules/auth/auth.module'
import { CryptoStockQuotesModule } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.module'
import { LiquidationHeatmapModule } from '@/modules/liquidation-heatmap/liquidation-heatmap.module'
import { MarketsModule } from '@/modules/markets/markets.module'
import { CoinglassOiOhlcAggregatedJob } from '@/modules/open-interest/jobs/oi-ohlc-aggregated.job'
// MarketsVolumeSyncJob 已移除：数据拉取由其他系统负责
import { OpenInterestSyncJob } from '@/modules/open-interest/jobs/open-interest-sync.job'
import { OpenInterestModule } from '@/modules/open-interest/open-interest.module'
import { OrderbookConfigModule } from '@/modules/orderbook-config/orderbook-config.module'
import { PolymarketRepository } from '@/modules/polymarket/polymarket.repository'
import { SettingsModule } from '@/modules/settings/settings.module'
import { TradesConfigModule } from '@/modules/trades-config/trades-config.module'
import { WhaleAlertModule } from '@/modules/whale-alert/whale-alert.module'
import { WhaleTrackingModule } from '@/modules/whale-tracking/whale-tracking.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminDataPullTaskController } from './controllers/admin-data-pull-task.controller'
import { DataSyncCronService } from './data-sync-cron.service'
import { DataSyncOrchestrator } from './data-sync-orchestrator.service'
import {
  DATA_PULL_JOB_REGISTRY,
  ORDERBOOK_WS_ADAPTER_REGISTRY,
  TRADES_WS_ADAPTER_REGISTRY,
} from './data-sync.tokens'
import { BbxCryptoStockQuotesJob } from './jobs/bbx-crypto-stock-quotes.job'
import { BbxCryptoStockScraperJob } from './jobs/bbx-crypto-stock-scraper.job'
import { BinanceKlineHistoryJob } from './jobs/binance-kline-history.job'
import { CoinglassAggregatedLiquidationJob } from './jobs/coinglass-aggregated-liquidation.job'
import { CoinglassCoinsPriceChangeJob } from './jobs/coinglass-coins-price-change.job'
import { CoinglassFuturesPriceHistoryJob } from './jobs/coinglass-futures-price-history.job'
import { CoinglassHeatmapJob } from './jobs/coinglass-heatmap.job'
import { CoinglassLongShortRatioJob } from './jobs/coinglass-long-short-ratio.job'
import { CoinglassPairsMarketsJob } from './jobs/coinglass-pairs-markets.job'
import { CoinglassTakerVolumeJob } from './jobs/coinglass-taker-volume.job'
import { CoinglassWhaleAlertJob } from './jobs/coinglass-whale-alert.job'
import { ExampleKlineJob } from './jobs/example-kline.job'
import { ExampleNewsJob } from './jobs/example-news.job'
import { ExampleOrderbookJob } from './jobs/example-orderbook.job'
import { HyperliquidUserFillsSyncJob } from './jobs/hyperliquid-user-fills-sync.job'
import { HyperliquidUserFundingSyncJob } from './jobs/hyperliquid-user-funding-sync.job'
import { HyperliquidUserOrdersSyncJob } from './jobs/hyperliquid-user-orders-sync.job'
import { PolymarketMarketsJob } from './jobs/polymarket-markets.job'
import { PolymarketOrderbookJob } from './jobs/polymarket-orderbook.job'
import { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from './repositories/data-pull-task.repository'
import { BinanceCexFutureOrderbookWsAdapter } from './services/adapters/binance-cex-future-orderbook-ws.adapter'
import { BinanceCexFutureTradesWsAdapter } from './services/adapters/binance-cex-future-trades-ws.adapter'
import { BinanceCexPerpetualOrderbookWsAdapter } from './services/adapters/binance-cex-perpetual-orderbook-ws.adapter'
import { BinanceCexPerpetualTradesWsAdapter } from './services/adapters/binance-cex-perpetual-trades-ws.adapter'
import { BinanceCexSpotOrderbookWsAdapter } from './services/adapters/binance-cex-spot-orderbook-ws.adapter'
import { BinanceCexSpotTradesWsAdapter } from './services/adapters/binance-cex-spot-trades-ws.adapter'
import { BitmaxCexFutureOrderbookWsAdapter } from './services/adapters/bitmax-cex-future-orderbook-ws.adapter'
import { BitmaxCexPerpetualOrderbookWsAdapter } from './services/adapters/bitmax-cex-perpetual-orderbook-ws.adapter'
import { BitmaxCexSpotOrderbookWsAdapter } from './services/adapters/bitmax-cex-spot-orderbook-ws.adapter'
import { BybitCexFutureOrderbookWsAdapter } from './services/adapters/bybit-cex-future-orderbook-ws.adapter'
import { BybitCexPerpetualOrderbookWsAdapter } from './services/adapters/bybit-cex-perpetual-orderbook-ws.adapter'
import { BybitCexSpotOrderbookWsAdapter } from './services/adapters/bybit-cex-spot-orderbook-ws.adapter'
import { HyperliquidDexPerpetualOrderbookWsAdapter } from './services/adapters/hyperliquid-dex-perpetual-orderbook-ws.adapter'
import { HyperliquidDexPerpetualTradesWsAdapter } from './services/adapters/hyperliquid-dex-perpetual-trades-ws.adapter'
import { HyperliquidDexSpotOrderbookWsAdapter } from './services/adapters/hyperliquid-dex-spot-orderbook-ws.adapter'
import { HyperliquidTradesWsConfig } from './services/adapters/hyperliquid/hyperliquid-trades-ws.config'
import { OkxCexFutureOrderbookWsAdapter } from './services/adapters/okx-cex-future-orderbook-ws.adapter'
import { OkxCexFutureTradesWsAdapter } from './services/adapters/okx-cex-future-trades-ws.adapter'
import { OkxCexPerpetualOrderbookWsAdapter } from './services/adapters/okx-cex-perpetual-orderbook-ws.adapter'
import { OkxCexPerpetualTradesWsAdapter } from './services/adapters/okx-cex-perpetual-trades-ws.adapter'
import { OkxCexSpotOrderbookWsAdapter } from './services/adapters/okx-cex-spot-orderbook-ws.adapter'
import { OkxCexSpotTradesWsAdapter } from './services/adapters/okx-cex-spot-trades-ws.adapter'
import { AdminDataPullTaskService } from './services/admin-data-pull-task.service'
import { OrderbookWsSyncManager } from './services/orderbook-ws-sync-manager.service'
import { TradesWsSyncManager } from './services/trades-ws-sync-manager.service'

/**
 * 统一的数据拉取调度模块：
 * - 通过 DataPullJob 接口抽象不同数据类型（K 线、深度、新闻等）
 * - 使用 Prisma 表记录任务配置与执行历史
 * - 使用 Nest Schedule 进行统一 Cron 调度
 */

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LiquidationHeatmapModule,
    OpenInterestModule,
    OrderbookConfigModule,
    SettingsModule,
    CryptoStockQuotesModule,
    TradesConfigModule,
    forwardRef(() => WhaleAlertModule),
    WhaleTrackingModule,
    MarketsModule,
  ],
  controllers: [AdminDataPullTaskController],
  providers: [
    // 仓储
    DataPullTaskRepository,
    DataPullExecutionRepository,
    // Job 实现（示例 + 实际）
    ExampleKlineJob,
    ExampleNewsJob,
    CoinglassHeatmapJob,
    CoinglassWhaleAlertJob,
    CoinglassCoinsPriceChangeJob,
    CoinglassFuturesPriceHistoryJob,
    ExampleOrderbookJob,
    OpenInterestSyncJob,
    CoinglassOiOhlcAggregatedJob,
    CoinglassAggregatedLiquidationJob,
    CoinglassLongShortRatioJob,
    CoinglassPairsMarketsJob,
    CoinglassTakerVolumeJob,
    BbxCryptoStockQuotesJob,
    BbxCryptoStockScraperJob,
    BinanceKlineHistoryJob,
    PolymarketMarketsJob,
    PolymarketOrderbookJob,
    HyperliquidUserFillsSyncJob,
    HyperliquidUserOrdersSyncJob,
    HyperliquidUserFundingSyncJob,
    PolymarketGammaClient,
    PolymarketClobClient,
    PolymarketRepository,
    // Job registry，将多个 Job 注入为一个数组
    {
      provide: DATA_PULL_JOB_REGISTRY,
      useFactory: (
        exampleKlineJob: ExampleKlineJob,
        exampleNewsJob: ExampleNewsJob,
        coinglassHeatmapJob: CoinglassHeatmapJob,
        coinglassWhaleAlertJob: CoinglassWhaleAlertJob,
        coinglassCoinsPriceChangeJob: CoinglassCoinsPriceChangeJob,
        coinglassFuturesPriceHistoryJob: CoinglassFuturesPriceHistoryJob,
        binanceKlineHistoryJob: BinanceKlineHistoryJob,
        exampleOrderbookJob: ExampleOrderbookJob,
        openInterestSyncJob: OpenInterestSyncJob,
        coinglassOiOhlcAggregatedJob: CoinglassOiOhlcAggregatedJob,
        coinglassAggregatedLiquidationJob: CoinglassAggregatedLiquidationJob,
        coinglassLongShortRatioJob: CoinglassLongShortRatioJob,
        coinglassPairsMarketsJob: CoinglassPairsMarketsJob,
        coinglassTakerVolumeJob: CoinglassTakerVolumeJob,
        bbxCryptoStockQuotesJob: BbxCryptoStockQuotesJob,
        bbxCryptoStockScraperJob: BbxCryptoStockScraperJob,
        polymarketMarketsJob: PolymarketMarketsJob,
        polymarketOrderbookJob: PolymarketOrderbookJob,
        hyperliquidUserFillsSyncJob: HyperliquidUserFillsSyncJob,
        hyperliquidUserOrdersSyncJob: HyperliquidUserOrdersSyncJob,
        hyperliquidUserFundingSyncJob: HyperliquidUserFundingSyncJob,
      ): DataPullJob[] => [
        exampleKlineJob,
        exampleNewsJob,
        coinglassHeatmapJob,
        coinglassWhaleAlertJob,
        coinglassCoinsPriceChangeJob,
        coinglassFuturesPriceHistoryJob,
        binanceKlineHistoryJob,
        exampleOrderbookJob,
        openInterestSyncJob,
        coinglassOiOhlcAggregatedJob,
        coinglassAggregatedLiquidationJob,
        coinglassLongShortRatioJob,
        coinglassPairsMarketsJob,
        coinglassTakerVolumeJob,
        bbxCryptoStockQuotesJob,
        bbxCryptoStockScraperJob,
        polymarketMarketsJob,
        polymarketOrderbookJob,
        hyperliquidUserFillsSyncJob,
        hyperliquidUserOrdersSyncJob,
        hyperliquidUserFundingSyncJob,
      ],
      inject: [
        ExampleKlineJob,
        ExampleNewsJob,
        CoinglassHeatmapJob,
        CoinglassWhaleAlertJob,
        CoinglassCoinsPriceChangeJob,
        CoinglassFuturesPriceHistoryJob,
        BinanceKlineHistoryJob,
        ExampleOrderbookJob,
        OpenInterestSyncJob,
        CoinglassOiOhlcAggregatedJob,
        CoinglassAggregatedLiquidationJob,
        CoinglassLongShortRatioJob,
        CoinglassPairsMarketsJob,
        CoinglassTakerVolumeJob,
        BbxCryptoStockQuotesJob,
        BbxCryptoStockScraperJob,
        PolymarketMarketsJob,
        PolymarketOrderbookJob,
        HyperliquidUserFillsSyncJob,
        HyperliquidUserOrdersSyncJob,
        HyperliquidUserFundingSyncJob,
      ],
    },
    // 统一编排 & Cron
    DataSyncOrchestrator,
    DataSyncCronService,
    // 管理后台：数据拉取任务 CRUD
    AdminDataPullTaskService,

    // ===== Orderbook WS sync（动态订阅/退订；按 orderbook_pair_configs 驱动）=====
    BinanceCexSpotOrderbookWsAdapter,
    BinanceCexPerpetualOrderbookWsAdapter,
    BinanceCexFutureOrderbookWsAdapter,
    BitmaxCexSpotOrderbookWsAdapter,
    BitmaxCexPerpetualOrderbookWsAdapter,
    BitmaxCexFutureOrderbookWsAdapter,
    BybitCexSpotOrderbookWsAdapter,
    BybitCexPerpetualOrderbookWsAdapter,
    BybitCexFutureOrderbookWsAdapter,
    OkxCexSpotOrderbookWsAdapter,
    OkxCexPerpetualOrderbookWsAdapter,
    OkxCexFutureOrderbookWsAdapter,
    HyperliquidDexPerpetualOrderbookWsAdapter,
    HyperliquidDexSpotOrderbookWsAdapter,
    {
      provide: ORDERBOOK_WS_ADAPTER_REGISTRY,
      useFactory: (
        binanceCexSpotOrderbookWsAdapter: BinanceCexSpotOrderbookWsAdapter,
        binanceCexPerpetualOrderbookWsAdapter: BinanceCexPerpetualOrderbookWsAdapter,
        binanceCexFutureOrderbookWsAdapter: BinanceCexFutureOrderbookWsAdapter,
        bitmaxCexSpotOrderbookWsAdapter: BitmaxCexSpotOrderbookWsAdapter,
        bitmaxCexPerpetualOrderbookWsAdapter: BitmaxCexPerpetualOrderbookWsAdapter,
        bitmaxCexFutureOrderbookWsAdapter: BitmaxCexFutureOrderbookWsAdapter,
        bybitCexSpotOrderbookWsAdapter: BybitCexSpotOrderbookWsAdapter,
        bybitCexPerpetualOrderbookWsAdapter: BybitCexPerpetualOrderbookWsAdapter,
        bybitCexFutureOrderbookWsAdapter: BybitCexFutureOrderbookWsAdapter,
        okxCexSpotOrderbookWsAdapter: OkxCexSpotOrderbookWsAdapter,
        okxCexPerpetualOrderbookWsAdapter: OkxCexPerpetualOrderbookWsAdapter,
        okxCexFutureOrderbookWsAdapter: OkxCexFutureOrderbookWsAdapter,
        hyperliquidDexPerpetualOrderbookWsAdapter: HyperliquidDexPerpetualOrderbookWsAdapter,
        hyperliquidDexSpotOrderbookWsAdapter: HyperliquidDexSpotOrderbookWsAdapter,
      ) => [
        binanceCexSpotOrderbookWsAdapter,
        binanceCexPerpetualOrderbookWsAdapter,
        binanceCexFutureOrderbookWsAdapter,
        bitmaxCexSpotOrderbookWsAdapter,
        bitmaxCexPerpetualOrderbookWsAdapter,
        bitmaxCexFutureOrderbookWsAdapter,
        bybitCexSpotOrderbookWsAdapter,
        bybitCexPerpetualOrderbookWsAdapter,
        bybitCexFutureOrderbookWsAdapter,
        okxCexSpotOrderbookWsAdapter,
        okxCexPerpetualOrderbookWsAdapter,
        okxCexFutureOrderbookWsAdapter,
        hyperliquidDexPerpetualOrderbookWsAdapter,
        hyperliquidDexSpotOrderbookWsAdapter,
      ],
      inject: [
        BinanceCexSpotOrderbookWsAdapter,
        BinanceCexPerpetualOrderbookWsAdapter,
        BinanceCexFutureOrderbookWsAdapter,
        BitmaxCexSpotOrderbookWsAdapter,
        BitmaxCexPerpetualOrderbookWsAdapter,
        BitmaxCexFutureOrderbookWsAdapter,
        BybitCexSpotOrderbookWsAdapter,
        BybitCexPerpetualOrderbookWsAdapter,
        BybitCexFutureOrderbookWsAdapter,
        OkxCexSpotOrderbookWsAdapter,
        OkxCexPerpetualOrderbookWsAdapter,
        OkxCexFutureOrderbookWsAdapter,
        HyperliquidDexPerpetualOrderbookWsAdapter,
        HyperliquidDexSpotOrderbookWsAdapter,
      ],
    },
    OrderbookWsSyncManager,

    // ===== Trades WS sync（动态订阅交易记录）=====
    HyperliquidTradesWsConfig,
    BinanceCexSpotTradesWsAdapter,
    BinanceCexPerpetualTradesWsAdapter,
    BinanceCexFutureTradesWsAdapter,
    OkxCexSpotTradesWsAdapter,
    OkxCexPerpetualTradesWsAdapter,
    OkxCexFutureTradesWsAdapter,
    HyperliquidDexPerpetualTradesWsAdapter,
    {
      provide: TRADES_WS_ADAPTER_REGISTRY,
      useFactory: (
        binanceCexSpotTradesWsAdapter: BinanceCexSpotTradesWsAdapter,
        binanceCexPerpetualTradesWsAdapter: BinanceCexPerpetualTradesWsAdapter,
        binanceCexFutureTradesWsAdapter: BinanceCexFutureTradesWsAdapter,
        okxCexSpotTradesWsAdapter: OkxCexSpotTradesWsAdapter,
        okxCexPerpetualTradesWsAdapter: OkxCexPerpetualTradesWsAdapter,
        okxCexFutureTradesWsAdapter: OkxCexFutureTradesWsAdapter,
        hyperliquidDexPerpetualTradesWsAdapter: HyperliquidDexPerpetualTradesWsAdapter,
      ) => [
        binanceCexSpotTradesWsAdapter,
        binanceCexPerpetualTradesWsAdapter,
        binanceCexFutureTradesWsAdapter,
        okxCexSpotTradesWsAdapter,
        okxCexPerpetualTradesWsAdapter,
        okxCexFutureTradesWsAdapter,
        hyperliquidDexPerpetualTradesWsAdapter,
      ],
      inject: [
        BinanceCexSpotTradesWsAdapter,
        BinanceCexPerpetualTradesWsAdapter,
        BinanceCexFutureTradesWsAdapter,
        OkxCexSpotTradesWsAdapter,
        OkxCexPerpetualTradesWsAdapter,
        OkxCexFutureTradesWsAdapter,
        HyperliquidDexPerpetualTradesWsAdapter,
      ],
    },
    TradesWsSyncManager,
  ],
  exports: [HyperliquidDexPerpetualTradesWsAdapter, TRADES_WS_ADAPTER_REGISTRY],
})
export class DataSyncModule {}
