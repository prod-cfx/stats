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

function createRepositoryMock(prisma = createPrismaMock()) {
  return {
    create: jest.fn().mockImplementation((data: Record<string, any>) => prisma.backtestJob.create({ data })),
    findById: jest.fn().mockImplementation((id: string) => prisma.backtestJob.findUnique({ where: { id } })),
    markFailed: jest.fn().mockImplementation((id: string, input: { code?: string; message: string; args?: Record<string, unknown>; finishedAt: Date }) => prisma.backtestJob.update({
      where: { id },
      data: {
        status: 'failed',
        error: input.message,
        result: {
          failure: {
            ...(input.code ? { code: input.code } : {}),
            message: input.message,
            ...(input.args ? { args: input.args } : {}),
          },
        },
        finishedAt: input.finishedAt,
      },
    })),
  }
}

function createQueueMock() {
  return {
    enqueue: jest.fn().mockResolvedValue('btjob-queued'),
  }
}

function createSnapshotLoaderMock() {
  return {
    load: jest.fn().mockResolvedValue(createInput().strategy),
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
    existsActiveConversationForUser: jest.fn().mockResolvedValue(true),
    updateBacktestDraftConfig: jest.fn().mockResolvedValue(undefined),
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
  repository?: ReturnType<typeof createRepositoryMock>
  queue?: ReturnType<typeof createQueueMock>
  snapshotLoader?: ReturnType<typeof createSnapshotLoaderMock>
}) {
  const runner = args?.runner ?? { run: jest.fn().mockImplementation(() => new Promise(() => {})) }
  const marketData = args?.marketData ?? createMarketDataMock()
  const availability = args?.availability ?? createAvailabilityMock()
  const conversations = args?.conversations ?? createConversationsMock()
  const prisma = args?.prisma ?? createPrismaMock()
  const repository = args?.repository ?? createRepositoryMock(prisma)
  const queue = args?.queue ?? createQueueMock()
  const snapshotLoader = args?.snapshotLoader ?? createSnapshotLoaderMock()

  return {
    runner,
    marketData,
    availability,
    conversations,
    prisma,
    repository,
    queue,
    snapshotLoader,
    service: new BacktestJobsService(
      availability as never,
      conversations as never,
      repository as never,
      queue as never,
      snapshotLoader as never,
    ),
  }
}

