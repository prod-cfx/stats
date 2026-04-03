import type { BacktestRunInput } from '../types/backtesting.types'
import { DomainException } from '@/common/exceptions/domain.exception'
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

function createCoverage(
  overrides: Partial<{
    kind: 'full' | 'partial' | 'empty'
    availableRange: { fromTs: number; toTs: number }
    appliedRange: { fromTs: number; toTs: number }
  }> = {},
) {
  return {
    kind: 'full' as const,
    availableRange: { fromTs: 1, toTs: 2 },
    appliedRange: { fromTs: 1, toTs: 2 },
    ...overrides,
  }
}

function createMarketDataMock(
  overrides: Partial<{ coverage: ReturnType<typeof createCoverage>; bars: unknown[] }> = {},
) {
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
    prepareData: jest.fn().mockResolvedValue(undefined),
    resolveCoverage: jest.fn().mockResolvedValue(coverage),
    loadBars: jest.fn().mockResolvedValue(bars),
  }
}

function createPrismaBacktestJobMock() {
  const store = new Map<string, Record<string, any>>()

  return {
    store,
    create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, any> }) => {
      const now = new Date()
      const record: Record<string, any> = {
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        error: null,
        result: null,
        ...data,
      }
      store.set(record.id, record)
      return record
    }),
    findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
      return store.get(where.id) ?? null
    }),
    update: jest
      .fn()
      .mockImplementation(
        async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
          const existing = store.get(where.id)
          if (!existing) throw new Error(`missing job ${where.id}`)
          const next = {
            ...existing,
            ...data,
            inputSummary: data.inputSummary ?? existing.inputSummary,
          }
          store.set(where.id, next)
          return next
        },
      ),
    deleteMany: jest.fn(),
  }
}

function createPrismaMock(backtestJob = createPrismaBacktestJobMock()) {
  return {
    backtestJob,
  }
}

