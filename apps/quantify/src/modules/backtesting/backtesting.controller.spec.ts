import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { BacktestingController } from './backtesting.controller'
import { BacktestRunnerService } from './core/backtest-runner.service'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
import { BacktestCapabilitiesService } from './services/backtest-capabilities.service'
import { BacktestSnapshotLoaderService } from './services/backtest-snapshot-loader.service'
import { BacktestStrategyAdapterService } from './services/backtest-strategy-adapter.service'
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'

jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
}))
jest.mock('./jobs/backtest-jobs.service', () => ({
  BacktestJobsService: class {},
}))
jest.mock('./core/backtest-runner.service', () => ({
  BacktestRunnerService: class {},
}))
jest.mock('./services/backtest-strategy-adapter.service', () => ({
  BacktestStrategyAdapterService: class {},
}))
jest.mock('./services/backtest-snapshot-loader.service', () => ({
  BacktestSnapshotLoaderService: class {},
}))
jest.mock('./services/backtest-caller-identity.service', () => ({
  BacktestCallerIdentityService: class {},
}))
jest.mock('./services/backtest-capabilities.service', () => ({
  BacktestCapabilitiesService: class {},
}))
jest.mock('./services/backtest-symbol-support.service', () => ({
  BacktestSymbolSupportService: class {},
}))
jest.mock('@/common/utils/prisma-enum-mappers', () => ({
  mapTimeframe: (value: string) => value,
  reverseMapTimeframe: (value: string) => value,
  mapIndicatorType: (value: string) => value,
  mapSymbolStatus: (value: string) => value,
  PRISMA_TIMEFRAME: {
    M1: 'm1',
    M5: 'm5',
    M15: 'm15',
    H1: 'h1',
    H4: 'h4',
    D1: 'd1',
  },
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
  it('retains runtime DTO metadata for symbol support requests', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', BacktestingController.prototype, 'checkSymbolSupport')
    expect(paramTypes?.[3]?.name).toBe('CheckBacktestSymbolDto')
  })

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
          provide: BacktestSnapshotLoaderService,
          useValue: { load: jest.fn() },
        },
        {
          provide: BacktestCallerIdentityService,
          useValue: { resolveCallerUserIdFromAuthorization: jest.fn() },
        },
        {
          provide: BacktestCapabilitiesService,
          useValue: { getCapabilities: jest.fn() },
        },
        {
          provide: BacktestSymbolSupportService,
          useValue: { checkSymbolSupport: jest.fn() },
        },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    expect(typeof c.run).toBe('function')
    expect(typeof c.createJob).toBe('function')
    expect(typeof c.getJob).toBe('function')
    expect(typeof c.getJobResult).toBe('function')
    expect(typeof c.getCapabilities).toBe('function')
    expect(typeof c.checkSymbolSupport).toBe('function')
  })

  it('loads published snapshot strategy before delegating to runner and jobs service', async () => {
    const runner = { run: jest.fn().mockResolvedValue({ ok: true }) }
    const jobs = { createJob: jest.fn().mockReturnValue({ id: 'job-1' }), getJob: jest.fn(), getJobResult: jest.fn() }
    const adapted = { id: 's1', params: { p: 1 }, fn: jest.fn() }
    const adapter = { build: jest.fn() }
    const snapshotLoader = { load: jest.fn().mockResolvedValue(adapted) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = {
      getCapabilities: jest.fn().mockResolvedValue({
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      }),
    }
    const symbolSupport = {
      checkSymbolSupport: jest.fn().mockResolvedValue({ status: 'supported' }),
    }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
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
      strategy: { id: 's1', protocolVersion: 'v1', publishedSnapshotId: 'snapshot-1', params: { p: 1 } },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    await c.run('Bearer token', 'user-1', dto)
    await c.createJob('Bearer token', 'user-1', 'req-job-1', dto)
    await c.getJob('Bearer token', 'user-1', 'job-1')
    await c.getJobResult('Bearer token', 'user-1', 'job-1')
    await c.getCapabilities('req-1')
    await c.checkSymbolSupport('Bearer token', 'user-1', 'req-3', {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDC',
      baseTimeframe: '1h',
    })

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledTimes(5)
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(1, 'Bearer token', 'user-1')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(2, 'Bearer token', 'user-1')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(3, 'Bearer token', 'user-1')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(4, 'Bearer token', 'user-1')
    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenNthCalledWith(5, 'Bearer token', 'user-1')
    expect(snapshotLoader.load).toHaveBeenCalledTimes(2)
    expect(snapshotLoader.load).toHaveBeenCalledWith({
      id: 's1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })
    expect(runner.run).toHaveBeenCalledWith({ ...dto, strategy: adapted })
    expect(jobs.createJob).toHaveBeenCalledWith(expect.objectContaining({
      strategy: adapted,
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
    }), 'user-1')
    expect(jobs.getJob).toHaveBeenCalledWith('job-1', 'user-1')
    expect(jobs.getJobResult).toHaveBeenCalledWith('job-1', 'user-1')
    expect(capabilities.getCapabilities).toHaveBeenCalledTimes(1)
    expect(capabilities.getCapabilities).toHaveBeenCalledWith('req-1')
    expect(symbolSupport.checkSymbolSupport).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDC',
      baseTimeframe: '1h',
    })
    expect(adapter.build).not.toHaveBeenCalled()
  })

  it('prefers published snapshot loader when snapshot id is provided', async () => {
    const runner = { run: jest.fn().mockResolvedValue({ ok: true }) }
    const jobs = { createJob: jest.fn().mockReturnValue({ id: 'job-1' }), getJob: jest.fn(), getJobResult: jest.fn() }
    const adapted = { id: 's1', params: { p: 1 }, fn: jest.fn(), snapshotId: 'snapshot-1' }
    const snapshotLoader = { load: jest.fn().mockResolvedValue(adapted) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = { getCapabilities: jest.fn() }
    const symbolSupport = { checkSymbolSupport: jest.fn() }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: { build: jest.fn() } },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    const dto: any = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
      strategy: { id: 's1', protocolVersion: 'v1', publishedSnapshotId: 'snapshot-1', params: { p: 1 } },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    await c.run('Bearer token', 'user-1', dto)
    await c.createJob('Bearer token', 'user-1', 'req-job-1', dto)

    expect(snapshotLoader.load).toHaveBeenCalledTimes(2)
    expect(snapshotLoader.load).toHaveBeenCalledWith({
      id: 's1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })
  })

  it('normalizes create-job inputs to published snapshot truth before delegating to jobs service', async () => {
    const runner = { run: jest.fn() }
    const jobs = { createJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'queued' }), getJob: jest.fn(), getJobResult: jest.fn() }
    const adapted = {
      id: 'instance-1',
      params: {
        exchange: 'okx',
        symbol: 'ORDIUSDT',
        marketType: 'spot',
        timeframe: '1h',
      },
      stateTimeframes: ['4h'],
      fn: jest.fn(),
      snapshotId: 'snapshot-1',
    }
    const snapshotLoader = { load: jest.fn().mockResolvedValue(adapted) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = { getCapabilities: jest.fn() }
    const symbolSupport = { checkSymbolSupport: jest.fn() }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: { build: jest.fn() } },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    await c.createJob('Bearer token', 'user-1', 'req-job-truth', {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: { id: 's1', protocolVersion: 'v1', publishedSnapshotId: 'snapshot-1', params: { marketType: 'spot' } },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    } as any)

    expect(jobs.createJob).toHaveBeenCalledWith(expect.objectContaining({
      symbols: ['ORDIUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: ['4h'],
      strategy: adapted,
    }), 'user-1')
  })

  it('loads published snapshot strategy even when legacy strategy id is omitted', async () => {
    const runner = { run: jest.fn().mockResolvedValue({ ok: true }) }
    const jobs = { createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() }
    const snapshotLoader = { load: jest.fn().mockResolvedValue({ id: 'snapshot-strategy', params: {}, fn: jest.fn() }) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = { getCapabilities: jest.fn() }
    const symbolSupport = { checkSymbolSupport: jest.fn() }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: { build: jest.fn() } },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    const dto: any = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
      strategy: { protocolVersion: 'v1', publishedSnapshotId: 'snapshot-1' },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    await c.run('Bearer token', 'user-1', dto)

    expect(snapshotLoader.load).toHaveBeenCalledWith({
      id: '',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it('maps capability upstream error to service unavailable domain exception', async () => {
    const runner = { run: jest.fn() }
    const jobs = { createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() }
    const snapshotLoader = { load: jest.fn() }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn() }
    const capabilities = {
      getCapabilities: jest.fn().mockRejectedValue(new Error('db down')),
    }
    const symbolSupport = {
      checkSymbolSupport: jest.fn(),
    }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: { build: jest.fn() } },
      ],
    }).compile()

    const c = mod.get(BacktestingController)

    await expect(c.getCapabilities('req-2')).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reasonMessage: 'db down' },
    })
  })

  it('maps symbol support unknown errors to service unavailable domain exception', async () => {
    const runner = { run: jest.fn() }
    const jobs = { createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() }
    const snapshotLoader = { load: jest.fn() }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = { getCapabilities: jest.fn() }
    const symbolSupport = {
      checkSymbolSupport: jest.fn().mockRejectedValue(new Error('catalog crashed')),
    }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: { build: jest.fn() } },
      ],
    }).compile()

    const c = mod.get(BacktestingController)

    await expect(c.checkSymbolSupport('Bearer token', 'user-1', 'req-4', {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
    })).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { exchange: 'okx', symbol: 'BTCUSDT', reasonMessage: 'catalog crashed' },
    })
  })

  it('maps create job unknown errors to service unavailable domain exception', async () => {
    const runner = { run: jest.fn() }
    const jobs = { createJob: jest.fn(), getJob: jest.fn(), getJobResult: jest.fn() }
    const adapter = { build: jest.fn() }
    const snapshotLoader = { load: jest.fn().mockRejectedValue(new Error('script engine bootstrap failed')) }
    const caller = { resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1') }
    const capabilities = { getCapabilities: jest.fn() }
    const symbolSupport = { checkSymbolSupport: jest.fn() }

    const mod = await Test.createTestingModule({
      controllers: [BacktestingController],
      providers: [
        { provide: BacktestRunnerService, useValue: runner },
        { provide: BacktestJobsService, useValue: jobs },
        { provide: BacktestCallerIdentityService, useValue: caller },
        { provide: BacktestCapabilitiesService, useValue: capabilities },
        { provide: BacktestSnapshotLoaderService, useValue: snapshotLoader },
        { provide: BacktestSymbolSupportService, useValue: { checkSupport: symbolSupport.checkSymbolSupport } },
        { provide: BacktestStrategyAdapterService, useValue: adapter },
      ],
    }).compile()

    const c = mod.get(BacktestingController)
    const dto: any = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
      strategy: { id: 's1', protocolVersion: 'v1', publishedSnapshotId: 'snapshot-1', params: {} },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    await expect(c.createJob('Bearer token', 'user-1', 'req-job-2', dto)).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: {
        symbols: ['BTCUSDT'],
        reasonMessage: 'script engine bootstrap failed',
      },
    })
  })
})
