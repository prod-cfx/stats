import { Module } from '@nestjs/common'
import { GridRuntimeModule } from '@/modules/grid-runtime/grid-runtime.module'
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { PositionsModule } from '@/modules/positions/positions.module'
import { StrategyInstancesModule } from '@/modules/strategy-instances/strategy-instances.module'
import { StrategySignalsGenerationModule } from '@/modules/strategy-signals/strategy-signals-generation.module'
import { TradingModule } from '@/modules/trading/trading.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AccountStrategyViewController } from './controllers/account-strategy-view.controller'
import { AccountStrategyViewRepository } from './repositories/account-strategy-view.repository'
import { AccountStrategyCallerIdentityService } from './services/account-strategy-caller-identity.service'
import { AccountStrategyViewService } from './services/account-strategy-view.service'

@Module({
  imports: [PrismaModule, StrategyInstancesModule, MarketDataModule, TradingModule, StrategySignalsGenerationModule, PositionsModule, GridRuntimeModule],
  controllers: [AccountStrategyViewController],
  providers: [
    AccountStrategyViewService,
    AccountStrategyViewRepository,
    AccountStrategyCallerIdentityService,
    PublishedStrategySnapshotsRepository,
  ],
  exports: [AccountStrategyViewService],
})
export class AccountStrategyViewModule {}
