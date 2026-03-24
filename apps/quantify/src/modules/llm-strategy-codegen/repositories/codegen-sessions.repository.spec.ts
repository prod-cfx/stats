import { CodegenSessionsRepository } from './codegen-sessions.repository'

describe('codegenSessionsRepository.createDraftStrategyInstanceFromPublishedSession', () => {
  it('creates an executable multi-leg template for published AI codegen sessions', async () => {
    const tx = {
      strategyTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      strategyInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
    }

    const prisma = {
      getClient: jest.fn(),
      runInTransaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    }

    const repo = new CodegenSessionsRepository(prisma as any)

    const result = await repo.createDraftStrategyInstanceFromPublishedSession({
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

    expect(result).toEqual({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })

    expect(tx.strategyTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: 'return { action: "buy" }',
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
})
