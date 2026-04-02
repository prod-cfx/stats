import { Module } from '@nestjs/common'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { StrategyInstancesModule } from '@/modules/strategy-instances/strategy-instances.module'
import { TradingModule } from '@/modules/trading/trading.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AccountStrategyViewController } from './controllers/account-strategy-view.controller'
import { AccountStrategyViewRepository } from './repositories/account-strategy-view.repository'
import { AccountStrategyCallerIdentityService } from './services/account-strategy-caller-identity.service'
import { AccountStrategyViewService } from './services/account-strategy-view.service'

@Module({
  imports: [PrismaModule, StrategyInstancesModule, MarketDataModule, TradingModule],
  controllers: [AccountStrategyViewController],
  providers: [
    AccountStrategyViewService,
    AccountStrategyViewRepository,
    AccountStrategyCallerIdentityService,
  ],
  exports: [AccountStrategyViewService],
})
export class AccountStrategyViewModule {}
