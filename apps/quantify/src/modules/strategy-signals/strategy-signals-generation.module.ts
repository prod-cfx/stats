import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { strategySignalsConfig } from "@/config/configuration"
import { AiModule } from "@/modules/ai/ai.module"
import { PrismaModule } from "@/prisma/prisma.module"
import { StrategySignalStateRepository } from "./repositories/strategy-signal-state.repository"
import { TradingSignalRepository } from "./repositories/trading-signal.repository"
import { SignalGeneratorService } from "./services/signal-generator.service"
import { SignalTelemetryService } from "./services/signal-telemetry.service"

@Module({
  imports: [PrismaModule, AiModule, ConfigModule.forFeature(strategySignalsConfig)],
  providers: [SignalGeneratorService, SignalTelemetryService, TradingSignalRepository, StrategySignalStateRepository],
  exports: [SignalGeneratorService, SignalTelemetryService, TradingSignalRepository, StrategySignalStateRepository],
})
export class StrategySignalsGenerationModule {}
