import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { WinstonModule } from 'nest-winston'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter'
import { LoggerInterceptor } from '../common/interceptors/logger.interceptor'
import { RequestContextInterceptor } from '../common/interceptors/request-context.interceptor'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { CacheModule } from '../common/modules/cache.module'
import { ClsConfigModule } from '../common/modules/cls.module'
import { EnvModule } from '../common/modules/env.module'
import { TransactionEventsModule } from '../common/modules/transaction-events.module'
import { EnvService } from '../common/services/env.service'
import { allConfigLoaders } from '../config'
import { createWinstonTransports, resolveLoggerConfig } from '../config/logger.config'
import { PrismaModule } from '../prisma/prisma.module'
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
import { StrategySubscriptionsModule } from './strategy-subscriptions/strategy-subscriptions.module'
import { StrategyTemplatesModule } from './strategy-templates/strategy-templates.module'
import { TradingModule } from './trading/trading.module'

// 缁熶竴鐜璇嗗埆锛氭敮鎸?APP_ENV/NODE_ENV fallback 鍜屽埆鍚嶏紙prod/stage 绛夛級
const currentEnv = defaultEnvAccessor.appEnv()
const bullImports = isMessageBusRuntimeEnabled()
  ? [
      BullModule.forRootAsync({
        useFactory: (env: EnvService) => {
          const url = env.getString('REDIS_URL')
          if (!url) {
            throw new Error('REDIS_URL is required for Bull queue initialization')
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
      // 浼樺厛鍔犺浇 .env.<env>.local锛屽洖閫€鍒?.env.<env>
      envFilePath: [`.env.${currentEnv}.local`, `.env.${currentEnv}`],
      load: allConfigLoaders,
    }),
    EnvModule,
    ClsConfigModule, // 蹇呴』鍦?PrismaModule 涔嬪墠瀵煎叆
    EventEmitterModule.forRoot({
      // SSE 绛夊満鏅彲鑳芥湁澶ч噺鐩戝惉鍣紙姣忎釜杩炴帴涓€涓級锛岀Щ闄ら粯璁?10 涓殑闄愬埗
      maxListeners: 0,
      // 寮€鍚€氶厤绗︽敮鎸侊紙濡傛灉闇€瑕侊級
      wildcard: false,
      // 閿欒澶勭悊锛氶粯璁ゆ姏鍑洪敊璇?
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
    ...bullImports,
    CacheModule, // 蹇呴』鍦?WinstonModule 涔嬪悗,鍥犱负 RedisService 渚濊禆 WINSTON_MODULE_NEST_PROVIDER
    TransactionEventsModule, // 鍏ㄥ眬浜嬪姟浜嬩欢鏈嶅姟
    PrismaModule, // Global 妯″潡锛岄渶瑕佸湪鍏朵粬妯″潡涔嬪墠瀵煎叆
    ScheduleModule.forRoot(),
    ...infrastructureImports,
    HealthModule,
    SettingsModule,
    BacktestingModule,
    AccountsModule,
    IndicatorsModule,
    PositionsModule,
    MarketDataModule,
    TradingModule,
    StrategySignalsModule,
    StrategyTemplatesModule,
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
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
