import { AccountStrategyViewRepository } from './account-strategy-view.repository'

describe('accountStrategyViewRepository.deployStrategyForUser', () => {
  it('reuses the published AI draft instance when strategyInstanceId is provided', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true }),
      },
      strategyTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'strategy-instance-1',
          createdBy: 'user-1',
          strategyTemplateId: 'template-1',
          params: {
            symbol: 'SOLUSDT',
            timeframe: '5m',
            positionPct: 10,
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        create: jest.fn(),
      },
      userStrategySubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    }
    const prisma = {
      runInTransaction: jest.fn(async (callback: (client: typeof tx) => Promise<string>) => callback(tx)),
    }

    const repo = new AccountStrategyViewRepository(prisma as any)

    const result = await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX SOLUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      strategyInstanceId: 'strategy-instance-1',
    })

    expect(result.strategyInstanceId).toBe('strategy-instance-1')
    expect(result.mode).toBe('TESTNET')
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
    expect(tx.strategyInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'strategy-instance-1' },
      data: expect.objectContaining({
        status: 'running',
        mode: 'TESTNET',
      }),
    }))
    expect(tx.userStrategySubscription.create).toHaveBeenCalled()
    expect(tx.userStrategyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        strategyId: 'template-1',
      }),
    }))
  })

  it('falls back to a default strategy name when the deploy payload name is missing', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true }),
      },
      strategyTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'strategy-instance-1',
          createdBy: 'user-1',
          strategyTemplateId: 'template-1',
          params: {
            symbol: 'SOLUSDT',
            timeframe: '5m',
            positionPct: 10,
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        create: jest.fn(),
      },
      userStrategySubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    }
    const prisma = {
      runInTransaction: jest.fn(async (callback: (client: typeof tx) => Promise<string>) => callback(tx)),
    }

    const repo = new AccountStrategyViewRepository(prisma as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: undefined as any,
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      strategyInstanceId: 'strategy-instance-1',
    })

    expect(tx.strategyInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'AI策略',
      }),
    }))
    expect(tx.userStrategyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        strategyName: 'AI策略',
      }),
    }))
  })

  it('rejects deploy when the selected exchangeAccountId does not belong to the user instead of creating a fake account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn(),
      },
      strategyTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
        create: jest.fn(),
      },
      strategyInstance: {
        create: jest.fn(),
      },
      userStrategySubscription: {
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }
    const prisma = {
      runInTransaction: jest.fn(async (callback: (client: typeof tx) => Promise<string>) => callback(tx)),
    }

    const repo = new AccountStrategyViewRepository(prisma as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'BTC test',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 10,
      exchangeAccountId: 'missing-account',
      exchangeAccountName: 'Binance User Account',
    })).rejects.toThrow('Exchange account not found')

    expect(tx.exchangeAccount.create).not.toHaveBeenCalled()
    expect(tx.userStrategySubscription.create).not.toHaveBeenCalled()
  })

  it('rejects deploy when no real exchange account is available instead of creating a mock account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      strategyTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
        create: jest.fn(),
      },
      strategyInstance: {
        create: jest.fn(),
      },
      userStrategySubscription: {
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }
    const prisma = {
      runInTransaction: jest.fn(async (callback: (client: typeof tx) => Promise<string>) => callback(tx)),
    }

    const repo = new AccountStrategyViewRepository(prisma as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'BTC test',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 10,
    })).rejects.toThrow('Exchange account not found')

    expect(tx.exchangeAccount.create).not.toHaveBeenCalled()
    expect(tx.userStrategySubscription.create).not.toHaveBeenCalled()
  })
})

describe('accountStrategyViewRepository.listStrategiesForUser', () => {
  it('falls back to safe pagination defaults when page or limit are invalid', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const userStrategySubscriptionFindMany = jest.fn().mockResolvedValue([])
    const prisma = {
      getClient: jest.fn().mockReturnValue({
        userStrategySubscription: {
          findMany: userStrategySubscriptionFindMany,
        },
        strategyInstance: {
          findMany,
          count,
        },
      }),
    }

    const repo = new AccountStrategyViewRepository(prisma as any)

    const result = await repo.listStrategiesForUser({
      userId: 'user-1',
      page: Number.NaN,
      limit: Number.NaN,
    })

    expect(userStrategySubscriptionFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { strategyInstanceId: true },
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 20,
    }))
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.total).toBe(0)
  })
})
