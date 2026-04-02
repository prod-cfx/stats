import { Test } from '@nestjs/testing'
import { BacktestingModule } from './backtesting.module'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'
import { BacktestMarketDataService } from './services/backtest-market-data.service'

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [BacktestingModule] })
      .overrideProvider(BacktestCapabilitiesRepository)
      .useValue({ findActiveConfig: jest.fn() })
      .overrideProvider(BacktestMarketDataService)
      .useValue({ resolveCoverage: jest.fn(), loadBars: jest.fn() })
      .compile()
    expect(mod).toBeDefined()
  })
})
