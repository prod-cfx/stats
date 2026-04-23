import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
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
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '5m',
      },
      fn: () => ({ type: 'NOOP' }),
    },
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
  }
}

async function flushMicrotasks() {
  for (let i = 0; i < 12; i += 1) {
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
    ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
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

function createAvailabilityMock(
  result: { supported: true } | { supported: false; reasonCode: string; args?: Record<string, unknown> } = { supported: true },
) {
  return {
    check: jest.fn().mockResolvedValue(result),
  }
}

function createConversationsMock() {
  return {
    updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
  }
}

function createConversationRepository(overrides?: {
  findMany?: jest.Mock
  findUnique?: jest.Mock
  findUniqueOrThrow?: jest.Mock
}) {
  const txHost = {
    tx: {
      aiQuantConversation: {
        findMany: overrides?.findMany ?? jest.fn(),
        findUnique: overrides?.findUnique ?? jest.fn(),
        findUniqueOrThrow: overrides?.findUniqueOrThrow ?? jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      aiQuantConversationMessage: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    },
    withTransaction: jest.fn(),
  }

  return {
    txHost,
    repository: new AiQuantConversationsRepository(txHost as never),
  }
}

function createService(args?: {
  runner?: { run: jest.Mock }
  marketData?: ReturnType<typeof createMarketDataMock>
  availability?: ReturnType<typeof createAvailabilityMock>
  conversations?: ReturnType<typeof createConversationsMock>
  prisma?: ReturnType<typeof createPrismaMock>
}) {
  const runner = args?.runner ?? { run: jest.fn().mockImplementation(() => new Promise(() => {})) }
  const marketData = args?.marketData ?? createMarketDataMock()
  const availability = args?.availability ?? createAvailabilityMock()
  const conversations = args?.conversations ?? createConversationsMock()
  const prisma = args?.prisma ?? createPrismaMock()

  return {
    runner,
    marketData,
    availability,
    conversations,
    prisma,
    service: new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      conversations as never,
      prisma as never,
    ),
  }
}

describe('backtestJobsService', () => {
  it('persists created jobs with queued status and owner identity', async () => {
    const { service, marketData, prisma, availability } = createService()

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
    expect(availability.check).not.toHaveBeenCalled()
    expect(created.status).toBe('queued')
  })

  it('persists snapshot tracing fields when strategy was loaded from a published snapshot', async () => {
    const { service, marketData, prisma, availability } = createService()
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
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
    expect(availability.check).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '5m',
    }))
  })

  it('checks snapshot-bound symbol availability before creating a backtest job', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const availability = {
      check: jest.fn().mockResolvedValue({ supported: true }),
    }
    const service = new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      createConversationsMock() as never,
      prisma as never,
    )
    const input = createInput()
    input.symbols = ['BTCUSDT']
    input.baseTimeframe = '5m'
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.strategy.params = {
      exchange: 'okx',
      symbol: 'ORDIUSDT',
      marketType: 'spot',
      timeframe: '1h',
    }

    await service.createJob(input, OWNER_USER_ID)

    expect(availability.check).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })
  })

  it('rejects create-job with a structured business error when snapshot-bound symbol is unavailable', async () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const marketData = createMarketDataMock()
    const prisma = createPrismaMock()
    const availability = {
      check: jest.fn().mockResolvedValue({
        supported: false,
        reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
        args: {
          exchange: 'okx',
          marketType: 'spot',
          symbol: 'ORDIUSDT',
          baseTimeframe: '1h',
        },
      }),
    }
    const service = new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      createConversationsMock() as never,
      prisma as never,
    )
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.strategy.params = {
      exchange: 'okx',
      symbol: 'ORDIUSDT',
      marketType: 'spot',
      timeframe: '1h',
    }

    await expect(service.createJob(input, OWNER_USER_ID)).rejects.toMatchObject({
      message: 'backtesting.symbol_unavailable',
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'ORDIUSDT',
        baseTimeframe: '1h',
        snapshotId: 'snapshot-1',
      },
    })
    expect(prisma.backtestJob.create).not.toHaveBeenCalled()
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
    const { service, marketData, prisma, availability } = createService({ runner })

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
    const { service, prisma, availability } = createService({ runner, marketData })

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

  it('includes open-trade summary when the backtest ends with open positions', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 0,
          netProfitPct: 0,
          maxDrawdownPct: 3.2,
          winRate: 0,
          profitFactor: 0,
          totalTrades: 0,
        },
        equityCurve: [{ ts: 1, equity: 10000 }],
        trades: [],
        markers: [{ id: 'm1', symbol: 'BTCUSDT', ts: 1, price: 100, kind: 'entry_long', tradeId: 't1' }],
        bySymbol: [],
        openPositions: [
          {
            symbol: 'BTCUSDT',
            qty: 1,
            avgEntryPrice: 100,
            unrealizedPnl: 12.34,
          },
        ],
      }),
    }
    const marketData = createMarketDataMock()
    const { service, prisma, availability } = createService({ runner, marketData })

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toMatchObject({
      id: created.id,
      status: 'succeeded',
      resultSummary: {
        totalTrades: 0,
        totalOpenTrades: 1,
        openPnl: 12.34,
      },
    })
  })

  it('stores failed result state in prisma when runner throws', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const marketData = createMarketDataMock()
    const { service, prisma, availability } = createService({ runner, marketData })

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
    const { service, marketData, prisma, availability } = createService()
    const created = await service.createJob(createInput(), OWNER_USER_ID)

    await expect(service.getJobResult(created.id, OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_not_completed',
    )
  })

  it('rejects reading job for non-owner user', async () => {
    const { service, marketData, prisma, availability } = createService()
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
    const availability = createAvailabilityMock()
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
    const service = new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      createConversationsMock() as never,
      prisma as never,
    )

    await expect(service.getJob('job-invalid', OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_invalid_status',
    )
  })

  it('rejects persisted job results with unexpected status values', async () => {
    const runner = {
      run: jest.fn(),
    }
    const marketData = createMarketDataMock()
    const availability = createAvailabilityMock()
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
    const service = new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      createConversationsMock() as never,
      prisma as never,
    )

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
    const { service, prisma, availability } = createService({ runner, marketData })
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
    const { service, prisma, availability } = createService({ runner, marketData })

    const created = await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        status: 'failed',
        errorDetails: {
          code: 'backtest.data_range_out_of_coverage',
          message: 'backtest.data_range_out_of_coverage',
          args: {
            requestedRange: { fromTs: 1, toTs: 2 },
            availableRange: { fromTs: 2, toTs: 3 },
            suggestedRange: { fromTs: 2, toTs: 3 },
          },
        },
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
    const { service, marketData, prisma, availability } = createService({ runner })

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

  it('writes a lightweight lastBacktestRef to the owning conversation after a successful snapshot-bound backtest', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 120,
          netProfitPct: 12,
          maxDrawdownPct: 8,
          winRate: 0.6,
          profitFactor: 1.8,
          totalTrades: 5,
        },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const conversations = {
      updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
    }
    const { service } = createService({ runner, conversations })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.conversationId = 'conv-1'

    const created = await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    expect(conversations.updateLastBacktestRef).toHaveBeenCalledTimes(1)
    const payload = conversations.updateLastBacktestRef.mock.calls[0][0]
    expect(payload).toEqual({
      conversationId: 'conv-1',
      userId: OWNER_USER_ID,
      lastBacktestRef: {
        jobId: created.id,
        publishedSnapshotId: 'snapshot-1',
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
          marketType: 'spot',
        },
        completedAt: expect.any(Date),
      },
    })
    expect(payload.lastBacktestRef).not.toHaveProperty('equityCurve')
    expect(payload.lastBacktestRef).not.toHaveProperty('trades')
    expect(payload.lastBacktestRef).not.toHaveProperty('markers')
    expect(payload.lastBacktestRef).not.toHaveProperty('bySymbol')
    expect(payload.lastBacktestRef).not.toHaveProperty('result')
  })

  it('does not write lastBacktestRef for successful runs that are not explicitly snapshot-bound', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 120,
          netProfitPct: 12,
          maxDrawdownPct: 8,
          winRate: 0.6,
          profitFactor: 1.8,
          totalTrades: 5,
        },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const conversations = {
      updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
    }
    const { service } = createService({ runner, conversations })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      snapshotId: 'snapshot-1',
    })
    input.conversationId = 'conv-1'

    await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    expect(conversations.updateLastBacktestRef).not.toHaveBeenCalled()
  })

  it('does not write lastBacktestRef when the backtest fails', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const conversations = {
      updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
    }
    const { service } = createService({ runner, conversations })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.conversationId = 'conv-1'

    await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    expect(conversations.updateLastBacktestRef).not.toHaveBeenCalled()
  })

  it('keeps a persisted job succeeded when conversation lastBacktestRef writeback fails', async () => {
    const result = {
      summary: {
        netProfit: 120,
        netProfitPct: 12,
        maxDrawdownPct: 8,
        winRate: 0.6,
        profitFactor: 1.8,
        totalTrades: 5,
      },
      equityCurve: [],
      trades: [],
      markers: [],
      bySymbol: [],
    }
    const runner = {
      run: jest.fn().mockResolvedValue(result),
    }
    const conversations = {
      updateLastBacktestRef: jest.fn().mockRejectedValue(new Error('writeback failed')),
    }
    const { service } = createService({ runner, conversations })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.conversationId = 'conv-1'

    const created = await service.createJob(input, OWNER_USER_ID)
    await flushMicrotasks()

    await expect(service.getJob(created.id, OWNER_USER_ID)).resolves.toEqual(
      expect.objectContaining({
        id: created.id,
        status: 'succeeded',
        resultSummary: expect.objectContaining(result.summary),
      }),
    )
    await expect(service.getJobResult(created.id, OWNER_USER_ID)).resolves.toEqual(result)
    expect(conversations.updateLastBacktestRef).toHaveBeenCalledTimes(1)
  })

  it('throws not found when prisma cannot find the job', async () => {
    const { service, marketData, prisma, availability } = createService()

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
    const availability = createAvailabilityMock()
    const prisma = createPrismaMock()
    prisma.backtestJob.create.mockRejectedValueOnce(Object.assign(
      new Error('The table `public.backtest_jobs` does not exist in the current database.'),
      { code: 'P2021' },
    ))
    const service = new BacktestJobsService(
      runner as never,
      marketData as never,
      availability as never,
      createConversationsMock() as never,
      prisma as never,
    )

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

describe('aiQuantConversationsRepository lastBacktestRef parsing', () => {
  it('parses a valid JSON lastBacktestRef into a typed record with a Date', async () => {
    const completedAt = '2026-04-23T05:00:00.000Z'
    const { repository } = createConversationRepository({
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'conv-1',
          userId: OWNER_USER_ID,
          codegenSessionId: 'session-1',
          title: 'Conversation',
          archivedAt: null,
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          updatedAt: new Date('2026-04-21T00:00:00.000Z'),
          lastBacktestRef: {
            jobId: 'job-1',
            publishedSnapshotId: 'snapshot-1',
            summary: {
              maxDrawdownPct: 8,
              totalReturnPct: 12,
              winRatePct: 60,
              tradeCount: 5,
              openTradeCount: 1,
              openPnl: 12.34,
              marketType: 'spot',
            },
            completedAt,
          },
          messages: [],
        },
      ]),
    })

    const conversations = await repository.listByUser(OWNER_USER_ID)

    expect(conversations).toHaveLength(1)
    expect(conversations[0].lastBacktestRef).toEqual({
      jobId: 'job-1',
      publishedSnapshotId: 'snapshot-1',
      summary: {
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
        openTradeCount: 1,
        openPnl: 12.34,
        marketType: 'spot',
      },
      completedAt: new Date(completedAt),
    })
    expect(conversations[0].lastBacktestRef?.completedAt).toBeInstanceOf(Date)
  })

  it('treats explicit JSON null optional fields as absent', async () => {
    const completedAt = '2026-04-23T05:00:00.000Z'
    const { repository } = createConversationRepository({
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'conv-1',
          userId: OWNER_USER_ID,
          codegenSessionId: 'session-1',
          title: 'Conversation',
          archivedAt: null,
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          updatedAt: new Date('2026-04-21T00:00:00.000Z'),
          lastBacktestRef: {
            jobId: 'job-1',
            publishedSnapshotId: 'snapshot-1',
            summary: {
              maxDrawdownPct: 8,
              totalReturnPct: 12,
              winRatePct: 60,
              tradeCount: 5,
              openTradeCount: null,
              openPnl: null,
              marketType: null,
            },
            completedAt,
          },
          messages: [],
        },
      ]),
    })

    const conversations = await repository.listByUser(OWNER_USER_ID)

    expect(conversations[0].lastBacktestRef).toEqual({
      jobId: 'job-1',
      publishedSnapshotId: 'snapshot-1',
      summary: {
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
      },
      completedAt: new Date(completedAt),
    })
  })

  it('returns null for malformed JSON lastBacktestRef payloads', async () => {
    const { repository } = createConversationRepository({
      findUnique: jest.fn().mockResolvedValue({
        id: 'conv-1',
        userId: OWNER_USER_ID,
        codegenSessionId: 'session-1',
        title: 'Conversation',
        archivedAt: null,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        lastBacktestRef: {
          jobId: 'job-1',
          publishedSnapshotId: 'snapshot-1',
          summary: {
            maxDrawdownPct: 'bad',
            totalReturnPct: 12,
            winRatePct: 60,
            tradeCount: 5,
          },
          completedAt: 'not-a-date',
        },
        messages: [],
      }),
    })

    const conversation = await repository.findByCodegenSessionId('session-1')

    expect(conversation?.lastBacktestRef).toBeNull()
  })
})
