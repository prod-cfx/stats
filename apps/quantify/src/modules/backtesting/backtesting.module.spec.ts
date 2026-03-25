import { Test } from '@nestjs/testing'
import { BacktestingModule } from './backtesting.module'
import { BacktestCapabilitiesRepository } from './repositories/backtest-capabilities.repository'

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [BacktestingModule] })
      .overrideProvider(BacktestCapabilitiesRepository)
      .useValue({ findActiveConfig: jest.fn() })
      .compile()
    expect(mod).toBeDefined()
  })
})
