import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { strategySignalsConfig } from "@/config/configuration"
import { AccountsModule } from "@/modules/accounts/accounts.module"
import { PositionsModule } from "@/modules/positions/positions.module"
import { TradingModule } from "@/modules/trading/trading.module"
import { PrismaModule } from "@/prisma/prisma.module"
import { FixedSignalContextRepository } from './repositories/fixed-signal-context.repository'
import { SignalExecutionRepository } from './repositories/signal-execution.repository'
import { SignalExecutorRepository } from './repositories/signal-executor.repository'
import { FixedBinanceTestnetSignalService } from "./services/fixed-binance-testnet-signal.service"
import { FixedHyperliquidTestnetSignalService } from "./services/fixed-hyperliquid-testnet-signal.service"
import { FixedOkxSimulatedSignalService } from "./services/fixed-okx-simulated-signal.service"
import { SignalExecutorService } from "./services/signal-executor.service"
import { StrategySignalsGenerationModule } from "./strategy-signals-generation.module"

@Module({
  imports: [PrismaModule, AccountsModule, PositionsModule, TradingModule, StrategySignalsGenerationModule, ConfigModule.forFeature(strategySignalsConfig)],
  providers: [SignalExecutorService, SignalExecutionRepository, SignalExecutorRepository, FixedSignalContextRepository, FixedBinanceTestnetSignalService, FixedOkxSimulatedSignalService, FixedHyperliquidTestnetSignalService],
  exports: [SignalExecutorService, FixedBinanceTestnetSignalService, FixedOkxSimulatedSignalService, FixedHyperliquidTestnetSignalService],
})
export class StrategySignalsExecutionModule {}
