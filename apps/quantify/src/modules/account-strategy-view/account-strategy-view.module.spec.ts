import { Test } from '@nestjs/testing'
import { AccountStrategyViewController } from './controllers/account-strategy-view.controller'
import { AccountStrategyViewRepository } from './repositories/account-strategy-view.repository'
import { AccountStrategyViewService } from './services/account-strategy-view.service'

describe('accountStrategyViewModule', () => {
  it('should wire module providers and controller', async () => {
    const mod = await Test.createTestingModule({
      controllers: [AccountStrategyViewController],
      providers: [
        AccountStrategyViewService,
        AccountStrategyViewRepository,
        { provide: 'PrismaService', useValue: {} },
        { provide: 'StrategyInstanceStatsService', useValue: {} },
        { provide: 'StrategyInstancesService', useValue: {} },
      ],
    })
      .useMocker((token) => {
        if (typeof token === 'function') return {}
        return undefined
      })
      .compile()

    expect(mod.get(AccountStrategyViewController)).toBeDefined()
    expect(mod.get(AccountStrategyViewService)).toBeDefined()
  })
})
