import { Module } from '@nestjs/common'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'
import { TheoreticalExecutionModel } from './execution/theoretical-execution.model'
import { PortfolioLedgerServiceFactory } from './portfolio/portfolio-ledger.service'
import { BacktestReporterService } from './report/backtest-reporter.service'
import { StateEngineService } from './state/state-engine.service'

@Module({
  controllers: [BacktestingController],
  providers: [
    BacktestRunnerService,
    TheoreticalExecutionModel,
    PortfolioLedgerServiceFactory,
    BacktestReporterService,
    StateEngineService,
  ],
})
export class BacktestingModule {}
