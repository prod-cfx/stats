import { Test } from '@nestjs/testing'
import { StrategyRuntimeExecutionStateService } from '@/modules/strategy-signals/services/strategy-runtime-execution-state.service'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'
import { AccountStrategyViewModule } from './account-strategy-view.module'
import { AccountStrategyViewService } from './services/account-strategy-view.service'

jest.mock('@/prisma/prisma.module', () => ({
  PrismaModule: class PrismaModule {},
}))

jest.mock('@/modules/strategy-instances/strategy-instances.module', () => ({
  StrategyInstancesModule: class StrategyInstancesModule {},
}))

jest.mock('@/modules/market-data/market-data.module', () => ({
  MarketDataModule: class MarketDataModule {},
}))

jest.mock('@/modules/trading/trading.module', () => ({
  TradingModule: class TradingModule {},
}))

describe('accountStrategyViewModule', () => {
  it('should wire deploy-facing module imports with runtime execution state service available', async () => {
    const mod = await Test.createTestingModule({ imports: [AccountStrategyViewModule] })
      .overrideProvider(SignalGeneratorService)
      .useValue({})
      .useMocker((token) => {
        if (typeof token === 'function') return {}
        return undefined
      })
      .compile()

    expect(mod.get(AccountStrategyViewService)).toBeDefined()
    expect(mod.get(StrategyRuntimeExecutionStateService, { strict: false })).toBeDefined()
  })
})
