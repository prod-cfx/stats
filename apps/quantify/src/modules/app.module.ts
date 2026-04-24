import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { BullModule } from '@nestjs/bull'
import { HttpStatus, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { WinstonModule } from 'nest-winston'
import { ClsMiddleware } from 'nestjs-cls'

import { defaultEnvAccessor } from '../common/env/env.accessor'
import { DomainException } from '../common/exceptions/domain.exception'
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
import { AccountStrategyViewModule } from './account-strategy-view/account-strategy-view.module'
import { AccountsModule } from './accounts/accounts.module'
import { BacktestingModule } from './backtesting/backtesting.module'
import { ExchangeAccountsModule } from './exchange-accounts/exchange-accounts.module'
import { HealthModule } from './health/health.module'
import { IndicatorsModule } from './indicators/indicators.module'
import { LlmStrategiesModule } from './llm-strategies/llm-strategies.module'
import { LlmStrategyCodegenModule } from './llm-strategy-codegen/llm-strategy-codegen.module'
import { LlmStrategySubscriptionsModule } from './llm-strategy-subscriptions/llm-strategy-subscriptions.module'
import { MarketDataModule } from './market-data/market-data.module'
import { MessageBusModule } from './message-bus/message-bus.module'
import { isMessageBusRuntimeEnabled } from './message-bus/message-bus.runtime'
import { PositionsModule } from './positions/positions.module'
import { SettingsModule } from './settings/settings.module'
import { StrategyInstancesModule } from './strategy-instances/strategy-instances.module'
import { StrategySignalsModule } from './strategy-signals/strategy-signals.module'
import { StrategyPlazaModule } from './strategy-plaza/strategy-plaza.module'
import { StrategySubscriptionsModule } from './strategy-subscriptions/strategy-subscriptions.module'
import { StrategyTemplatesModule } from './strategy-templates/strategy-templates.module'
import { TradingModule } from './trading/trading.module'

// 统一环境识别：支持 APP_ENV/NODE_ENV fallback 和别名（prod/stage 等）
const currentEnv = defaultEnvAccessor.appEnv()
const bullImports = isMessageBusRuntimeEnabled()
  ? [
      BullModule.forRootAsync({
        // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix -- NestJS API requires the `useFactory` key name.
        useFactory: (env: EnvService) => {
          const url = env.getString('REDIS_URL')
          if (!url) {
            throw new DomainException('redis.missing_url_for_bull', {
              code: ErrorCode.REDIS_CONNECTION_ERROR,
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              args: { key: 'REDIS_URL' },
            })
          }

          return { url }
        },
        inject: [EnvService],
      }),
    ]
  : []

const infrastructureImports = isMessageBusRuntimeEnabled()
  ? [MessageBusModule]
  : []

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
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix -- NestJS API requires the `useFactory` key name.
      useFactory: (env: EnvService) => {
        const config = resolveLoggerConfig()
        return {
          level: config.level,
          transports: createWinstonTransports(config, env),
        }
      },
      inject: [EnvService],
    }),
    ...bullImports,
    CacheModule, // 必须在 WinstonModule 之后，因为 RedisService 依赖 WINSTON_MODULE_NEST_PROVIDER
    PrismaModule, // Global 模块，需要在其他模块之前导入
    ScheduleModule.forRoot(),
    ...infrastructureImports,
    HealthModule,
    SettingsModule,
    BacktestingModule,
    AccountsModule,
    AccountStrategyViewModule,
    IndicatorsModule,
    PositionsModule,
    MarketDataModule,
    TradingModule,
    StrategySignalsModule,
    StrategyTemplatesModule,
    StrategyPlazaModule,
    LlmStrategiesModule,
    LlmStrategyCodegenModule,
    StrategyInstancesModule,
    ExchangeAccountsModule,
    StrategySubscriptionsModule,
    LlmStrategySubscriptionsModule,
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
