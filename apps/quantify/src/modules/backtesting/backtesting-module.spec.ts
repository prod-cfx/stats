import { Test } from '@nestjs/testing'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { PrismaService } from '@/prisma/prisma.service'
import { BacktestingModule } from './backtesting.module'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'
import { BacktestMarketDataRepository } from './repositories/backtest-market-data.repository'
import { BacktestMarketDataService } from './services/backtest-market-data.service'

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [BacktestingModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(TransactionEventsService)
      .useValue({})
      .overrideProvider(BacktestCapabilitiesRepository)
      .useValue({ findActiveConfig: jest.fn() })
      .overrideProvider(BacktestMarketDataRepository)
      .useValue({ findSymbolsByCodes: jest.fn(), findBars: jest.fn(), aggregateCoverage: jest.fn() })
      .overrideProvider(BacktestMarketDataService)
      .useValue({ resolveCoverage: jest.fn(), loadBars: jest.fn() })
      .compile()
    expect(mod).toBeDefined()
  })
})
