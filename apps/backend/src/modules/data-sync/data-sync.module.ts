import { forwardRef, Module } from '@nestjs/common'
import { GoogleTranslateClient } from '@/clients/google-translate/google-translate.client'
import { PolymarketClobClient, PolymarketGammaClient } from '@/clients/polymarket'
import { AuthModule } from '@/modules/auth/auth.module'
import { CryptoStockQuotesModule } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.module'
import { LiquidationHeatmapModule } from '@/modules/liquidation-heatmap/liquidation-heatmap.module'
import { MarketsModule } from '@/modules/markets/markets.module'
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
  DATA_PULL_JOB_PROVIDERS,
  ORDERBOOK_WS_ADAPTER_PROVIDERS,
  TRADES_WS_ADAPTER_PROVIDERS,
} from './data-sync.registry'
import { TRADES_WS_ADAPTER_REGISTRY } from './data-sync.tokens'
import { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from './repositories/data-pull-task.repository'
import { HyperliquidDexPerpetualTradesWsAdapter } from './services/adapters/hyperliquid-dex-perpetual-trades-ws.adapter'
import { HyperliquidTradesWsConfig } from './services/adapters/hyperliquid/hyperliquid-trades-ws.config'
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
    // Job 实现 + registry
    ...DATA_PULL_JOB_PROVIDERS,
    PolymarketGammaClient,
    PolymarketClobClient,
    PolymarketRepository,
    GoogleTranslateClient,
    // 统一编排 & Cron
    DataSyncOrchestrator,
    DataSyncCronService,
    // 管理后台：数据拉取任务 CRUD
    AdminDataPullTaskService,

    // ===== Orderbook WS sync（动态订阅/退订；按 orderbook_pair_configs 驱动）=====
    ...ORDERBOOK_WS_ADAPTER_PROVIDERS,
    OrderbookWsSyncManager,

    // ===== Trades WS sync（动态订阅交易记录）=====
    HyperliquidTradesWsConfig,
    ...TRADES_WS_ADAPTER_PROVIDERS,
    TradesWsSyncManager,
  ],
  exports: [HyperliquidDexPerpetualTradesWsAdapter, TRADES_WS_ADAPTER_REGISTRY],
})
export class DataSyncModule {}
