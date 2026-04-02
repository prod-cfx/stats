import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { EnvModule } from '@/common/modules/env.module'
import { MarketDataModule } from '@/modules/market-data/market-data.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'
import { TheoreticalExecutionModel } from './execution/theoretical-execution.model'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { PortfolioLedgerServiceFactory } from './portfolio/portfolio-ledger.service'
import { BacktestReporterService } from './report/backtest-reporter.service'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
import { BacktestCapabilitiesService } from './services/backtest-capabilities.service'
import { BacktestMarketDataService } from './services/backtest-market-data.service'
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'
import { BacktestStrategyAdapterService } from './services/backtest-strategy-adapter.service'
import { StateEngineService } from './state/state-engine.service'

@Module({
  imports: [EnvModule, PrismaModule, MarketDataModule, ThrottlerModule.forRoot()],
  controllers: [BacktestingController],
  providers: [
    BacktestRunnerService,
    BacktestJobsService,
    BacktestMarketDataService,
    TheoreticalExecutionModel,
    PortfolioLedgerServiceFactory,
    BacktestReporterService,
    BacktestCallerIdentityService,
    BacktestCapabilitiesService,
    BacktestStrategyAdapterService,
    StateEngineService,
    BacktestCapabilitiesRepository,
    BacktestSymbolSupportService,
  ],
})
export class BacktestingModule {}
