import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.updateDeploymentLeverage', () => {
  it('rejects leverage updates when the strategy account still has open positions', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'ETH strategy',
        status: 'running',
        createdBy: 'user-1',
        strategyTemplateId: 'tpl-1',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        deploymentExecutionConfig: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
          tdMode: 'cross',
        },
        executionConfigVersion: 2,
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: { id: 'acct-1', name: 'Main', exchangeId: 'okx' },
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({ id: 'strategy-account-1' }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 1, closedCount: 4 }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'ETHUSDT',
            baseTimeframe: '15m',
            marketType: 'perp',
            positionPct: 10,
            strategyDeclaredLeverageRange: { min: 1, max: 8 },
          },
          deploymentExecutionDefaults: {
            leverage: 3,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
            tdMode: 'cross',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            strategyDeclaredLeverageRange: { min: 1, max: 8 },
            defaultLeverage: 3,
          },
        }),
      } as any,
    )

    await expect(service.updateDeploymentLeverage('inst-1', {
      userId: 'user-1',
      leverage: 4,
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deployment_leverage_requires_flat_positions',
    })
  })

  it('rejects leverage updates from non-owner subscribers', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'ETH strategy',
        status: 'running',
        createdBy: 'owner-1',
        strategyTemplateId: 'tpl-1',
        params: {},
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        deploymentExecutionConfig: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
          tdMode: 'cross',
        },
        executionConfigVersion: 2,
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: { id: 'acct-1', name: 'Main', exchangeId: 'okx' },
        }],
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
    )

    await expect(service.updateDeploymentLeverage('inst-1', {
      userId: 'user-1',
      leverage: 4,
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.owner_only',
    })
  })

  it('updates only leverage, bumps version, and returns refreshed detail when positions are flat', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'ETH strategy',
        status: 'running',
        createdBy: 'user-1',
        strategyTemplateId: 'tpl-1',
        params: { symbol: 'ETHUSDT' },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        deploymentExecutionConfig: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
          tdMode: 'cross',
        },
        executionConfigVersion: 2,
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: { id: 'acct-1', name: 'Main', exchangeId: 'okx' },
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({ id: 'strategy-account-1' }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 4 }),
      updateDeploymentExecutionConfig: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 4,
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      tradingService as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'ETHUSDT',
            baseTimeframe: '15m',
            marketType: 'perp',
            positionPct: 10,
            strategyDeclaredLeverageRange: { min: 1, max: 8 },
          },
          deploymentExecutionDefaults: {
            leverage: 3,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
            tdMode: 'cross',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            strategyDeclaredLeverageRange: { min: 1, max: 8 },
            defaultLeverage: 3,
          },
        }),
      } as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1', deployment: { executionConfigVersion: 3 } } as any)

    await service.updateDeploymentLeverage('inst-1', {
      userId: 'user-1',
      leverage: 4,
      reason: 'reduce risk',
    } as any)

    expect(tradingService.getLeverageConstraints).toHaveBeenCalledWith({
      userId: 'user-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'ETHUSDT',
      exchangeAccountId: 'acct-1',
    })
    expect(repo.updateDeploymentExecutionConfig).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-1',
      userId: 'user-1',
      executionConfig: {
        leverage: 4,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
        tdMode: 'cross',
      },
      executionConfigVersion: 3,
      existingParams: { symbol: 'ETHUSDT' },
      existingMetadata: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
      },
      reason: 'reduce risk',
    })
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-1')
  })

  it('rejects leverage updates for spot deployments', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'ETH strategy',
        status: 'running',
        createdBy: 'user-1',
        strategyTemplateId: 'tpl-1',
        params: { symbol: 'ETHUSDT' },
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        deploymentExecutionConfig: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
          tdMode: 'cross',
        },
        executionConfigVersion: 1,
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: { id: 'acct-1', name: 'Main', exchangeId: 'okx' },
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({ id: 'strategy-account-1' }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'ETHUSDT',
            baseTimeframe: '15m',
            marketType: 'spot',
            positionPct: 10,
          },
          deploymentExecutionDefaults: {
            leverage: 1,
            priceSource: 'close',
            orderType: 'market',
            timeInForce: 'GTC',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 1,
            defaultLeverage: 1,
          },
        }),
      } as any,
    )

    await expect(service.updateDeploymentLeverage('inst-1', {
      userId: 'user-1',
      leverage: 2,
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deployment_leverage_not_supported_for_spot',
    })
  })
})
