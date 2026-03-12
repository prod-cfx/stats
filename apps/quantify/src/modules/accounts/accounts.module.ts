import { Module } from '@nestjs/common'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'
import { StrategyPnlReportService } from './strategy-pnl-report.service'

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, StrategyPnlReportService],
  exports: [AccountsService, StrategyPnlReportService],
})
export class AccountsModule {}
