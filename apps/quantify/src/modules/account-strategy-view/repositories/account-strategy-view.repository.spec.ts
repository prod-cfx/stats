import { AccountStrategyViewRepository } from './account-strategy-view.repository'

function createTxHost(tx: any) {
  return {
    tx,
    withTransaction: jest.fn(async (callback: () => Promise<any>) => callback()),
  }
}

describe('accountStrategyViewRepository.deployStrategyForUser', () => {
  it('reuses the published AI draft instance from snapshot binding', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    const result = await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX SOLUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      deploymentExecutionConfig: {
        leverage: 4,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
      },
      executionConfigVersion: 1,
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      exchangeAccountId: 'exchange-account-1',
    })

    expect(result.strategyInstanceId).toBe('strategy-instance-1')
    expect(result.mode).toBe('TESTNET')
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
    expect(tx.strategyInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'strategy-instance-1' },
      data: expect.objectContaining({
        deploymentExecutionConfig: {
          leverage: 4,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 1,
        runtimeBindingStatus: 'PENDING',
        runtimeBindingErrorCode: null,
        runtimeBindingUpdatedAt: expect.any(Date),
        params: expect.objectContaining({
          marketType: 'spot',
          deploymentExecutionConfig: {
            leverage: 4,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          executionConfigVersion: 1,
        }),
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          sourceStrategyInstanceId: 'strategy-instance-1',
          sourceStrategyTemplateId: 'template-1',
        }),
      }),
    }))
    const updatePayload = tx.strategyInstance.update.mock.calls[0]?.[0]?.data
    expect(updatePayload.status).toBeUndefined()
    expect(updatePayload.mode).toBeUndefined()
    expect(updatePayload.startedAt).toBeUndefined()
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
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: undefined as any,
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
    })

    expect(tx.strategyInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'AI策略',
        runtimeBindingStatus: 'PENDING',
      }),
    }))
    expect(tx.userStrategyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        strategyName: 'AI策略',
      }),
    }))
  })

  it('reuses sourceStrategyInstanceId from published snapshot when explicit strategyInstanceId is missing', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
      },
      strategyTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'strategy-instance-snapshot',
          createdBy: 'user-1',
          strategyTemplateId: 'template-1',
          params: {
            symbol: 'SOLUSDT',
            timeframe: '5m',
            positionPct: 10,
          },
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-created',
            snapshotHash: 'snapshot-hash-created',
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-snapshot' }),
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'snapshot deploy',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: 'strategy-instance-snapshot',
        sourceStrategyTemplateId: 'template-1',
      },
    } as any)

    expect(tx.strategyInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'strategy-instance-snapshot' },
      data: expect.objectContaining({
        runtimeBindingStatus: 'PENDING',
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-created',
          snapshotHash: 'snapshot-hash-created',
          sourceStrategyTemplateId: 'template-1',
        }),
      }),
    }))
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
  })

  it('rejects deploy when snapshot-derived strategy instance is unavailable', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
      },
      strategyTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      strategyInstance: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      userStrategySubscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'snapshot deploy',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: null,
        sourceStrategyTemplateId: 'template-1',
      },
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deploy_strategy_instance_not_found',
    })

    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
    expect(tx.strategyTemplate.create).not.toHaveBeenCalled()
  })

  it('uses provided exchange balance quotes when seeding the internal strategy account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-created',
            snapshotHash: 'snapshot-hash-created',
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX SOLUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      initialBalanceQuote: 60000,
      accountBalanceQuote: 58000,
    } as any)

    expect(tx.userStrategyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        baseCurrency: 'USDT',
        initialBalance: expect.objectContaining({}),
        balance: expect.objectContaining({}),
        equity: expect.objectContaining({}),
      }),
    }))
    const call = tx.userStrategyAccount.create.mock.calls[0]?.[0]
    expect(String(call.data.initialBalance)).toBe('60000')
    expect(String(call.data.balance)).toBe('58000')
    expect(String(call.data.equity)).toBe('60000')
  })

  it('uses funding asset as strategy account base currency for non-USDT symbols', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
            symbol: 'BTCUSDC',
            timeframe: '5m',
            positionPct: 10,
          },
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-created',
            snapshotHash: 'snapshot-hash-created',
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX BTCUSDC 5m AI策略',
      exchange: 'okx',
      symbol: 'BTCUSDC',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      initialBalanceQuote: 60000,
      accountBalanceQuote: 58000,
      fundingSnapshot: {
        asset: 'USDC',
        totalEquity: 60000,
        availableCash: 58000,
        availableEquity: null,
        reservedQuote: 0,
        usedMargin: null,
        buyingPower: 58000,
        executionCapital: 60000,
        fundingSource: 'exchange_testnet',
        accountMode: null,
        marginMode: null,
        nonTradableReason: null,
      },
    } as any)

    expect(tx.userStrategyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        baseCurrency: 'USDC',
      }),
    }))
  })

  it('normalizes funding snapshot source from inferred live exchange account mode', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-live-1', isTestnet: false, exchangeId: 'okx' }),
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
            symbol: 'BTCUSDT',
            timeframe: '5m',
            positionPct: 10,
          },
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-created',
            snapshotHash: 'snapshot-hash-created',
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX BTCUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-live-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      initialBalanceQuote: 4901.58222,
      accountBalanceQuote: 0,
      fundingSnapshot: {
        asset: 'USDT',
        totalEquity: 4901.58222,
        availableCash: null,
        availableEquity: 0,
        reservedQuote: 0,
        usedMargin: null,
        buyingPower: 0,
        executionCapital: 4901.58222,
        fundingSource: 'exchange_testnet',
        accountMode: null,
        marginMode: null,
        nonTradableReason: 'exchange_available_balance_zero',
      },
    } as any)

    const updatePayload = tx.strategyInstance.update.mock.calls[0]?.[0]?.data
    expect(updatePayload.params.fundingSnapshot).toEqual(expect.objectContaining({
      totalEquity: 4901.58222,
      buyingPower: 0,
      fundingSource: 'exchange_live',
    }))
    const subscriptionPayload = tx.userStrategySubscription.create.mock.calls[0]?.[0]?.data
    expect(subscriptionPayload.customParams.fundingSnapshot).toEqual(expect.objectContaining({
      totalEquity: 4901.58222,
      buyingPower: 0,
      fundingSource: 'exchange_live',
    }))
  })

  it('updates pristine existing strategy account balances from deploy funding', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn(),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
            symbol: 'BTCUSDT',
            timeframe: '5m',
            positionPct: 10,
          },
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-created',
            snapshotHash: 'snapshot-hash-created',
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
        findUnique: jest.fn().mockResolvedValue({
          id: 'strategy-account-1',
          initialBalance: 1000,
          balance: 1000,
          equity: 1000,
          totalRealizedPnl: 0,
          totalUnrealizedPnl: 0,
          _count: {
            positions: 0,
            trades: 0,
            ledger: 0,
            signalExecutions: 0,
          },
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX BTCUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '5m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-created',
        snapshotHash: 'snapshot-hash-created',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      initialBalanceQuote: 4901.58222,
      accountBalanceQuote: 0,
      fundingSnapshot: {
        asset: 'USDT',
        totalEquity: 4901.58222,
        availableCash: null,
        availableEquity: 0,
        reservedQuote: 0,
        usedMargin: null,
        buyingPower: 0,
        executionCapital: 4901.58222,
        fundingSource: 'exchange_testnet',
        accountMode: null,
        marginMode: null,
        nonTradableReason: 'exchange_available_balance_zero',
      },
    } as any)

    expect(tx.userStrategyAccount.create).not.toHaveBeenCalled()
    expect(tx.userStrategyAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'strategy-account-1' },
      data: expect.objectContaining({
        strategyName: 'OKX BTCUSDT 5m AI策略',
        baseCurrency: 'USDT',
        initialBalance: expect.objectContaining({}),
        balance: expect.objectContaining({}),
        equity: expect.objectContaining({}),
      }),
    }))
    const updatePayload = tx.userStrategyAccount.update.mock.calls[0]?.[0]?.data
    expect(String(updatePayload.initialBalance)).toBe('4901.58222')
    expect(String(updatePayload.balance)).toBe('0')
    expect(String(updatePayload.equity)).toBe('4901.58222')
  })

  it('updates deployment execution leverage with version bump and compatibility shadow fields', async () => {
    const tx = {
      strategyInstance: {
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
      },
    }
    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.updateDeploymentExecutionConfig({
      strategyInstanceId: 'strategy-instance-1',
      userId: 'user-1',
      executionConfig: {
        leverage: 5,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
      },
      executionConfigVersion: 3,
      existingParams: {
        symbol: 'SOLUSDT',
      },
      existingMetadata: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
      },
    })

    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        deploymentExecutionConfig: {
          leverage: 5,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 3,
        updatedBy: 'user-1',
        params: {
          symbol: 'SOLUSDT',
          deploymentExecutionConfig: {
            leverage: 5,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          executionConfigVersion: 3,
        },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          executionConfigVersion: 3,
          reReadAtNextEligibleExecutionCycle: true,
        },
      },
    })
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'BTC test',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '1h',
      positionPct: 10,
      exchangeAccountId: 'missing-account',
      exchangeAccountName: 'Binance User Account',
    })).rejects.toThrow('Exchange account not found')

    expect(tx.exchangeAccount.create).not.toHaveBeenCalled()
    expect(tx.userStrategySubscription.create).not.toHaveBeenCalled()
  })

  it('rejects deploy when the selected exchange account does not match the snapshot exchange', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'binance' }),
      },
      strategyTemplate: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      strategyInstance: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      userStrategySubscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'spot deploy',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      marketType: 'spot',
      timeframe: '15m',
      positionPct: 10,
      exchangeAccountId: 'exchange-account-1',
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-spot',
        snapshotHash: 'snapshot-hash-spot',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deploy_exchange_account_mismatch',
    })
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

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'BTC test',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '1h',
      positionPct: 10,
    })).rejects.toThrow('Exchange account not found')

    expect(tx.exchangeAccount.create).not.toHaveBeenCalled()
    expect(tx.userStrategySubscription.create).not.toHaveBeenCalled()
  })

  it('rejects reusing a strategy instance when its snapshot binding does not match the requested published snapshot', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'exchange-account-1', isTestnet: true, exchangeId: 'okx' }),
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
          metadata: {
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: 'snapshot-old',
            snapshotHash: 'snapshot-hash-old',
          },
        }),
        update: jest.fn(),
        create: jest.fn(),
      },
      userStrategySubscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userStrategyAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await expect(repo.deployStrategyForUser({
      userId: 'user-1',
      name: 'OKX SOLUSDT 5m AI策略',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-new',
        snapshotHash: 'snapshot-hash-new',
        sourceStrategyInstanceId: 'strategy-instance-1',
        sourceStrategyTemplateId: 'template-1',
      },
      exchangeAccountId: 'exchange-account-1',
    })).rejects.toMatchObject({
      message: 'account_strategy.deploy_strategy_instance_not_found',
    })

    expect(tx.strategyInstance.update).not.toHaveBeenCalled()
    expect(tx.strategyInstance.create).not.toHaveBeenCalled()
  })
})

