import { Test } from '@nestjs/testing'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'
import { BacktestJobsService } from './jobs/backtest-jobs.service'

describe('backtestingController', () => {
  it('should expose run and jobs endpoint methods', async () => {
    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        {
          provide: BacktestRunnerService,
          useValue: { run: jest.fn() },
        },
        {
          provide: BacktestJobsService,
          useValue: { createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() },
        },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    expect(typeof c.run).toBe('function')
    expect(typeof c.createJob).toBe('function')
    expect(typeof c.getJob).toBe('function')
    expect(typeof c.getJobResult).toBe('function')
  })
})
