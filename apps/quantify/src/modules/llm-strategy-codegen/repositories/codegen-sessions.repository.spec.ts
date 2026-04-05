import { CodegenSessionsRepository } from './codegen-sessions.repository'

describe('codegenSessionsRepository.createDraftStrategyInstanceFromPublishedSession', () => {
  const buildInput = () => ({
    userId: 'user-1',
    sessionId: 'session-1',
    name: 'OKX SOLUSDT 5m AI策略',
    description: 'desc',
    llmModel: 'gpt-4o-mini',
    scriptCode: 'return { action: "buy" }',
    specDesc: {
      market: {
        symbols: ['SOLUSDT'],
        timeframes: ['5m'],
      },
    },
    params: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    },
    metadata: {
      sourceMessage: '平台：OKX',
    },
  })

  it('creates an executable multi-leg template for published AI codegen sessions', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }

    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.createDraftStrategyInstanceFromPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })

    expect(tx.strategyTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return { action: "buy" }',
        paramsSchema: {
          type: 'object',
          properties: {
            exchange: { type: 'string', title: 'exchange' },
            marketType: { type: 'string', title: 'marketType' },
            symbol: { type: 'string', title: 'symbol' },
            timeframe: { type: 'string', title: 'timeframe' },
            positionPct: { type: 'number', title: 'positionPct' },
          },
          required: ['exchange', 'marketType', 'symbol', 'timeframe', 'positionPct'],
          additionalProperties: true,
        },
        execution: {
          timeframe: '5m',
          cooldownMinutes: 5,
        },
        legs: [
          {
            id: 'primary',
            symbol: 'SOLUSDT:SPOT',
            role: 'primary',
            description: 'AI codegen primary leg',
          },
        ],
        dataRequirements: {
          primary: ['5m'],
        },
      }),
    }))
  })

  it('returns existing strategy instance without creating duplicated side effects when session already bound', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn(),
      },
      strategyInstance: {
        create: jest.fn(),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: 'existing-instance-id' }),
        update: jest.fn(),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: '',
      strategyInstanceId: 'existing-instance-id',
    })
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.update).not.toHaveBeenCalled()
  })

  it('creates and binds strategy instance in one transaction when session is not bound', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    expect(tx.strategyTemplate.create).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledTimes(1)
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { strategyInstanceId: 'instance-1' },
    })
  })

  it('retries transaction startup timeout before binding strategy instance', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      llmStrategyCodegenSession: {
        findUnique: jest.fn().mockResolvedValue({ strategyInstanceId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const transactionTimeoutError = Object.assign(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
      { code: 'P2034' },
    )

    const txHost = {
      tx,
      withTransaction: jest.fn()
        .mockRejectedValueOnce(transactionTimeoutError)
        .mockImplementation(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    const result = await repo.ensureDraftStrategyInstanceBoundForPublishedSession(buildInput())

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    expect(txHost.withTransaction).toHaveBeenCalledTimes(2)
    expect(tx.strategyTemplate.create).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledTimes(1)
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { strategyInstanceId: 'instance-1' },
    })
  })

  it('uses the ambient prisma client for single-statement session reads and writes', async () => {
    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'DRAFTING',
          checklist: {},
          constraintPack: {},
          latestDraftCode: null,
          latestSpecDesc: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'DRAFTING',
          checklist: {},
          constraintPack: {},
          latestDraftCode: null,
          latestSpecDesc: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          status: 'VALIDATING_STATIC',
          checklist: {},
          constraintPack: {},
          latestDraftCode: 'code',
          latestSpecDesc: null,
          rejectReason: null,
          strategyInstanceId: null,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:01.000Z'),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      llmStrategyCodeVersion: {
        create: jest.fn().mockResolvedValue({ id: 'version-1' }),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.createSession({
      user: { connect: { id: 'user-1' } },
      status: 'DRAFTING',
      checklist: {} as any,
      constraintPack: {} as any,
    } as any)
    await repo.findById('session-1')
    await repo.updateSession('session-1', { status: 'VALIDATING_STATIC' } as any)
    await repo.tryMarkGenerating('session-1', { status: 'GENERATING' } as any)
    await repo.createVersion({ session: { connect: { id: 'session-1' } }, scriptCode: 'code' } as any)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalled()
    expect(tx.llmStrategyCodegenSession.updateMany).toHaveBeenCalled()
    expect(tx.llmStrategyCodeVersion.create).toHaveBeenCalled()
    expect(txHost.withTransaction).not.toHaveBeenCalled()
  })

  it('includes graphSnapshot in session select and update payloads', async () => {
    const sessionRow = {
      id: 'session-1',
      userId: 'user-1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [],
        edges: [],
      },
      rejectReason: null,
      strategyInstanceId: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    }
    const tx = {
      llmStrategyCodegenSession: {
        create: jest.fn().mockResolvedValue(sessionRow),
        findUnique: jest.fn().mockResolvedValue(sessionRow),
        update: jest.fn().mockResolvedValue({
          ...sessionRow,
          status: 'CHECKLIST_GATE',
          graphSnapshot: {
            graphVersion: 'gss.v1',
            nodes: [{ id: 'entry-1' }],
            edges: [],
          },
        }),
      },
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }
    const repo = new CodegenSessionsRepository(txHost as any)

    await repo.createSession({
      user: { connect: { id: 'user-1' } },
      status: 'DRAFTING',
      checklist: {} as any,
      constraintPack: {} as any,
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [],
        edges: [],
      } as any,
    } as any)
    await repo.findById('session-1')
    await repo.updateSession('session-1', {
      status: 'CHECKLIST_GATE',
      graphSnapshot: {
        graphVersion: 'gss.v1',
        nodes: [{ id: 'entry-1' }],
        edges: [],
      } as any,
    } as any)

    expect(tx.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        graphSnapshot: expect.objectContaining({ graphVersion: 'gss.v1' }),
      }),
      select: expect.objectContaining({
        graphSnapshot: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        graphSnapshot: true,
      }),
    }))
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        graphSnapshot: expect.objectContaining({
          nodes: [{ id: 'entry-1' }],
        }),
      }),
      select: expect.objectContaining({
        graphSnapshot: true,
      }),
    }))
  })
})
