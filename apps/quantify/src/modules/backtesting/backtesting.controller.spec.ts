import { Test } from '@nestjs/testing'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'

describe('backtestingController', () => {
  it('should expose run endpoint method', async () => {
    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        {
          provide: BacktestRunnerService,
          useValue: { run: jest.fn() },
        },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    expect(typeof c.run).toBe('function')
  })
})
