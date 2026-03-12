import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { strategySignalsConfig } from "@/config/configuration"
import { AccountsModule } from "@/modules/accounts/accounts.module"
import { PositionsModule } from "@/modules/positions/positions.module"
import { TradingModule } from "@/modules/trading/trading.module"
import { PrismaModule } from "@/prisma/prisma.module"
import { SignalExecutionRepository } from './repositories/signal-execution.repository'
import { SignalExecutorService } from "./services/signal-executor.service"
import { StrategySignalsGenerationModule } from "./strategy-signals-generation.module"

@Module({
  imports: [PrismaModule, AccountsModule, PositionsModule, TradingModule, StrategySignalsGenerationModule, ConfigModule.forFeature(strategySignalsConfig)],
  providers: [SignalExecutorService, SignalExecutionRepository],
  exports: [SignalExecutorService],
})
export class StrategySignalsExecutionModule {}
