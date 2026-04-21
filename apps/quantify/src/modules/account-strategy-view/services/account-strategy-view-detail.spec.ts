import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.getStrategyDetail', () => {
  it('degrades gracefully when exchange balance lookup is slow', async () => {
    jest.useFakeTimers()
    try {
      const repo = {
        findStrategyForUser: jest.fn().mockResolvedValue({
          id: 'inst-slow-balance',
          name: 'Hyperliquid detail',
          status: 'running',
          createdBy: 'user-1',
          params: { exchange: 'hyperliquid', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 5 },
          strategyTemplateId: 'tpl-hl-1',
          strategyTemplate: {
            defaultParams: {},
            paramsSchema: null,
            rulesVersion: 0,
          },
          subscriptions: [{
            userId: 'user-1',
            status: 'active',
            customParams: {},
            subscribedAt: new Date('2026-04-03T11:58:59.000Z'),
            exchangeAccount: { id: 'acct-hl-1', exchangeId: 'hyperliquid', name: '1212' },
          }],
          startedAt: new Date('2026-04-03T11:58:59.000Z'),
          updatedAt: new Date('2026-04-03T11:59:00.000Z'),
        }),
        findUserStrategyAccount: jest.fn().mockResolvedValue({
          id: 'acc-hl-1',
          initialBalance: 1000,
          equity: 1000,
          totalRealizedPnl: 0,
          totalUnrealizedPnl: 0,
          baseCurrency: 'USDT',
        }),
        loadEquitySeries: jest.fn().mockResolvedValue([]),
        loadLatestDailySnapshot: jest.fn().mockResolvedValue(null),
        loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
        loadPositionFinancials: jest.fn().mockResolvedValue({
          openCostBasis: 0,
          totalRealizedPnl: 0,
          totalUnrealizedPnl: 0,
        }),
        loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
        loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
        loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
        loadTimeline: jest.fn().mockResolvedValue({
          instance: {
            createdAt: new Date('2026-04-03T11:58:50.000Z'),
            startedAt: new Date('2026-04-03T11:58:59.000Z'),
            stoppedAt: null,
          },
          subscription: { subscribedAt: new Date('2026-04-03T11:58:59.000Z') },
          signalExecutions: [],
          trades: [],
        }),
      }
      const statsService = { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() }
      const strategyInstancesService = { updateInstance: jest.fn() }
      const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
      const tradingService = {
        getBalance: jest.fn().mockImplementation(
          () => new Promise(() => {}),
        ),
      }

      const service = new AccountStrategyViewService(
        repo as any,
        statsService as any,
        strategyInstancesService as any,
        marketDataIngestionService as any,
        undefined,
        undefined,
        tradingService as any,
      )

      const detailPromise = service.getStrategyDetail('user-1', 'inst-slow-balance')
      const resultPromise = Promise.race([
        detailPromise.then(detail => ({ type: 'resolved' as const, detail })),
        jest.advanceTimersByTimeAsync(3_000).then(() => ({ type: 'timeout' as const })),
      ])

      await expect(resultPromise).resolves.toMatchObject({
        type: 'resolved',
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('builds detail payload with equity series and mixed timeline', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        },
        params: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '3m/15m', positionPct: 10 },
        strategyTemplateId: 'tpl-1',
        strategyTemplate: {
          defaultParams: { timeframe: '1m/5m', riskMode: 'balanced' },
          paramsSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string' },
              riskMode: { type: 'string' },
            },
          },
          rulesVersion: 7,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: { riskMode: 'aggressive' },
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { id: 'acct-1', name: '主账户', exchangeId: 'okx' },
        }],
        startedAt: new Date('2026-03-20T10:01:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
        updatedBy: 'user-1',
        deploymentExecutionConfig: {
          leverage: 4,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 2,
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-1',
        initialBalance: 10000,
        equity: 12000,
        totalRealizedPnl: 1500,
        totalUnrealizedPnl: 500,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([
        { date: new Date('2026-03-19T00:00:00.000Z'), equityEnd: 10100, maxDrawdown: 5.5, realizedPnl: 30, unrealizedPnl: 40 },
      ]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 74, closedCount: 10, winningCount: 6 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 2, closedCount: 10 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          startedAt: new Date('2026-03-20T10:01:00.000Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-03-20T10:00:00.000Z') },
        signalExecutions: [{ createdAt: new Date('2026-03-20T11:00:00.000Z'), status: 'SUCCESS', errorMessage: null }],
        trades: [{
          executedAt: new Date('2026-03-20T11:01:00.000Z'),
          side: 'BUY',
          symbol: 'BTCUSDT',
          price: 68000,
          quantity: 0.12,
          fee: 1.5,
          feeCurrency: 'USDT',
          orderId: 'ord-1',
        }],
      }),
    }
    const statsService = { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const publishedSnapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '3m',
          stateTimeframes: ['15m'],
          marketType: 'perp',
          positionPct: 25,
          strategyDeclaredLeverageRange: { min: 1, max: 8 },
        },
        backtestConfigDefaults: {
          initialCash: 20000,
          leverage: 3,
          slippageBps: 6,
          feeBps: 4,
          priceSource: 'mark',
          allowPartial: false,
        },
        deploymentExecutionDefaults: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          strategyDeclaredLeverageRange: { min: 1, max: 8 },
          defaultLeverage: 3,
          supportedPriceSources: ['mark', 'last'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['IOC'],
          constraintExplanation: 'platform risk and strategy range',
        },
        paramsSnapshot: {
          symbol: 'ETHUSDT',
          timeframe: '15m',
          riskMode: 'snapshot-risk',
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 25,
        },
      }),
    }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 4,
      }),
    }
    const runtimeExecutionStateService = {
      loadStatesForBinding: jest.fn().mockResolvedValue([
        {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'failed',
          failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
          failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
          lastAttemptAt: new Date('2026-03-20T10:03:00.000Z'),
          consumedAt: null,
          cooldownUntil: null,
        },
      ]),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
      publishedSnapshotsRepository as any,
      runtimeExecutionStateService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-1')

    expect(detail.id).toBe('inst-1')
    expect(detail.metrics.tradeCount).toBe(74)
    expect(detail.snapshot.deployAccountName).toBe('主账户')
    expect(detail.equitySeries.length).toBe(2)
    expect(detail.accountOverview).toEqual({
      initialBalance: 10000,
      totalEquity: 12000,
      availableBalance: 11500,
      totalPnl: 2000,
      todayPnl: 500,
      baseCurrency: 'USDT',
    })
    expect(detail.positionOverview).toEqual({
      openPositionsCount: 2,
      closedPositionsCount: 10,
      totalRealizedPnl: 1500,
      totalUnrealizedPnl: 500,
    })
    expect(detail.latestOrders[0]).toEqual({
      executedAt: '2026-03-20T11:01:00.000Z',
      side: 'BUY',
      symbol: 'BTCUSDT',
      price: 68000,
      quantity: 0.12,
      fee: 1.5,
      feeCurrency: 'USDT',
      orderId: 'ord-1',
    })
    expect(detail.timeline.some(e => e.eventType === 'system')).toBe(true)
    expect(detail.timeline.some(e => e.eventType === 'trade')).toBe(true)
    expect(detail.timeline[0]?.event).toBe('创建策略')
    expect(detail.paramSchema).toEqual({
      type: 'object',
      properties: {
        timeframe: { type: 'string' },
        riskMode: { type: 'string' },
      },
    })
    expect(detail.paramValues).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '3m/15m',
      positionPct: 10,
      riskMode: 'aggressive',
    })
    expect(detail.schemaVersion).toBe('7')
    expect(detail.snapshot.paramSchema).toEqual(detail.paramSchema)
    expect(detail.snapshot.publishedSnapshotId).toBe('snapshot-1')
    expect(detail.snapshot.snapshotHash).toBe('snapshot-hash-1')
    expect(detail.snapshot.exchange).toBe('okx')
    expect(detail.snapshot.symbol).toBe('ETHUSDT')
    expect(detail.snapshot.timeframe).toBe('3m')
    expect(detail.snapshot.positionPct).toBe(25)
    expect(detail.snapshot.paramValues).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      riskMode: 'snapshot-risk',
      positionPct: 25,
    })
    expect(detail.snapshot.strategyConfig).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '3m',
      stateTimeframes: ['15m'],
      marketType: 'perp',
      positionPct: 25,
      strategyDeclaredLeverageRange: { min: 1, max: 8 },
    })
    expect(detail.snapshot.backtestConfigDefaults).toEqual({
      initialCash: 20000,
      leverage: 3,
      slippageBps: 6,
      feeBps: 4,
      priceSource: 'mark',
      allowPartial: false,
      stateTimeframes: ['15m'],
    })
    expect(detail.snapshot.deploymentExecutionBaseline).toEqual({
      leverage: 3,
      priceSource: 'mark',
      orderType: 'market',
      timeInForce: 'IOC',
    })
    expect(detail.snapshot.deploymentExecutionCurrent).toEqual({
      leverage: 4,
      priceSource: 'mark',
      orderType: 'market',
      timeInForce: 'IOC',
    })
    expect(detail.snapshot.deploymentExecutionConstraints).toEqual(expect.objectContaining({
      platformRiskMaxLeverage: 5,
      strategyDeclaredLeverageRange: { min: 1, max: 8 },
      defaultLeverage: 3,
      accountMaxLeverage: 4,
    }))
    expect(detail.runtimeExecutionStates).toEqual([{
      executionSemanticKey: 'on_start.entry.primary',
      status: 'failed',
      failureFamily: 'execution',
      failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      lastAttemptAt: '2026-03-20T10:03:00.000Z',
      consumedAt: null,
      cooldownUntil: null,
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
    }])
    expect(detail.snapshot.effectiveAllowedLeverageRange).toEqual({ min: 1, max: 4 })
    expect(detail.snapshot.compatibilityMetadata).toEqual({
      isLegacySnapshot: false,
      missingStrategyConfig: false,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    })
    expect(detail.deployment).toEqual({
      exchangeAccountId: 'acct-1',
      exchangeAccountName: '主账户',
      executionConfig: {
        leverage: 4,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
      },
      executionConfigVersion: 2,
      effectiveAllowedLeverageRange: { min: 1, max: 4 },
      driftFields: ['leverage'],
      reReadAtNextEligibleExecutionCycle: true,
      updatedBy: 'user-1',
    })
    expect(detail.snapshot.schemaVersion).toBe('7')
    expect(publishedSnapshotsRepository.findByIdForUser).toHaveBeenCalledWith('snapshot-1', 'user-1')
    expect(tradingService.getLeverageConstraints).toHaveBeenCalledWith({
      userId: 'user-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'ETHUSDT',
      exchangeAccountId: 'acct-1',
    })
  })

  it('returns explicit null snapshot truth when no published snapshot binding exists', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-no-binding',
        name: 'No binding strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 10 },
        strategyTemplateId: 'tpl-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string' },
            },
          },
          rulesVersion: 7,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { name: '主账户' },
        }],
        startedAt: new Date('2026-03-20T10:01:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          startedAt: new Date('2026-03-20T10:01:00.000Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-03-20T10:00:00.000Z') },
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const publishedSnapshotsRepository = { findByIdForUser: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      undefined,
      publishedSnapshotsRepository as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-no-binding')

    expect(detail.snapshot.publishedSnapshotId).toBeNull()
    expect(detail.snapshot.snapshotHash).toBeNull()
    expect(detail.snapshot.exchange).toBeNull()
    expect(detail.snapshot.symbol).toBeNull()
    expect(detail.snapshot.timeframe).toBeNull()
    expect(detail.snapshot.positionPct).toBeNull()
    expect(detail.snapshot.paramValues).toBeNull()
    expect(detail.snapshot.strategyConfig).toBeNull()
    expect(detail.snapshot.backtestConfigDefaults).toBeNull()
    expect(detail.snapshot.deploymentExecutionBaseline).toBeNull()
    expect(detail.snapshot.deploymentExecutionCurrent).toBeNull()
    expect(detail.snapshot.deploymentExecutionConstraints).toBeNull()
    expect(detail.snapshot.compatibilityMetadata).toBeNull()
    expect(detail.runtimeExecutionStates).toEqual([])
    expect(detail.deployment).toBeNull()
    expect(publishedSnapshotsRepository.findByIdForUser).not.toHaveBeenCalled()
  })

  it('marks legacy snapshots as compatibility-only instead of faking backtest and deployment truth', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-legacy-1',
        name: 'Legacy snapshot strategy',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-legacy-1',
          snapshotHash: 'snapshot-legacy-hash-1',
        },
        params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 10 },
        strategyTemplateId: 'tpl-legacy-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: null,
          rulesVersion: 1,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { id: 'acct-legacy-1', name: 'Legacy account', exchangeId: 'okx' },
        }],
        startedAt: new Date('2026-03-20T10:01:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const runtimeExecutionStateService = {
      loadStatesForBinding: jest.fn().mockResolvedValue([
        {
          strategyInstanceId: 'inst-legacy-1',
          publishedSnapshotId: 'snapshot-legacy-1',
          snapshotHash: 'snapshot-legacy-hash-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        },
      ]),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-legacy-1',
          snapshotHash: 'snapshot-legacy-hash-1',
          paramsSnapshot: { symbol: 'BTCUSDT', timeframe: '15m' },
          lockedParams: { exchange: 'okx', positionPct: 10 },
        }),
      } as any,
      runtimeExecutionStateService as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-legacy-1')

    expect(detail.snapshot.backtestConfigDefaults).toBeNull()
    expect(detail.snapshot.deploymentExecutionBaseline).toBeNull()
    expect(detail.snapshot.deploymentExecutionCurrent).toBeNull()
    expect(detail.snapshot.deploymentExecutionConstraints).toBeNull()
    expect(detail.snapshot.compatibilityMetadata).toEqual({
      isLegacySnapshot: true,
      missingStrategyConfig: true,
      missingBacktestConfigDefaults: true,
      missingDeploymentExecutionDefaults: true,
      missingDeploymentExecutionConstraints: true,
      requiresRepublishForBacktest: true,
      requiresRepublishForDeploy: true,
    })
    expect(detail.deployment).toBeNull()
    expect(detail.runtimeExecutionStates).toEqual([])
    expect(detail.snapshot.paramValues).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
    })
    expect(runtimeExecutionStateService.loadStatesForBinding).not.toHaveBeenCalled()
  })

  it('marks missing bound snapshots as invalid compatibility state and hides deployment truth', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-missing-snapshot-1',
        name: 'Missing snapshot strategy',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-missing-1',
          snapshotHash: 'snapshot-missing-hash-1',
        },
        params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 10 },
        strategyTemplateId: 'tpl-missing-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: null,
          rulesVersion: 1,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { id: 'acct-missing-1', name: 'Missing account', exchangeId: 'okx' },
        }],
        startedAt: new Date('2026-03-20T10:01:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
        deploymentExecutionConfig: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 2,
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const runtimeExecutionStateService = {
      loadStatesForBinding: jest.fn(),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue(null),
      } as any,
      runtimeExecutionStateService as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-missing-snapshot-1')

    expect(detail.snapshot.compatibilityMetadata).toEqual({
      isLegacySnapshot: true,
      missingStrategyConfig: true,
      missingBacktestConfigDefaults: true,
      missingDeploymentExecutionDefaults: true,
      missingDeploymentExecutionConstraints: true,
      requiresRepublishForBacktest: true,
      requiresRepublishForDeploy: true,
      invalidBinding: true,
    })
    expect(detail.runtimeExecutionStates).toEqual([])
    expect(detail.deployment).toBeNull()
    expect(runtimeExecutionStateService.loadStatesForBinding).not.toHaveBeenCalled()
  })

  it('fails closed when bound runtime execution states cannot be validated', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-runtime-invalid-1',
        name: 'Runtime invalid strategy',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-runtime-invalid-1',
          snapshotHash: 'snapshot-runtime-invalid-hash-1',
        },
        params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 10 },
        strategyTemplateId: 'tpl-runtime-invalid-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: null,
          rulesVersion: 1,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { id: 'acct-1', exchangeId: 'okx', name: '主账户' },
        }],
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
        deploymentExecutionConfig: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 1,
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          startedAt: new Date('2026-03-20T10:01:00.000Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-03-20T10:00:00.000Z') },
        signalExecutions: [],
        trades: [],
      }),
    }
    const runtimeExecutionStateService = {
      loadStatesForBinding: jest.fn().mockRejectedValue(new Error('snapshot_hash_mismatch')),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-runtime-invalid-1',
          snapshotHash: 'snapshot-runtime-invalid-hash-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            baseTimeframe: '15m',
            marketType: 'perp',
            positionPct: 10,
          },
          backtestConfigDefaults: { initialCash: 10000 },
          deploymentExecutionDefaults: {
            leverage: 2,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            defaultLeverage: 2,
          },
          paramsSnapshot: { symbol: 'BTCUSDT', timeframe: '15m' },
          lockedParams: { exchange: 'okx', positionPct: 10 },
        }),
      } as any,
      runtimeExecutionStateService as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-runtime-invalid-1')

    expect(detail.runtimeExecutionStates).toEqual([])
    expect(detail.snapshot.compatibilityMetadata).toEqual(expect.objectContaining({
      invalidBinding: true,
    }))
    expect(detail.deployment).toBeNull()
    expect(runtimeExecutionStateService.loadStatesForBinding).toHaveBeenCalled()
  })

  it('preserves deployment truth when runtime execution state loading fails for a transient read error', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-runtime-transient-1',
        name: 'Runtime transient strategy',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-runtime-transient-1',
          snapshotHash: 'snapshot-runtime-transient-hash-1',
        },
        params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m', positionPct: 10 },
        strategyTemplateId: 'tpl-runtime-transient-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: null,
          rulesVersion: 1,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { id: 'acct-1', exchangeId: 'okx', name: '主账户' },
        }],
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
        deploymentExecutionConfig: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 1,
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          startedAt: new Date('2026-03-20T10:01:00.000Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-03-20T10:00:00.000Z') },
        signalExecutions: [],
        trades: [],
      }),
    }
    const runtimeExecutionStateService = {
      loadStatesForBinding: jest.fn().mockRejectedValue(new Error('temporary_runtime_state_read_failure')),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      undefined,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-runtime-transient-1',
          snapshotHash: 'snapshot-runtime-transient-hash-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            baseTimeframe: '15m',
            marketType: 'perp',
            positionPct: 10,
          },
          backtestConfigDefaults: { initialCash: 10000 },
          deploymentExecutionDefaults: {
            leverage: 2,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            defaultLeverage: 2,
          },
          paramsSnapshot: { symbol: 'BTCUSDT', timeframe: '15m' },
          lockedParams: { exchange: 'okx', positionPct: 10 },
        }),
      } as any,
      runtimeExecutionStateService as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-runtime-transient-1')

    expect(detail.runtimeExecutionStates).toEqual([])
    expect(detail.snapshot.compatibilityMetadata).not.toEqual(expect.objectContaining({
      invalidBinding: true,
    }))
    expect(detail.deployment).not.toBeNull()
    expect(runtimeExecutionStateService.loadStatesForBinding).toHaveBeenCalled()
  })

  it('rejects detail when strategy is not actively subscribed', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'running',
        createdBy: 'user-1',
        params: null,
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'inactive' }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )

    await expect(service.getStrategyDetail('user-1', 'inst-1')).rejects.toMatchObject({
      message: 'account_strategy.not_found',
    })
  })

  it('rejects detail when strategy status is draft', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'draft',
        createdBy: 'user-1',
        params: null,
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'active' }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )

    await expect(service.getStrategyDetail('user-1', 'inst-1')).rejects.toMatchObject({
      message: 'account_strategy.not_found',
    })
  })

  it('falls back to instance stats tradeCount when account trade stats are empty', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'running',
        createdBy: 'user-1',
        params: null,
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-1',
        initialBalance: 10000,
        equity: 12000,
        totalRealizedPnl: 1500,
        totalUnrealizedPnl: 500,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue({
        totalTradesCount: 74,
        maxDrawdown: 12.3,
        winRate: 58.4,
      }),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-1')

    expect(detail.metrics.tradeCount).toBe(74)
  })

  it('keeps pnl fields nullable when backend stats are unavailable', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-9',
        name: 'Null pnl strategy',
        status: 'running',
        createdBy: 'user-1',
        params: null,
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-9')

    expect(detail.totalPnl).toBeNull()
    expect(detail.todayPnl).toBeNull()
  })

  it('falls back to latest executed account by symbol when template account is missing', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-fallback',
        name: 'Fallback strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT' },
        strategyTemplateId: 'tpl-missing',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue({
        id: 'acc-from-exec',
        initialBalance: 10000,
        equity: 10100,
        totalRealizedPnl: 80,
        totalUnrealizedPnl: 20,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 3, closedCount: 2, winningCount: 1 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 2 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-fallback')

    expect(repo.findLatestExecutedAccountByUserAndSymbol).toHaveBeenCalledWith('user-1', 'BTCUSDT')
    expect(detail.metrics.tradeCount).toBe(3)
    expect(detail.totalPnl).toBe(100)
  })

  it('prefers bound exchange account balances for pristine strategy accounts', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-live-account',
        name: 'Live account strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-live-account',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: {
            id: 'exchange-account-1',
            name: 'OKX Sim',
            exchangeId: 'okx',
          },
        }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-live-account',
        baseCurrency: 'USDT',
        initialBalance: 1000,
        balance: 1000,
        equity: 1000,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'BTC', free: 0.1, locked: 0, total: 0.1 },
        { asset: 'USDT', free: 60000, locked: 0, total: 60000 },
      ]),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-live-account')

    expect(tradingService.getBalance).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'exchange-account-1')
    expect(detail.accountOverview).toEqual({
      initialBalance: 60000,
      totalEquity: 60000,
      availableBalance: 60000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    })
    expect(detail.equitySeries.every(item => item.value === 60000)).toBe(true)
  })

  it('uses live exchange equity as the latest curve point for pristine non-default seed accounts', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-live-account-nondefault-seed',
        name: 'Live account strategy with seeded capital',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-live-account-nondefault-seed',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: {
            id: 'exchange-account-1',
            name: 'OKX Sim',
            exchangeId: 'okx',
          },
        }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-live-account-nondefault-seed',
        baseCurrency: 'USDT',
        initialBalance: 50000,
        balance: 50000,
        equity: 50000,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 58000, locked: 2000, total: 60000 },
      ]),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-live-account-nondefault-seed')

    expect(detail.accountOverview).toEqual({
      initialBalance: 50000,
      totalEquity: 60000,
      availableBalance: 58000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    })
    expect(detail.equitySeries.at(-1)?.value).toBe(60000)
  })

  it('ignores pre-start closed positions when computing drawdown', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-dd',
        name: 'Drawdown guard',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT' },
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-dd',
        initialBalance: 10000,
        equity: 10010,
        totalRealizedPnl: 10,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([
        // 启动前的大亏损，不应计入当前策略回撤
        {
          openedAt: new Date('2026-03-18T09:00:00.000Z'),
          closedAt: new Date('2026-03-18T10:00:00.000Z'),
          realizedPnl: -9994,
        },
        {
          openedAt: new Date('2026-03-20T11:00:00.000Z'),
          closedAt: new Date('2026-03-20T11:05:00.000Z'),
          realizedPnl: 10,
        },
      ]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 1, closedCount: 1, winningCount: 1 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 1 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-20T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-dd')

    expect(detail.metrics.maxDrawdownPct).toBe(0)
    expect(detail.equitySeries.every(item => item.value > 1000)).toBe(true)
  })

  it('returns null dynamic param fields when strategy template schema is missing', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-legacy',
        name: 'Legacy strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'ETHUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-legacy',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
          paramsSchema: null,
          rulesVersion: 9,
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue(null),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue(null),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ingestAndComputeIndicators: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-legacy')

    expect(detail.paramSchema).toBeNull()
    expect(detail.paramValues).toBeNull()
    expect(detail.schemaVersion).toBeNull()
    expect(detail.snapshot.paramSchema).toBeNull()
    expect(detail.snapshot.paramValues).toBeNull()
    expect(detail.snapshot.schemaVersion).toBeNull()
  })

  it('derives detail pnl and equity from position data when account aggregates are stale', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-stale',
        name: 'Stale account aggregates',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-stale',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-stale',
        baseCurrency: 'USDT',
        initialBalance: 1000,
        balance: 930,
        equity: 930,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([
        {
          openedAt: new Date('2026-03-20T10:30:00.000Z'),
          closedAt: new Date('2026-03-20T11:00:00.000Z'),
          realizedPnl: 10,
        },
      ]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 3, closedCount: 1, winningCount: 1 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 1, closedCount: 1 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 80,
        totalUnrealizedPnl: 5,
        totalRealizedPnl: 10,
      }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-stale')

    expect(detail.totalPnl).toBe(15)
    expect(detail.metrics.returnPct).toBe(1.5)
    expect(detail.accountOverview).toEqual({
      initialBalance: 1000,
      totalEquity: 1015,
      availableBalance: 930,
      totalPnl: 15,
      todayPnl: 5,
      baseCurrency: 'USDT',
    })
    expect(detail.positionOverview).toEqual({
      openPositionsCount: 1,
      closedPositionsCount: 1,
      totalRealizedPnl: 10,
      totalUnrealizedPnl: 5,
    })
    expect(detail.equitySeries.at(-1)).toEqual(expect.objectContaining({ value: 1015 }))
  })

  it('derives available balance and equity from position state when historical account balance is stale', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-closed',
        name: 'Closed strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-closed',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-closed',
        baseCurrency: 'USDT',
        initialBalance: 1000,
        balance: 810.0686,
        equity: 810.0686,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([
        {
          openedAt: new Date('2026-03-20T10:30:00.000Z'),
          closedAt: new Date('2026-03-20T11:00:00.000Z'),
          realizedPnl: 0,
        },
      ]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 2, closedCount: 1, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 1 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-closed')

    expect(detail.accountOverview).toEqual({
      initialBalance: 1000,
      totalEquity: 1000,
      availableBalance: 1000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    })
    expect(detail.equitySeries.at(-1)).toEqual(expect.objectContaining({ value: 1000 }))
  })

  it('revalues open positions from latest market quotes when stored unrealized pnl is stale', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-live',
        name: 'Live strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-live',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-live',
        baseCurrency: 'USDT',
        initialBalance: 1000,
        balance: 919.760815,
        equity: 1000,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 1, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 1, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 80.239185,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([{
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        quantity: 0.00117,
        avgEntryPrice: 68580.5,
        unrealizedPnl: 0,
      }]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const marketDataReadGateway = {
      getLatestQuote: jest.fn().mockResolvedValue({ lastPrice: '68535.5' }),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      marketDataReadGateway as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-live')

    expect(detail.positionOverview).toEqual({
      openPositionsCount: 1,
      closedPositionsCount: 0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: -0.05265,
    })
    expect(detail.accountOverview).toEqual({
      initialBalance: 1000,
      totalEquity: 999.94735,
      availableBalance: 919.760815,
      totalPnl: -0.05265,
      todayPnl: -0.05265,
      baseCurrency: 'USDT',
    })
    expect(detail.equitySeries.at(-1)).toEqual(expect.objectContaining({ value: 999.94735 }))
  })

  it('preserves account pnl aggregates when position financials are empty snapshots', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-aggregate',
        name: 'Aggregate strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'binance' },
        strategyTemplateId: 'tpl-aggregate',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-aggregate',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10320.12,
        equity: 10320.12,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: 20.12,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-aggregate')

    expect(detail.totalPnl).toBe(320.12)
    expect(detail.accountOverview).toEqual({
      initialBalance: 10000,
      totalEquity: 10320.12,
      availableBalance: 10300,
      totalPnl: 320.12,
      todayPnl: 20.12,
      baseCurrency: 'USDT',
    })
    expect(detail.positionOverview).toEqual({
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 300,
      totalUnrealizedPnl: 20.12,
    })
  })

  it('derives today pnl from the latest daily equity start when available', async () => {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-today',
        name: 'Daily pnl strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'binance' },
        strategyTemplateId: 'tpl-today',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-today',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10300,
        equity: 10320.12,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: 20.12,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([
        {
          date: todayStart,
          equityStart: 10000,
          equityEnd: 9450,
        },
      ]),
      loadLatestDailySnapshot: jest.fn().mockResolvedValue({
        date: todayStart,
        equityStart: 10000,
        equityEnd: 9450,
      }),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 20.12,
        totalRealizedPnl: 300,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-today')

    expect(detail.todayPnl).toBe(320.12)
    expect(detail.accountOverview?.todayPnl).toBe(320.12)
  })

  it('falls back per field when empty position financials only conflict with one account aggregate side', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-partial-aggregate',
        name: 'Partial aggregate strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'binance' },
        strategyTemplateId: 'tpl-partial-aggregate',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-partial-aggregate',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10300,
        equity: 10300,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: null,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-partial-aggregate')

    expect(detail.totalPnl).toBe(300)
    expect(detail.positionOverview).toEqual({
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 300,
      totalUnrealizedPnl: 0,
    })
  })

  it('still prefers exchange balances when only flat daily snapshots exist locally', async () => {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-exchange-flat-daily',
        name: 'Exchange-first strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'okx' },
        strategyTemplateId: 'tpl-exchange-flat-daily',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          exchangeAccount: { id: 'exchange-account-1', name: 'OKX 模拟盘', exchangeId: 'okx' },
        }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-exchange-flat-daily',
        baseCurrency: 'USDT',
        initialBalance: 1000,
        balance: 1000,
        equity: 1000,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([
        {
          date: todayStart,
          equityStart: 1000,
          equityEnd: 1000,
          realizedPnl: 0,
          unrealizedPnl: 0,
        },
      ]),
      loadLatestDailySnapshot: jest.fn().mockResolvedValue({
        date: todayStart,
        equityStart: 1000,
        equityEnd: 1000,
      }),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 58000, locked: 2000, total: 60000 },
      ]),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-exchange-flat-daily')

    expect(detail.accountOverview).toEqual({
      initialBalance: 60000,
      totalEquity: 60000,
      availableBalance: 58000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    })
  })

  it('falls back to intraday realized plus unrealized pnl when the latest daily snapshot is stale', async () => {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-stale-daily',
        name: 'Stale daily pnl strategy',
        status: 'running',
        createdBy: 'user-1',
        params: { symbol: 'BTCUSDT', exchange: 'binance' },
        strategyTemplateId: 'tpl-stale-daily',
        strategyTemplate: {
          defaultParams: { timeframe: '15m' },
        },
        subscriptions: [{ userId: 'user-1', status: 'active', customParams: {} }],
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-stale-daily',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10300,
        equity: 10320.12,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: 20.12,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([
        {
          date: yesterdayStart,
          equityStart: 10000,
          equityEnd: 10300,
        },
      ]),
      loadLatestDailySnapshot: jest.fn().mockResolvedValue({
        date: yesterdayStart,
        equityStart: 10000,
        equityEnd: 10300,
      }),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalUnrealizedPnl: 20.12,
        totalRealizedPnl: 300,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue(null),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    const detail = await service.getStrategyDetail('user-1', 'inst-stale-daily')

    expect(detail.todayPnl).toBe(20.12)
    expect(detail.accountOverview?.todayPnl).toBe(20.12)
  })

  it('removes deployment leverage semantics from spot strategy detail responses', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-spot-1',
        name: 'Spot strategy',
        status: 'running',
        createdBy: 'user-1',
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'snapshot-spot-1',
          snapshotHash: 'snapshot-hash-spot-1',
        },
        params: { exchange: 'okx', symbol: 'ETHUSDT', timeframe: '15m', positionPct: 10, marketType: 'spot' },
        strategyTemplateId: 'tpl-spot-1',
        strategyTemplate: {
          defaultParams: {},
          paramsSchema: null,
          rulesVersion: 1,
        },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: {},
          subscribedAt: new Date('2026-04-18T13:38:30.553Z'),
          exchangeAccount: { id: 'acct-spot-1', name: 'OKX Demo', exchangeId: 'okx' },
        }],
        startedAt: new Date('2026-04-18T13:38:30.541Z'),
        updatedAt: new Date('2026-04-18T13:38:30.543Z'),
        updatedBy: 'user-1',
        deploymentExecutionConfig: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'gtc',
        },
        executionConfigVersion: 1,
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-spot-1',
        initialBalance: 56254.09959300132,
        equity: 56254.09959300132,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
        baseCurrency: 'USDT',
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadLatestDailySnapshot: jest.fn().mockResolvedValue(null),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadOpenPositionsForValuation: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadPositionOverview: jest.fn().mockResolvedValue({ openCount: 0, closedCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-04-18T13:37:28.984Z'),
          startedAt: new Date('2026-04-18T13:38:30.541Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-04-18T13:38:30.553Z') },
        signalExecutions: [],
        trades: [],
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      { getLeverageConstraints: jest.fn() } as any,
      {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-spot-1',
          snapshotHash: 'snapshot-hash-spot-1',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'ETHUSDT',
            baseTimeframe: '15m',
            marketType: 'spot',
            positionPct: 10,
          },
          backtestConfigDefaults: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
          deploymentExecutionDefaults: {
            leverage: 1,
            priceSource: 'close',
            orderType: 'market',
            timeInForce: 'gtc',
          },
          deploymentExecutionConstraints: {
            defaultLeverage: 1,
            supportedOrderTypes: ['market'],
            supportedTimeInForce: ['gtc'],
            supportedPriceSources: ['close'],
            platformRiskMaxLeverage: 1,
            constraintExplanation: 'strategy/default constraints pending account-capability intersection',
          },
          paramsSnapshot: {
            symbol: 'ETHUSDT',
            exchange: 'okx',
            timeframe: '15m',
            marketType: 'spot',
            positionPct: 10,
          },
          strategyTemplateId: 'tpl-spot-1',
          strategyInstanceId: 'inst-spot-1',
        }),
      } as any,
    )

    const detail = await service.getStrategyDetail('user-1', 'inst-spot-1')

    expect(detail.snapshot.deploymentExecutionBaseline).toEqual({
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'gtc',
    })
    expect(detail.snapshot.deploymentExecutionCurrent).toEqual({
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'gtc',
    })
    expect(detail.snapshot.deploymentExecutionConstraints).toEqual({
      supportedOrderTypes: ['market'],
      supportedTimeInForce: ['gtc'],
      supportedPriceSources: ['close'],
      constraintExplanation: 'strategy/default constraints pending account-capability intersection',
    })
    expect(detail.snapshot.effectiveAllowedLeverageRange).toBeNull()
    expect(detail.deployment).toEqual(expect.objectContaining({
      executionConfig: {
        leverage: null,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      effectiveAllowedLeverageRange: null,
    }))
  })
})
