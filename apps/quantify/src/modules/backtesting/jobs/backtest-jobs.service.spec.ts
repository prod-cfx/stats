import type { BacktestRunInput } from '../types/backtesting.types'
import { BacktestJobsService } from './backtest-jobs.service'

const OWNER_USER_ID = 'user-1'

function createInput(): BacktestRunInput {
  return {
    symbols: ['BTCUSDT'],
    baseTimeframe: '5m',
    stateTimeframes: ['1h'],
    initialCash: 10000,
    leverage: 2,
    execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
    strategy: {
      id: 's1',
      params: {},
      fn: () => ({ type: 'NOOP' }),
    },
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
  }
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve()
  }
}

function createCoverage(overrides: Partial<{ kind: 'full' | 'partial' | 'empty'; availableRange: { fromTs: number; toTs: number }; appliedRange: { fromTs: number; toTs: number } }> = {}) {
  return {
    kind: 'full' as const,
    availableRange: { fromTs: 1, toTs: 2 },
    appliedRange: { fromTs: 1, toTs: 2 },
    ...overrides,
  }
}

function createMarketDataMock(overrides: Partial<{ coverage: ReturnType<typeof createCoverage>; bars: unknown[] }> = {}) {
  const coverage = overrides.coverage ?? createCoverage()
  const bars = (overrides.bars ?? [
    {
      symbol: 'BTCUSDT',
      timeframe: '5m',
      openTime: 0,
      closeTime: 1,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    },
  ]) as any[]

  return {
    resolveCoverage: jest.fn().mockResolvedValue(coverage),
    loadBars: jest.fn().mockResolvedValue(bars),
  }
}

describe('backtestJobsService', () => {
  it('should transition queued -> running -> succeeded', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 0 },
      }),
    }
    const marketData = createMarketDataMock()
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(created.status).toBe('queued')
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(marketData.loadBars).toHaveBeenCalledTimes(1)
    expect(service.getJobResult(created.id, OWNER_USER_ID)).toEqual({ summary: { totalTrades: 0 } })
  })

  it('should transition queued -> running -> failed when runner throws', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const marketData = createMarketDataMock()
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('failed')
    expect(job.error).toContain('boom')
  })

  it('should reject result query when job is not completed', () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(() => service.getJobResult(created.id, OWNER_USER_ID)).toThrow('backtest.job_not_completed')
  })

  it('should reject reading job for non-owner user', () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(() => service.getJob(created.id, 'user-2')).toThrow('backtest.job_not_found')
    expect(() => service.getJobResult(created.id, 'user-2')).toThrow('backtest.job_not_found')
  })

  it('should mark job failed when market data service returns empty bars', async () => {
    const runner = {
      run: jest.fn(),
    }
    const marketData = createMarketDataMock({ bars: [] })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('failed')
    expect(job.error).toContain('backtest.market_data_empty')
    expect(runner.run).not.toHaveBeenCalled()
  })

  it('should keep active jobs and reject new job when queue is full', async () => {
    const maxJobsHolder = BacktestJobsService as unknown as { MAX_JOBS: number }
    const originalMaxJobs = maxJobsHolder.MAX_JOBS
    Object.defineProperty(maxJobsHolder, 'MAX_JOBS', {
      configurable: true,
      value: 2,
    })

    try {
      const runner = {
        run: jest.fn().mockImplementation(() => new Promise(() => {})),
      }
      const marketData = {
        ...createMarketDataMock(),
      }
      const service = new BacktestJobsService(runner as never, marketData as never)
      const first = service.createJob(createInput(), OWNER_USER_ID)
      const second = service.createJob(createInput(), OWNER_USER_ID)
      await flushMicrotasks()

      expect(service.getJob(first.id, OWNER_USER_ID).status).toBe('running')
      expect(service.getJob(second.id, OWNER_USER_ID).status).toBe('running')
      expect(() => service.createJob(createInput(), OWNER_USER_ID)).toThrow('backtest.job_queue_full')
      expect(service.getJob(first.id, OWNER_USER_ID).id).toBe(first.id)
      expect(service.getJob(second.id, OWNER_USER_ID).id).toBe(second.id)
    } finally {
      Object.defineProperty(maxJobsHolder, 'MAX_JOBS', {
        configurable: true,
        value: originalMaxJobs,
      })
    }
  })

  it('should use applied range when coverage is partial and allowPartial is false', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 } }),
    }
    const input = createInput()
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 2, toTs: 3 },
        appliedRange: { fromTs: 2, toTs: 2 },
      }),
    })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(job.inputSummary.appliedRange).toEqual({ fromTs: 2, toTs: 2 })
    expect(job.inputSummary.isPartial).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      dataRange: { fromTs: 2, toTs: 2 },
    }))
  })

  it('should use applied range when allowPartial is true', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 } }),
    }
    const input = createInput()
    input.allowPartial = true
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 2, toTs: 3 },
        appliedRange: { fromTs: 2, toTs: 3 },
      }),
    })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(job.inputSummary.appliedRange).toEqual({ fromTs: 2, toTs: 3 })
    expect(job.inputSummary.isPartial).toBe(true)
    expect(marketData.loadBars).toHaveBeenCalledWith(expect.objectContaining({
      dataRange: { fromTs: 2, toTs: 3 },
    }))
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      dataRange: { fromTs: 2, toTs: 3 },
    }))
  })

  it('should use applied range when only right edge is trimmed and allowPartial is false', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 } }),
    }
    const input = createInput()
    input.dataRange = { fromTs: 10, toTs: 100 }
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 1, toTs: 95 },
        appliedRange: { fromTs: 10, toTs: 95 },
      }),
    })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(job.inputSummary.appliedRange).toEqual({ fromTs: 10, toTs: 95 })
    expect(job.inputSummary.isPartial).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      dataRange: { fromTs: 10, toTs: 95 },
    }))
  })

  it('should use applied range when left edge is out of coverage and allowPartial is false', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 } }),
    }
    const input = createInput()
    input.dataRange = { fromTs: 10, toTs: 100 }
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 20, toTs: 120 },
        appliedRange: { fromTs: 20, toTs: 100 },
      }),
    })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(job.inputSummary.appliedRange).toEqual({ fromTs: 20, toTs: 100 })
    expect(job.inputSummary.isPartial).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      dataRange: { fromTs: 20, toTs: 100 },
    }))
  })

  it('should fail when partial coverage and allowPartial is explicitly false', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 } }),
    }
    const input = createInput()
    input.allowPartial = false
    input.dataRange = { fromTs: 10, toTs: 100 }
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 20, toTs: 120 },
        appliedRange: { fromTs: 20, toTs: 100 },
      }),
    })
    const service = new BacktestJobsService(runner as never, marketData as never)
    const created = service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('failed')
    expect(job.error).toContain('backtest.data_range_out_of_coverage')
    expect(runner.run).not.toHaveBeenCalled()
  })
})
