import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { strategySignalsConfig } from "@/config/configuration"
import { AiModule } from "@/modules/ai/ai.module"
import { MarketDataModule } from "@/modules/market-data/market-data.module"
import { PrismaModule } from "@/prisma/prisma.module"
import { SignalGeneratorRepository } from "./repositories/signal-generator.repository"
import { StrategySignalStateRepository } from "./repositories/strategy-signal-state.repository"
import { TradingSignalRepository } from "./repositories/trading-signal.repository"
import { SignalGeneratorService } from "./services/signal-generator.service"
import { SignalTelemetryService } from "./services/signal-telemetry.service"

@Module({
  imports: [PrismaModule, AiModule, MarketDataModule, ConfigModule.forFeature(strategySignalsConfig)],
  providers: [SignalGeneratorService, SignalTelemetryService, TradingSignalRepository, StrategySignalStateRepository, SignalGeneratorRepository],
  exports: [SignalGeneratorService, SignalTelemetryService, TradingSignalRepository, StrategySignalStateRepository],
})
export class StrategySignalsGenerationModule {}
