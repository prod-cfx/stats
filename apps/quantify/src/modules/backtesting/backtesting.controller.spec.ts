import { Test } from '@nestjs/testing'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
import { BacktestStrategyAdapterService } from './services/backtest-strategy-adapter.service'

jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
}))
jest.mock('@nestjs/throttler', () => ({
  Throttle: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
  ThrottlerGuard: class {
    canActivate() {
      return true
    }
  },
}))

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
        {
          provide: BacktestStrategyAdapterService,
          useValue: { build: jest.fn() },
        },
        {
          provide: BacktestCallerIdentityService,
          useValue: { resolveCallerUserIdFromAuthorization: jest.fn() },
        },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    expect(typeof c.run).toBe('function')
    expect(typeof c.createJob).toBe('function')
    expect(typeof c.getJob).toBe('function')
    expect(typeof c.getJobResult).toBe('function')
  })

  it('adapts script strategy before delegating to runner and jobs service', async () => {
    const runner = { run: jest.fn().mockResolvedValue({ ok: true }) }
    const jobs = { createJob: jest.fn().mockReturnValue({ id: 'job-1' }), getJob: jest.fn(), getJobResult: jest.fn() }
    const adapted = { id: 's1', params: { p: 1 }, fn: jest.fn() }
    const adapter = { build: jest.fn().mockResolvedValue(adapted) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestStrategyAdapterService, useValue: adapter },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    const dto: any = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: { id: 's1', protocolVersion: 'v1', scriptCode: 'strategy', params: { p: 1 } },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    await c.run('Bearer token', dto)
    await c.createJob('Bearer token', dto)
    await c.getJob('Bearer token', 'job-1')
    await c.getJobResult('Bearer token', 'job-1')

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledTimes(4)
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(1, 'Bearer token')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(2, 'Bearer token')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(3, 'Bearer token')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(4, 'Bearer token')
    expect(adapter.build).toHaveBeenCalledTimes(2)
    expect(adapter.build).toHaveBeenCalledWith(dto.strategy)
    expect(runner.run).toHaveBeenCalledWith({ ...dto, strategy: adapted })
    expect(jobs.createJob).toHaveBeenCalledWith({ ...dto, strategy: adapted }, 'user-1')
    expect(jobs.getJob).toHaveBeenCalledWith('job-1', 'user-1')
    expect(jobs.getJobResult).toHaveBeenCalledWith('job-1', 'user-1')
  })
})
