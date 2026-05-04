import { Module } from '@nestjs/common'
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { GridRuntimeController } from './controllers/grid-runtime.controller'
import { TradingModule } from '../trading/trading.module'
import { TradingExecutionModule } from '../trading-execution/trading-execution.module'
import { GridRuntimeRepository } from './repositories/grid-runtime.repository'
import { GridOrderPlannerService } from './services/grid-order-planner.service'
import { GridOrderSyncService } from './services/grid-order-sync.service'
import { GridRuntimeSchedulerService } from './services/grid-runtime-scheduler.service'
import { GridRuntimeService } from './services/grid-runtime.service'
import { GridRuntimeStateMachineService } from './services/grid-runtime-state-machine.service'

@Module({
  imports: [PrismaModule, TradingModule, TradingExecutionModule],
  controllers: [GridRuntimeController],
  providers: [
    GridRuntimeRepository,
    GridOrderPlannerService,
    GridRuntimeStateMachineService,
    GridOrderSyncService,
    GridRuntimeService,
    GridRuntimeSchedulerService,
    AccountStrategyCallerIdentityService,
  ],
  exports: [GridRuntimeService],
})
export class GridRuntimeModule {}
