import { Module } from '@nestjs/common'

import { OpsTradingSignalsController } from './controllers/ops-trading-signals.controller'
import { StrategySignalsExecutionModule } from './strategy-signals-execution.module'
import { StrategySignalsGenerationModule } from './strategy-signals-generation.module'

@Module({
  imports: [
    StrategySignalsGenerationModule, // Already exports TradingSignalRepository
    StrategySignalsExecutionModule,
  ],
  controllers: [OpsTradingSignalsController],
  exports: [StrategySignalsGenerationModule, StrategySignalsExecutionModule],
})
export class StrategySignalsModule {}
