import { Test } from '@nestjs/testing'
import { StrategyRuntimeExecutionStateRepository } from './repositories/strategy-runtime-execution-state.repository'
import { SignalGeneratorService } from './services/signal-generator.service'
import { StrategyRuntimeExecutionStateService } from './services/strategy-runtime-execution-state.service'
import { StrategySignalsGenerationModule } from './strategy-signals-generation.module'

jest.mock('@/prisma/prisma.module', () => ({
  PrismaModule: class PrismaModule {},
}))

jest.mock('@/modules/ai/ai.module', () => ({
  AiModule: class AiModule {},
}))

jest.mock('@/modules/market-data/market-data.module', () => ({
  MarketDataModule: class MarketDataModule {},
}))

describe('strategySignalsGenerationModule', () => {
  it('wires runtime execution state providers for runtime flows', async () => {
    const mod = await Test.createTestingModule({ imports: [StrategySignalsGenerationModule] })
      .overrideProvider(SignalGeneratorService)
      .useValue({})
      .useMocker((token) => {
        if (typeof token === 'function') return {}
        return undefined
      })
      .compile()

    expect(mod.get(StrategyRuntimeExecutionStateRepository)).toBeDefined()
    expect(mod.get(StrategyRuntimeExecutionStateService)).toBeDefined()
  })
})
