import { Module } from '@nestjs/common'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'
import { AccountsRepository } from './repositories/accounts.repository'
import { StrategyPnlReportRepository } from './repositories/strategy-pnl-report.repository'
import { StrategyPnlReportService } from './strategy-pnl-report.service'

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, StrategyPnlReportService, AccountsRepository, StrategyPnlReportRepository],
  exports: [AccountsService, StrategyPnlReportService],
})
export class AccountsModule {}
