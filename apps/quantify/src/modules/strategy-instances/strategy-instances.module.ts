import { Module } from '@nestjs/common'

import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { StrategySignalsGenerationModule } from '@/modules/strategy-signals/strategy-signals-generation.module'
import { PrismaModule } from '@/prisma/prisma.module'

import { LiveStrategyInstancesController } from './controllers/live-strategy-instances.controller'
import { OpsStrategyInstancesController } from './controllers/ops-strategy-instances.controller'
import { StrategyInstancesRepository } from './repositories/strategy-instances.repository'
import { StrategyInstanceStatsService } from './services/strategy-instance-stats.service'
import { StrategyInstancesService } from './services/strategy-instances.service'

@Module({
  imports: [PrismaModule, StrategySignalsGenerationModule, MarketDataModule],
  controllers: [OpsStrategyInstancesController, LiveStrategyInstancesController],
  providers: [StrategyInstancesService, StrategyInstancesRepository, StrategyInstanceStatsService],
  exports: [StrategyInstancesService, StrategyInstanceStatsService],
})
export class StrategyInstancesModule {}
