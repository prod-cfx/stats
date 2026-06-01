import { Test } from '@nestjs/testing'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { BacktestingModule } from './backtesting.module'
import { BacktestJobRepository } from './jobs/backtest-job.repository'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestQueueProducer } from './jobs/backtest-queue.producer'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'
import { BacktestMarketDataRepository } from './repositories/backtest-market-data.repository'
import { RiskEvaluatorService } from './risk/risk-evaluator.service'
import { BacktestMarketDataService } from './services/backtest-market-data.service'
import { BacktestSnapshotLoaderService } from './services/backtest-snapshot-loader.service'
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'

jest.mock('@/prisma/prisma.module', () => ({
  PrismaModule: class PrismaModule {},
}))

jest.mock('@/modules/market-data/market-data.module', () => ({
  MarketDataModule: class MarketDataModule {},
}))
jest.mock('./backtesting.controller', () => ({
  BacktestingController: class BacktestingController {},
}))

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true }), BacktestingModule] })
      .overrideProvider(BacktestCapabilitiesRepository)
      .useValue({ findActiveConfig: jest.fn() })
      .overrideProvider(BacktestJobsService)
      .useValue({ createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() })
      .overrideProvider(BacktestJobRepository)
      .useValue({ findById: jest.fn() })
      .overrideProvider(BacktestQueueProducer)
      .useValue({ enqueue: jest.fn() })
      .overrideProvider(ConfigService)
      .useValue({ get: jest.fn() })
      .overrideProvider(BacktestMarketDataRepository)
      .useValue({ findSymbolsByCodes: jest.fn(), findBars: jest.fn(), aggregateCoverage: jest.fn() })
      .overrideProvider(BacktestMarketDataService)
      .useValue({ resolveCoverage: jest.fn(), loadBars: jest.fn() })
      .overrideProvider(AiQuantConversationsRepository)
      .useValue({ updateLastBacktestRef: jest.fn() })
      .overrideProvider(PublishedStrategySnapshotsRepository)
      .useValue({ findById: jest.fn() })
      .overrideProvider(BacktestSnapshotLoaderService)
      .useValue({ load: jest.fn() })
      .overrideProvider(BacktestSymbolSupportService)
      .useValue({ checkSymbolSupport: jest.fn() })
      .compile()
    expect(mod).toBeDefined()
    expect(mod.get(RiskEvaluatorService)).toBeDefined()
    await mod.close()
  })
})
