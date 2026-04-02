import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { WinstonModule } from 'nest-winston'
import { ClsMiddleware } from 'nestjs-cls'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter'
import { AfterCommitInterceptor } from '../common/interceptors/after-commit.interceptor'
import { LoggerInterceptor } from '../common/interceptors/logger.interceptor'
import { RequestContextInterceptor } from '../common/interceptors/request-context.interceptor'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { CacheModule } from '../common/modules/cache.module'
import { ClsConfigModule } from '../common/modules/cls.module'
import { EnvModule } from '../common/modules/env.module'
import { EnvService } from '../common/services/env.service'
import { allConfigLoaders } from '../config'
import { createWinstonTransports, resolveLoggerConfig } from '../config/logger.config'
import { PrismaModule } from '../prisma/prisma.module'
import { AccountExchangeAccountsModule } from './account-exchange-accounts/account-exchange-accounts.module'
import { AdminModule } from './admin/admin.module'
import { AggregatedLiquidationModule } from './aggregated-liquidation/aggregated-liquidation.module'
import { AggregatedOrderbookModule } from './aggregated-orderbook/aggregated-orderbook.module'
import { AiQuantProxyModule } from './ai-quant-proxy/ai-quant-proxy.module'
import { AuthModule } from './auth/auth.module'
import { CryptoStockQuotesModule } from './crypto-stock-quotes/crypto-stock-quotes.module'
import { DataSyncModule } from './data-sync/data-sync.module'
import { ExchangeConfigModule } from './exchange-config/exchange-config.module'
import { HealthModule } from './health/health.module'
import { KlineModule } from './kline/kline.module'
import { LiquidationHeatmapModule } from './liquidation-heatmap/liquidation-heatmap.module'
import { MarketsModule } from './markets/markets.module'
import { OpenInterestModule } from './open-interest/open-interest.module'
import { OrderbookConfigModule } from './orderbook-config/orderbook-config.module'
import { PolymarketModule } from './polymarket/polymarket.module'
import { SettingsModule } from './settings/settings.module'
import { TradesConfigModule } from './trades-config/trades-config.module'
import { UserModule } from './user/user.module'
import { WhaleAlertModule } from './whale-alert/whale-alert.module'
import { WhaleHoldingsModule } from './whale-holdings/whale-holdings.module'
import { WhaleNotificationModule } from './whale-notification/whale-notification.module'
import { WhaleTrackingModule } from './whale-tracking/whale-tracking.module'

// 统一环境识别：支持 APP_ENV/NODE_ENV fallback 和别名（prod/stage 等）
const currentEnv = defaultEnvAccessor.appEnv()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 优先加载 .env.<env>.local，回退到 .env.<env>
      envFilePath: [`.env.${currentEnv}.local`, `.env.${currentEnv}`],
      load: allConfigLoaders,
    }),
    EnvModule,
    ClsConfigModule, // 必须在 PrismaModule 之前导入
    EventEmitterModule.forRoot({
      // SSE 等场景可能有大量监听器（每个连接一个），移除默认 10 个的限制
      maxListeners: 0,
      // 开启通配符支持（如果需要）
      wildcard: false,
      // 错误处理：默认抛出错误
      ignoreErrors: false,
    }),
    WinstonModule.forRootAsync({
      useFactory: (env: EnvService) => {
        const config = resolveLoggerConfig()
        return {
          level: config.level,
          transports: createWinstonTransports(config, env),
        }
      },
      inject: [EnvService],
    }),
    CacheModule, // 必须在 WinstonModule 之后,因为 RedisService 依赖 WINSTON_MODULE_NEST_PROVIDER
    PrismaModule, // Global 模块，需要在其他模块之前导入
    ScheduleModule.forRoot(),
    // === 业务裁剪说明 ===
    // 目前仅保留基础技术骨架相关模块：
    // - HealthModule：健康检查
    // - SettingsModule：通用系统设置
    // - UserModule：用户基础信息
    // - AuthModule：认证与 RBAC
    // - AdminModule：管理员后台基础能力
    //
    // 其他与策略、交易、市场数据等强业务相关的模块
    //（如 Accounts/Positions/Trading/Strategies 等）已从 AppModule 中移除，
    // 如需恢复可在此重新加入对应模块。
    HealthModule,
    SettingsModule,
    UserModule,
    AuthModule,
    AccountExchangeAccountsModule,
    AiQuantProxyModule,
    AdminModule,
    // 统一数据拉取 & 调度模块（K 线、新闻等）
    DataSyncModule,
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
    WhaleAlertModule,
    WhaleNotificationModule,
    CryptoStockQuotesModule,
    WhaleTrackingModule,
    WhaleHoldingsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AfterCommitInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('/')
  }
}
