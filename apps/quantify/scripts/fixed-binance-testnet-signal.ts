import 'reflect-metadata'
import type { SignalDirection, SignalType } from '@ai/shared'
import * as path from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { loadEnvironment } from '@net/config'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { EnvService } from '@/common/services/env.service'
import { TransactionEventsModule } from '@/common/modules/transaction-events.module'
import { strategySignalsConfig } from '@/config/configuration'
import { applyQuantifyEnvOverrides } from '@/config/quantify-env'
import { AccountsModule } from '@/modules/accounts/accounts.module'
import { AccountsService } from '@/modules/accounts/accounts.service'
import { PositionsModule } from '@/modules/positions/positions.module'
import { PositionsService } from '@/modules/positions/positions.service'
import { SignalExecutionRepository } from '@/modules/strategy-signals/repositories/signal-execution.repository'
import { TradingSignalRepository } from '@/modules/strategy-signals/repositories/trading-signal.repository'
import { parseFixedBinanceTestnetCliOptions } from '@/modules/strategy-signals/services/fixed-binance-testnet-signal-cli'
import { resolveFixedBinanceSmokeQuote } from '@/modules/strategy-signals/services/fixed-binance-smoke-quote'
import { FixedBinanceTestnetSignalService } from '@/modules/strategy-signals/services/fixed-binance-testnet-signal.service'
import { SignalExecutorService } from '@/modules/strategy-signals/services/signal-executor.service'
import { SignalTelemetryService } from '@/modules/strategy-signals/services/signal-telemetry.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { TradingModule } from '@/modules/trading/trading.module'
import { TradingService } from '@/modules/trading/trading.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { PrismaService } from '@/prisma/prisma.service'

const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [strategySignalsConfig],
    }),
    EnvModule,
    ClsConfigModule,
    TransactionEventsModule,
    PrismaModule,
    TradingModule,
    AccountsModule,
    PositionsModule,
  ],
  providers: [
    TradingSignalRepository,
    SignalExecutionRepository,
    SignalTelemetryService,
    {
      provide: AccountsService,
      useFactory: (prisma: PrismaService) => new AccountsService(prisma),
      inject: [PrismaService],
    },
    {
      provide: PositionsService,
      useFactory: (
        prisma: PrismaService,
        accountsService: AccountsService,
        tradingService: TradingService,
      ) => new PositionsService(prisma, accountsService, tradingService),
      inject: [PrismaService, AccountsService, TradingService],
    },
    {
      provide: SignalExecutorService,
      useFactory: (
        prisma: PrismaService,
        configService: ConfigService,
        tradingService: TradingService,
        accountsService: AccountsService,
        positionsService: PositionsService,
        tradingSignalRepository: TradingSignalRepository,
        executionRepository: SignalExecutionRepository,
        telemetry: SignalTelemetryService,
      ) => new SignalExecutorService(
        prisma,
        configService,
        tradingService,
        accountsService,
        positionsService,
        tradingSignalRepository,
        executionRepository,
        telemetry,
      ),
      inject: [
        PrismaService,
        ConfigService,
        TradingService,
        AccountsService,
        PositionsService,
        TradingSignalRepository,
        SignalExecutionRepository,
        SignalTelemetryService,
      ],
    },
    {
      provide: FixedBinanceTestnetSignalService,
      useFactory: (
        prisma: PrismaService,
        env: EnvService,
        signalExecutor: SignalExecutorService,
      ) => new FixedBinanceTestnetSignalService(prisma, env, signalExecutor),
      inject: [PrismaService, EnvService, SignalExecutorService],
    },
  ],
})
class FixedBinanceTestnetSignalScriptModule {}

async function main() {
  const plan = parseFixedBinanceTestnetCliOptions(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(FixedBinanceTestnetSignalScriptModule, {
    logger: ['error', 'warn', 'log'],
  })

  try {
    const service = app.get(FixedBinanceTestnetSignalService)
    const results = []

    for (const step of plan.steps) {
      const resolvedPositionSizeQuote = resolveFixedBinanceSmokeQuote({
        signalType: step.signalType,
        positionSizeQuote: step.positionSizeQuote,
      })
      const resolvedStep = {
        ...step,
        positionSizeQuote: resolvedPositionSizeQuote,
      }

      const signal = step.execute
        ? await service.createAndExecuteSignal({
            ...resolvedStep,
            executionConfig: {
              ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
              execution: {
                ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
                enabled: true,
                dryRun: false,
                defaultQuoteAmount: Number(resolvedPositionSizeQuote ?? '0'),
                minBalanceThreshold: 0,
                maxRiskFraction: 1,
              },
            },
          })
        : await service.createSignal(resolvedStep)

      results.push({
        signalId: signal.id,
        marketType: step.marketType,
        signalType: step.signalType,
        direction: step.direction,
        executed: step.execute,
        reason: step.reason,
        positionSizeQuote: resolvedPositionSizeQuote ?? null,
      })
    }

    console.log(JSON.stringify({
      mode: plan.mode,
      preset: plan.preset ?? null,
      results,
    }, null, 2))
  }
  finally {
    await app.close()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
