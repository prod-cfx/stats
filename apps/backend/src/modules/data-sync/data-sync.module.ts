import type { DataPullJob } from './contracts/data-pull-job'
import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { CryptoStockQuotesModule } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.module'
import { LiquidationHeatmapModule } from '@/modules/liquidation-heatmap/liquidation-heatmap.module'
import { OpenInterestSyncJob } from '@/modules/open-interest/jobs/open-interest-sync.job'
import { OpenInterestModule } from '@/modules/open-interest/open-interest.module'
import { OrderbookConfigModule } from '@/modules/orderbook-config/orderbook-config.module'
import { SettingsModule } from '@/modules/settings/settings.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminDataPullTaskController } from './controllers/admin-data-pull-task.controller'
import { DataSyncCronService } from './data-sync-cron.service'
import { DataSyncOrchestrator } from './data-sync-orchestrator.service'
import { DATA_PULL_JOB_REGISTRY, ORDERBOOK_WS_ADAPTER_REGISTRY } from './data-sync.tokens'
import { BbxCryptoStockQuotesJob } from './jobs/bbx-crypto-stock-quotes.job'
import { CoinglassAggregatedLiquidationJob } from './jobs/coinglass-aggregated-liquidation.job'
import { CoinglassHeatmapJob } from './jobs/coinglass-heatmap.job'
import { ExampleKlineJob } from './jobs/example-kline.job'
import { ExampleNewsJob } from './jobs/example-news.job'
import { ExampleOrderbookJob } from './jobs/example-orderbook.job'
import { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from './repositories/data-pull-task.repository'
import { BinanceCexFutureOrderbookWsAdapter } from './services/adapters/binance-cex-future-orderbook-ws.adapter'
import { BinanceCexPerpetualOrderbookWsAdapter } from './services/adapters/binance-cex-perpetual-orderbook-ws.adapter'
import { BinanceCexSpotOrderbookWsAdapter } from './services/adapters/binance-cex-spot-orderbook-ws.adapter'
import { BybitCexFutureOrderbookWsAdapter } from './services/adapters/bybit-cex-future-orderbook-ws.adapter'
import { BybitCexPerpetualOrderbookWsAdapter } from './services/adapters/bybit-cex-perpetual-orderbook-ws.adapter'
import { BybitCexSpotOrderbookWsAdapter } from './services/adapters/bybit-cex-spot-orderbook-ws.adapter'
import { OkxCexFutureOrderbookWsAdapter } from './services/adapters/okx-cex-future-orderbook-ws.adapter'
import { OkxCexPerpetualOrderbookWsAdapter } from './services/adapters/okx-cex-perpetual-orderbook-ws.adapter'
import { OkxCexSpotOrderbookWsAdapter } from './services/adapters/okx-cex-spot-orderbook-ws.adapter'
import { AdminDataPullTaskService } from './services/admin-data-pull-task.service'
import { OrderbookWsSyncManager } from './services/orderbook-ws-sync-manager.service'

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
    ExampleOrderbookJob,
    OpenInterestSyncJob,
    CoinglassAggregatedLiquidationJob,
    BbxCryptoStockQuotesJob,
    // Job registry，将多个 Job 注入为一个数组
    {
      provide: DATA_PULL_JOB_REGISTRY,
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: (
        exampleKlineJob: ExampleKlineJob,
        exampleNewsJob: ExampleNewsJob,
        coinglassHeatmapJob: CoinglassHeatmapJob,
        exampleOrderbookJob: ExampleOrderbookJob,
        openInterestSyncJob: OpenInterestSyncJob,
        coinglassAggregatedLiquidationJob: CoinglassAggregatedLiquidationJob,
        bbxCryptoStockQuotesJob: BbxCryptoStockQuotesJob,
      ): DataPullJob[] => [
        exampleKlineJob,
        exampleNewsJob,
        coinglassHeatmapJob,
        exampleOrderbookJob,
        openInterestSyncJob,
        coinglassAggregatedLiquidationJob,
        bbxCryptoStockQuotesJob,
      ],
      inject: [
        ExampleKlineJob,
        ExampleNewsJob,
        CoinglassHeatmapJob,
        ExampleOrderbookJob,
        OpenInterestSyncJob,
        CoinglassAggregatedLiquidationJob,
        BbxCryptoStockQuotesJob,
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
    BybitCexSpotOrderbookWsAdapter,
    BybitCexPerpetualOrderbookWsAdapter,
    BybitCexFutureOrderbookWsAdapter,
    OkxCexSpotOrderbookWsAdapter,
    OkxCexPerpetualOrderbookWsAdapter,
    OkxCexFutureOrderbookWsAdapter,
    {
      provide: ORDERBOOK_WS_ADAPTER_REGISTRY,
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: (
        binanceCexSpotOrderbookWsAdapter: BinanceCexSpotOrderbookWsAdapter,
        binanceCexPerpetualOrderbookWsAdapter: BinanceCexPerpetualOrderbookWsAdapter,
        binanceCexFutureOrderbookWsAdapter: BinanceCexFutureOrderbookWsAdapter,
        bybitCexSpotOrderbookWsAdapter: BybitCexSpotOrderbookWsAdapter,
        bybitCexPerpetualOrderbookWsAdapter: BybitCexPerpetualOrderbookWsAdapter,
        bybitCexFutureOrderbookWsAdapter: BybitCexFutureOrderbookWsAdapter,
        okxCexSpotOrderbookWsAdapter: OkxCexSpotOrderbookWsAdapter,
        okxCexPerpetualOrderbookWsAdapter: OkxCexPerpetualOrderbookWsAdapter,
        okxCexFutureOrderbookWsAdapter: OkxCexFutureOrderbookWsAdapter,
      ) => [
        binanceCexSpotOrderbookWsAdapter,
        binanceCexPerpetualOrderbookWsAdapter,
        binanceCexFutureOrderbookWsAdapter,
        bybitCexSpotOrderbookWsAdapter,
        bybitCexPerpetualOrderbookWsAdapter,
        bybitCexFutureOrderbookWsAdapter,
        okxCexSpotOrderbookWsAdapter,
        okxCexPerpetualOrderbookWsAdapter,
        okxCexFutureOrderbookWsAdapter,
      ],
      inject: [
        BinanceCexSpotOrderbookWsAdapter,
        BinanceCexPerpetualOrderbookWsAdapter,
        BinanceCexFutureOrderbookWsAdapter,
        BybitCexSpotOrderbookWsAdapter,
        BybitCexPerpetualOrderbookWsAdapter,
        BybitCexFutureOrderbookWsAdapter,
        OkxCexSpotOrderbookWsAdapter,
        OkxCexPerpetualOrderbookWsAdapter,
        OkxCexFutureOrderbookWsAdapter,
      ],
    },
    OrderbookWsSyncManager,
  ],
})
export class DataSyncModule {}
