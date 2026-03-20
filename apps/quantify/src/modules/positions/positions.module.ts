import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AccountsModule } from '@/modules/accounts/accounts.module'
import { TradingModule } from '@/modules/trading/trading.module'
import { PositionSyncSchedulerService } from './position-sync-scheduler.service'
import { PositionSyncService } from './position-sync.service'
import { PositionsValuationService } from './positions-valuation.service'
import { PositionsController } from './positions.controller'
import { PositionsService } from './positions.service'

@Module({
  imports: [AccountsModule, TradingModule, ScheduleModule.forRoot()],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsValuationService, PositionSyncService, PositionSyncSchedulerService],
  exports: [PositionsService, PositionsValuationService, PositionSyncService],
})
export class PositionsModule {}