describe('backtestJobsService', () => {
  it('persists created jobs with queued status and owner identity', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(createInput(), OWNER_USER_ID)

    expect(prisma.backtestJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: expect.stringMatching(/^btjob-/),
          ownerUserId: OWNER_USER_ID,
          status: 'queued',
        }),
      }),
    )
    expect(created.status).toBe('queued')
  })

  it('persists snapshot tracing fields when strategy was loaded from a published snapshot', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      snapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash',
      scriptHash: 'script-hash',
      specHash: 'spec-hash',
    })

    await service.createJob(input, OWNER_USER_ID)

    expect(prisma.backtestJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash',
          scriptHash: 'script-hash',
          specHash: 'spec-hash',
          inputSummary: expect.objectContaining({
            strategyInstanceId: 'instance-1',
            strategyTemplateId: 'template-1',
            snapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash',
            scriptHash: 'script-hash',
            specHash: 'spec-hash',
          }),
        }),
      }),
    )
  })

  it('stores succeeded result in prisma and returns it from getJobResult', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 0 },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    expect(marketData.prepareData).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['BTCUSDT'],
      }),
    )

    expect(prisma.backtestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: created.id },
        data: expect.objectContaining({
          status: 'succeeded',
          result: expect.objectContaining({
            summary: { totalTrades: 0 },
          }),
        }),
      }),
    )

    await expect(service.getJobResult(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        summary: { totalTrades: 0 },
      }),
    )
  })

  it('includes resultSummary in getJob without leaking full report payload', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 1200,
          netProfitPct: 12,
          maxDrawdownPct: 8,
          winRate: 0.6,
          profitFactor: 1.7,
          totalTrades: 6,
        },
        equityCurve: [{ ts: 1, equity: 10000 }],
        trades: [{ id: 'trade-1', symbol: 'BTCUSDT' }],
        markers: [],
        bySymbol: [],
      }),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toMatchObject({
      id: created.id,
      status: 'succeeded',
      resultSummary: {
        netProfit: 1200,
        netProfitPct: 12,
        maxDrawdownPct: 8,
        winRate: 0.6,
        profitFactor: 1.7,
        totalTrades: 6,
      },
    })
  })

  it('stores failed result state in prisma when runner throws', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    expect(prisma.backtestJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: created.id },
        data: expect.objectContaining({
          status: 'failed',
          error: 'boom',
        }),
      }),
    )
  })

  it('rejects result query when job is not completed', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)
    const created = await service.createJob(createInput(), OWNER_USER_ID)

    await expect(service.getJobResult(created.id, OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_not_completed',
    )
  })

  it('rejects reading job for non-owner user', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)
    const created = await service.createJob(createInput(), OWNER_USER_ID)

    await expect(service.getJob(created.id, 'user-2')).rejects.toThrow('backtest.job_not_found')
    await expect(service.getJobResult(created.id, 'user-2')).rejects.toThrow(
      'backtest.job_not_found',
    )
  })

  it('rejects persisted jobs with unexpected status values', async () => {
    const runner = {
      run: jest.fn(),
    }
    const marketData = createMarketDataMock()
    const prisma = {
      backtestJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-invalid',
          ownerUserId: OWNER_USER_ID,
          status: 'stuck',
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          startedAt: null,
          finishedAt: null,
          error: null,
          inputSummary: {},
          result: null,
        }),
      },
    }
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    await expect(service.getJob('job-invalid', OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_invalid_status',
    )
  })

  it('rejects persisted job results with unexpected status values', async () => {
    const runner = {
      run: jest.fn(),
    }
    const marketData = createMarketDataMock()
    const prisma = {
      backtestJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-invalid-result',
          ownerUserId: OWNER_USER_ID,
          status: 'stuck',
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          startedAt: null,
          finishedAt: null,
          error: null,
          inputSummary: {},
          result: {
            summary: { totalTrades: 1 },
          },
        }),
      },
    }
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    await expect(service.getJobResult('job-invalid-result', OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_invalid_status',
    )
  })

  it('persists applied range when coverage is partial and allowPartial is true', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 1 },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
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
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)
    const created = await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        status: 'succeeded',
        inputSummary: expect.objectContaining({
          appliedRange: { fromTs: 2, toTs: 3 },
          isPartial: true,
        }),
      }),
    )
  })

  it('fails partial coverage when allowPartial is omitted', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 1 },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const input = createInput()
    delete input.allowPartial
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        kind: 'partial',
        availableRange: { fromTs: 2, toTs: 3 },
        appliedRange: { fromTs: 2, toTs: 3 },
      }),
    })
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        status: 'failed',
        inputSummary: expect.objectContaining({
          allowPartial: false,
        }),
      }),
    )
    expect(runner.run).not.toHaveBeenCalled()
  })

  it('does not evict finished jobs when more jobs are created', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 0 },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const first = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()
    const second = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(first.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        id: first.id,
        status: 'succeeded',
      }),
    )
    await expect(service.getJob(second.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        id: second.id,
        status: 'succeeded',
      }),
    )
    expect(prisma.backtestJob.deleteMany).not.toHaveBeenCalled()
  })

  it('throws not found when prisma cannot find the job', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    await expect(service.getJob('missing', OWNER_USER_ID)).rejects.toBeInstanceOf(DomainException)
    await expect(service.getJob('missing', OWNER_USER_ID)).rejects.toThrow('backtest.job_not_found')
  })

  it('falls back to in-memory jobs when backtest job persistence table is unavailable', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 0 },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    prisma.backtestJob.create.mockRejectedValueOnce(Object.assign(
      new Error('The table `public.backtest_jobs` does not exist in the current database.'),
      { code: 'P2021' },
    ))
    const service = new BacktestJobsService(runner as never, marketData as never, prisma as never)

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        id: created.id,
        status: 'succeeded',
        resultSummary: { totalTrades: 0 },
      }),
    )
    await expect(service.getJobResult(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        summary: { totalTrades: 0 },
      }),
    )
    expect(prisma.backtestJob.create).toHaveBeenCalledTimes(1)
    expect(prisma.backtestJob.update).not.toHaveBeenCalled()
  })
})
