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

    expect(result).toEqual({ strategyInstanceId: 'existing-instance-id' })
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

    expect(result).toEqual({ strategyInstanceId: 'instance-1' })
    expect(tx.strategyTemplate.create).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledTimes(1)
    expect(tx.llmStrategyCodegenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { strategyInstanceId: 'instance-1' },
    })
  })
})