describe('backtestJobsService', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('persists created jobs with queued status and owner identity', async () => {
    const { service, prisma, availability, queue } = createService()

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
    expect(queue.enqueue).toHaveBeenCalledWith(created.id)
    expect(created.status).toBe('queued')
  })

  it('enqueues created jobs instead of executing them in the API process', async () => {
    const queue = createQueueMock()
    const { service, marketData } = createService({ queue })

    const created = await service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    expect(created.status).toBe('queued')
    expect(queue.enqueue).toHaveBeenCalledWith(created.id)
    expect(marketData.prepareData).not.toHaveBeenCalled()
  })

  it('marks job failed when enqueue fails after persistence', async () => {
    const queue = { enqueue: jest.fn().mockRejectedValue(new Error('redis down')) }
    const { service, prisma, repository } = createService({ queue })

    await expect(service.createJob(createInput(), OWNER_USER_ID)).rejects.toMatchObject({
      code: ErrorCode.BACKTEST_QUEUE_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })

    const createdId = [...prisma.backtestJob.store.keys()][0]
    expect(repository.markFailed).toHaveBeenCalledWith(createdId, expect.objectContaining({
      code: ErrorCode.BACKTEST_QUEUE_UNAVAILABLE,
      message: 'Backtest queue unavailable',
    }))
    expect(prisma.backtestJob.store.get(createdId)).toMatchObject({
      status: 'failed',
      error: 'Backtest queue unavailable',
    })
  })

  it('rebuilds worker execution input from persisted summary and published snapshot', async () => {
    const snapshotLoader = createSnapshotLoaderMock()
    const { service } = createService({ snapshotLoader })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    input.requestedRangeInput = { preset: '7D' }

    const created = await service.createJob(input, OWNER_USER_ID)
    const execution = await service.getExecutionInput(created.id)

    expect(snapshotLoader.load).toHaveBeenCalledWith({
      id: 's1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: OWNER_USER_ID,
    })
    expect(execution.input).toMatchObject({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      requestedRangeInput: { preset: '7D' },
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: expect.any(Object),
    })
    expect(execution.inputSummary).toMatchObject({ snapshotId: 'snapshot-1' })
  })

  it('creates a job when conversationId belongs to the owner user', async () => {
    const conversations = createConversationsMock()
    const { service, prisma } = createService({ conversations })
    const input = createInput()
    input.conversationId = 'conv-1'

    const created = await service.createJob(input, OWNER_USER_ID)

    expect(conversations.existsActiveConversationForUser).toHaveBeenCalledWith('conv-1', OWNER_USER_ID)
    expect(prisma.backtestJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv-1',
        }),
      }),
    )
    expect(created.status).toBe('queued')
  })

  it('rejects create-job when conversationId does not belong to the owner user', async () => {
    const conversations = createConversationsMock()
    conversations.existsActiveConversationForUser.mockResolvedValue(false)
    const { service, prisma } = createService({ conversations })
    const input = createInput()
    input.conversationId = 'conv-other-user'

    await expect(service.createJob(input, OWNER_USER_ID)).rejects.toMatchObject({
      message: 'backtest.invalid_conversation_id',
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        conversationId: 'conv-other-user',
      },
    })
    expect(prisma.backtestJob.create).not.toHaveBeenCalled()
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
    input.conversationId = 'conv-1'
    input.sessionId = 'session-1'

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
            conversationId: 'conv-1',
            sessionId: 'session-1',
            publishedSnapshotId: 'snapshot-1',
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
    const prisma = createPrismaMock()
    const availability = {
      check: jest.fn().mockResolvedValue({ supported: true }),
    }
    const service = new BacktestJobsService(
      availability as never,
      createConversationsMock() as never,
      createRepositoryMock(prisma as never) as never,
      createQueueMock() as never,
      createSnapshotLoaderMock() as never,
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
      availability as never,
      createConversationsMock() as never,
      createRepositoryMock(prisma as never) as never,
      createQueueMock() as never,
      createSnapshotLoaderMock() as never,
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
      availability as never,
      createConversationsMock() as never,
      createRepositoryMock(prisma as never) as never,
      createQueueMock() as never,
      createSnapshotLoaderMock() as never,
    )

    await expect(service.getJob('job-invalid', OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_invalid_status',
    )
  })

  it('rejects persisted job results with unexpected status values', async () => {
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
      availability as never,
      createConversationsMock() as never,
      createRepositoryMock(prisma as never) as never,
      createQueueMock() as never,
      createSnapshotLoaderMock() as never,
    )

    await expect(service.getJobResult('job-invalid-result', OWNER_USER_ID)).rejects.toThrow(
      'backtest.job_invalid_status',
    )
  })

  it('persists the exact backtest draft config used by a snapshot-bound run before waiting for result writeback', async () => {
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
    const conversations = createConversationsMock()
    const { service } = createService({ runner, conversations })
    const input = createInput()
    Object.assign(input.strategy as Record<string, unknown>, {
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      snapshotId: 'snapshot-1',
    })
    Object.assign(input as unknown as Record<string, unknown>, {
      requestedRangeInput: {
        preset: '7D',
      },
    })
    input.allowPartial = false
    input.leverage = null
    input.conversationId = 'conv-1'

    await service.createJob(input, OWNER_USER_ID)

    expect(conversations.updateBacktestDraftConfig).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      userId: OWNER_USER_ID,
      backtestDraftConfig: {
        range: {
          preset: '7D',
        },
        execution: {
          initialCash: 10000,
          leverage: null,
          slippageBps: 5,
          feeBps: 4,
          priceSource: 'mid',
          allowPartial: false,
        },
      },
    })
  })

  it('resolves preset ranges on the server to the previous closed base timeframe candle', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T07:33:20.000Z'))
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 0,
          netProfitPct: 0,
          maxDrawdownPct: 0,
          winRate: 0,
          profitFactor: null,
          totalTrades: 0,
        },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }),
    }
    const marketData = createMarketDataMock({
      coverage: createCoverage({
        availableRange: {
          fromTs: Date.parse('2026-04-01T00:00:00.000Z'),
          toTs: Date.parse('2026-04-24T07:30:00.000Z'),
        },
        appliedRange: {
          fromTs: Date.parse('2026-04-17T07:30:00.000Z'),
          toTs: Date.parse('2026-04-24T07:30:00.000Z'),
        },
      }),
    })
    const { service } = createService({ runner, marketData })
    const input = createInput()
    input.baseTimeframe = '3m'
    input.stateTimeframes = []
    input.requestedRangeInput = { preset: '7D' }
    input.dataRange = {
      fromTs: Date.parse('2026-04-17T07:33:00.000Z'),
      toTs: Date.parse('2026-04-24T07:33:00.000Z'),
    }

    const created = await service.createJob(input, OWNER_USER_ID)

    const expectedRange = {
      fromTs: Date.parse('2026-04-17T07:30:00.000Z'),
      toTs: Date.parse('2026-04-24T07:30:00.000Z'),
    }
    expect(created.inputSummary.dataRange).toEqual(expectedRange)
    expect(created.inputSummary.requestedRange).toEqual(expectedRange)
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
    const conversations = createConversationsMock()
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
    const conversations = createConversationsMock()
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

  it('throws not found when prisma cannot find the job', async () => {
    const { service, marketData, prisma, availability } = createService()

    await expect(service.getJob('missing', OWNER_USER_ID)).rejects.toBeInstanceOf(DomainException)
    await expect(service.getJob('missing', OWNER_USER_ID)).rejects.toThrow('backtest.job_not_found')
  })

  it('propagates persistence failures instead of falling back to API-process execution', async () => {
    const prisma = createPrismaMock()
    const error = Object.assign(
      new Error('The table `public.backtest_jobs` does not exist in the current database.'),
      { code: 'P2021' },
    )
    prisma.backtestJob.create.mockRejectedValueOnce(error)
    const { service, marketData, queue } = createService({ prisma })

    await expect(service.createJob(createInput(), OWNER_USER_ID)).rejects.toBe(error)
    expect(queue.enqueue).not.toHaveBeenCalled()
    expect(marketData.prepareData).not.toHaveBeenCalled()
  })
})

