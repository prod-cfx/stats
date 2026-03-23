import { Module } from '@nestjs/common'

import { OpsTradingSignalsController } from './controllers/ops-trading-signals.controller'
import { OpsTradingSignalsService } from './services/ops-trading-signals.service'
import { StrategySignalsExecutionModule } from './strategy-signals-execution.module'
import { StrategySignalsGenerationModule } from './strategy-signals-generation.module'

@Module({
  imports: [
    StrategySignalsGenerationModule, // Already exports TradingSignalRepository
    StrategySignalsExecutionModule,
  ],
  controllers: [OpsTradingSignalsController],
  providers: [OpsTradingSignalsService],
  exports: [StrategySignalsGenerationModule, StrategySignalsExecutionModule],
})
export class StrategySignalsModule {}