describe('accountStrategyViewRepository.deleteStrategyForUser', () => {
  it('archives strategy visibility and unlinks only direct user-visible relations in one transaction', async () => {
    const tx = {
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        delete: jest.fn(),
      },
      llmStrategyCodegenSession: {
        findMany: jest.fn().mockResolvedValue([{ id: 'session-direct' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      publishedStrategySnapshot: {
        findMany: jest.fn().mockResolvedValue([{ sessionId: 'session-snapshot' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      aiQuantConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deleteStrategyForUser('user-1', 'strategy-instance-1', { archiveLinkedConversations: true })

    expect(tx.strategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'strategy-instance-1',
        createdBy: 'user-1',
        archivedAt: null,
      },
      select: { id: true },
    })
    expect(tx.llmStrategyCodegenSession.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', strategyInstanceId: 'strategy-instance-1' },
      select: { id: true },
    })
    expect(tx.publishedStrategySnapshot.findMany).toHaveBeenCalledWith({
      where: { strategyInstanceId: 'strategy-instance-1', session: { userId: 'user-1' } },
      select: { sessionId: true },
    })
    expect(tx.aiQuantConversation.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        archivedAt: null,
        codegenSessionId: { in: ['session-direct', 'session-snapshot'] },
      },
      data: { archivedAt: expect.any(Date) },
    })
    expect(tx.llmStrategyCodegenSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', strategyInstanceId: 'strategy-instance-1' },
      data: { strategyInstanceId: null },
    })
    expect(tx.publishedStrategySnapshot.updateMany).toHaveBeenCalledWith({
      where: { strategyInstanceId: 'strategy-instance-1', session: { userId: 'user-1' } },
      data: { strategyInstanceId: null },
    })
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        archivedAt: expect.any(Date),
        archivedReason: 'USER_DELETE',
        archivedByUserId: 'user-1',
        updatedBy: 'user-1',
      },
    })
    expect(tx.strategyInstance.delete).not.toHaveBeenCalled()
  })

  it('does not archive linked conversations when the caller owns current conversation archive', async () => {
    const tx = {
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
      },
      llmStrategyCodegenSession: {
        findMany: jest.fn().mockResolvedValue([{ id: 'session-direct' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      publishedStrategySnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      aiQuantConversation: { updateMany: jest.fn() },
    }
    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.deleteStrategyForUser('user-1', 'strategy-instance-1', { archiveLinkedConversations: false })

    expect(tx.aiQuantConversation.updateMany).not.toHaveBeenCalled()
    expect(tx.strategyInstance.update).toHaveBeenCalled()
  })
})

describe('accountStrategyViewRepository.listStrategiesForUser', () => {
  it('falls back to safe pagination defaults when page or limit are invalid', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const userStrategySubscriptionFindMany = jest.fn().mockResolvedValue([])
    const tx = {
      userStrategySubscription: {
        findMany: userStrategySubscriptionFindMany,
      },
      strategyInstance: {
        findMany,
        count,
      },
    }

    const repo = new AccountStrategyViewRepository({ tx } as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

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
      where: expect.objectContaining({ archivedAt: null }),
      skip: 0,
      take: 20,
    }))
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.total).toBe(0)
  })

  it('selects strategy template schema fields for account strategy list rendering', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const userStrategySubscriptionFindMany = jest.fn().mockResolvedValue([])
    const tx = {
      userStrategySubscription: {
        findMany: userStrategySubscriptionFindMany,
      },
      strategyInstance: {
        findMany,
        count,
      },
    }

    const repo = new AccountStrategyViewRepository({ tx } as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.listStrategiesForUser({
      userId: 'user-1',
      page: 1,
      limit: 20,
    })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        strategyTemplate: {
          select: expect.objectContaining({
            id: true,
            defaultParams: true,
            paramsSchema: true,
            rulesVersion: true,
            metadata: true,
          }),
        },
      }),
    }))
  })
})

describe('accountStrategyViewRepository.findStrategyForUser', () => {
  it('selects strategy template schema fields for account strategy detail rendering', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const tx = {
      strategyInstance: {
        findFirst,
      },
    }

    const repo = new AccountStrategyViewRepository({ tx } as any, { deployRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } as any)

    await repo.findStrategyForUser('user-1', 'inst-1')

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ archivedAt: null }),
      include: expect.objectContaining({
        strategyTemplate: {
          select: expect.objectContaining({
            id: true,
            defaultParams: true,
            paramsSchema: true,
            rulesVersion: true,
            metadata: true,
          }),
        },
      }),
    }))
  })
})