describe('aiQuantConversationsRepository lastBacktestRef parsing', () => {
  it('returns true only for active conversations owned by the given user', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'conv-1' }])
    const { repository } = createConversationRepository({ findMany })

    await expect(repository.existsActiveConversationForUser('conv-1', OWNER_USER_ID)).resolves.toBe(true)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        userId: OWNER_USER_ID,
        archivedAt: null,
      },
      select: { id: true },
      take: 1,
    })
  })

  it('returns false when the conversation is missing, archived, or owned by another user', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const { repository } = createConversationRepository({ findMany })

    await expect(repository.existsActiveConversationForUser('conv-missing', OWNER_USER_ID)).resolves.toBe(false)
  })

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
            config: {
              range: {
                preset: 'CUSTOM',
                startAt: '2026-03-01T00:00:00.000Z',
                endAt: '2026-03-24T00:00:00.000Z',
              },
              execution: {
                initialCash: 10000,
                leverage: 2,
                slippageBps: 5,
                feeBps: 4,
                priceSource: 'mid',
                allowPartial: false,
              },
            },
            summary: {
              maxDrawdownPct: 8,
              totalReturnPct: 12,
              winRatePct: 60,
              tradeCount: 5,
              openTradeCount: 1,
              openPnl: 12.34,
              marketType: 'spot',
              diagnosticReason: ErrorCode.BACKTEST_EVENT_STREAM_UNAVAILABLE,
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
      config: {
        range: {
          preset: 'CUSTOM',
          startAt: '2026-03-01T00:00:00.000Z',
          endAt: '2026-03-24T00:00:00.000Z',
        },
        execution: {
          initialCash: 10000,
          leverage: 2,
          slippageBps: 5,
          feeBps: 4,
          priceSource: 'mid',
          allowPartial: false,
        },
      },
      summary: {
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
        openTradeCount: 1,
        openPnl: 12.34,
        marketType: 'spot',
        diagnosticReason: ErrorCode.BACKTEST_EVENT_STREAM_UNAVAILABLE,
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
            config: {
              range: {
                preset: 'CUSTOM',
                startAt: '2026-03-01T00:00:00.000Z',
                endAt: '2026-03-24T00:00:00.000Z',
              },
              execution: {
                initialCash: 10000,
                leverage: 2,
                slippageBps: 5,
                feeBps: 4,
                priceSource: 'mid',
                allowPartial: false,
              },
            },
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
      config: {
        range: {
          preset: 'CUSTOM',
          startAt: '2026-03-01T00:00:00.000Z',
          endAt: '2026-03-24T00:00:00.000Z',
        },
        execution: {
          initialCash: 10000,
          leverage: 2,
          slippageBps: 5,
          feeBps: 4,
          priceSource: 'mid',
          allowPartial: false,
        },
      },
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
          config: {
            range: {
              preset: 'CUSTOM',
              startAt: '2026-03-01T00:00:00.000Z',
              endAt: '2026-03-24T00:00:00.000Z',
            },
            execution: {
              initialCash: 10000,
              leverage: 2,
              slippageBps: 5,
              feeBps: 4,
              priceSource: 'INVALID',
              allowPartial: false,
            },
          },
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
