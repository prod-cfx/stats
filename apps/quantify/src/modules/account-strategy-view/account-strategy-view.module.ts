import { Module } from '@nestjs/common'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { StrategyInstancesModule } from '@/modules/strategy-instances/strategy-instances.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AccountStrategyViewController } from './controllers/account-strategy-view.controller'
import { AccountStrategyViewRepository } from './repositories/account-strategy-view.repository'
import { AccountStrategyViewService } from './services/account-strategy-view.service'

@Module({
  imports: [PrismaModule, StrategyInstancesModule, MarketDataModule],
  controllers: [AccountStrategyViewController],
  providers: [AccountStrategyViewService, AccountStrategyViewRepository],
  exports: [AccountStrategyViewService],
})
export class AccountStrategyViewModule {}
