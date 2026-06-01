import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { WinstonModule } from 'nest-winston'
import { BullRootModule } from '@/common/modules/bull-root.module'
import { CacheModule } from '@/common/modules/cache.module'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { EnvService } from '@/common/services/env.service'
import { allConfigLoaders } from '@/config'
import { createWinstonTransports, resolveLoggerConfig } from '@/config/logger.config'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { BacktestWorkerProcessor } from './jobs/backtest-worker.processor'
import { BacktestingModule } from './backtesting.module'

const currentEnv = defaultEnvAccessor.appEnv()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${currentEnv}.local`, `.env.${currentEnv}`],
      load: allConfigLoaders,
    }),
    EnvModule,
    ClsConfigModule,
    EventEmitterModule.forRoot({ maxListeners: 0, wildcard: false, ignoreErrors: false }),
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
    BullRootModule,
    CacheModule,
    BacktestingModule,
  ],
  providers: [BacktestWorkerProcessor],
})
export class BacktestingWorkerModule {}
