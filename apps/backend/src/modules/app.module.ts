import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { WinstonModule } from 'nest-winston'
import { ClsMiddleware } from 'nestjs-cls'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter'
import { GlobalRateLimitGuard } from '../common/guards/global-rate-limit.guard'
import { AfterCommitInterceptor } from '../common/interceptors/after-commit.interceptor'
import { LoggerInterceptor } from '../common/interceptors/logger.interceptor'
import { RequestContextInterceptor } from '../common/interceptors/request-context.interceptor'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { CacheModule } from '../common/modules/cache.module'
import { ClsConfigModule } from '../common/modules/cls.module'
import { EnvModule } from '../common/modules/env.module'
import { RateLimitModule } from '../common/modules/rate-limit.module'
import { EnvService } from '../common/services/env.service'
import { allConfigLoaders } from '../config'
import { createWinstonTransports, resolveLoggerConfig } from '../config/logger.config'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminApiModule } from './app-aggregation/admin-api.module'
import { AiQuantBridgeModule } from './app-aggregation/ai-quant-bridge.module'
import { MarketDataModule } from './app-aggregation/market-data.module'
import { NotificationDataSyncModule } from './app-aggregation/notification-data-sync.module'
import { GlobalJwtAuthBoundaryGuard } from './auth/guards/global-jwt-auth-boundary.guard'
import { HealthModule } from './health/health.module'

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
    RateLimitModule,
    PrismaModule, // Global 模块，需要在其他模块之前导入
    ScheduleModule.forRoot(),
    // AppModule 只装配基础设施与业务聚合模块；业务叶子模块由领域聚合模块维护。
    HealthModule,
    AdminApiModule,
    MarketDataModule,
    NotificationDataSyncModule,
    AiQuantBridgeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalRateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthBoundaryGuard,
    },
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
