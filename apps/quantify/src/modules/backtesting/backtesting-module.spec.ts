import { Test } from '@nestjs/testing'
import { BacktestingModule } from './backtesting.module'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'
import { BacktestMarketDataRepository } from './repositories/backtest-market-data.repository'
import { BacktestMarketDataService } from './services/backtest-market-data.service'
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'

jest.mock('@/prisma/prisma.module', () => ({
  PrismaModule: class PrismaModule {},
}))

jest.mock('@/modules/market-data/market-data.module', () => ({
  MarketDataModule: class MarketDataModule {},
}))

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [BacktestingModule] })
      .overrideProvider(BacktestCapabilitiesRepository)
      .useValue({ findActiveConfig: jest.fn() })
      .overrideProvider(BacktestJobsService)
      .useValue({ createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() })
      .overrideProvider(BacktestMarketDataRepository)
      .useValue({ findSymbolsByCodes: jest.fn(), findBars: jest.fn(), aggregateCoverage: jest.fn() })
      .overrideProvider(BacktestMarketDataService)
      .useValue({ resolveCoverage: jest.fn(), loadBars: jest.fn() })
      .overrideProvider(BacktestSymbolSupportService)
      .useValue({ checkSymbolSupport: jest.fn() })
      .compile()
    expect(mod).toBeDefined()
  })
})
