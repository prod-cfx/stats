import { AccountStrategyViewRepository } from './account-strategy-view.repository'

describe('accountStrategyViewRepository.deployStrategyForUser', () => {
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
