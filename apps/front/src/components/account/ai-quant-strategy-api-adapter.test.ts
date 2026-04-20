import { mapAccountStrategyDetailToRecord, mapAccountStrategyListItemToRecord } from './ai-quant-strategy-api-adapter'

describe('ai-quant-strategy-api-adapter', () => {
  it('maps list item status and metrics with safe normalization', () => {
    const record = mapAccountStrategyListItemToRecord({
      id: 'inst-1',
      name: 'test strategy',
      status: 'paused' as any,
      exchange: 'unknown' as any,
      symbol: null,
      timeframe: null,
      positionPct: Number.NaN,
      isSubscribed: false,
      paramSchema: {
        type: 'object',
        properties: {
          threshold: { type: 'number' },
        },
      },
      paramValues: {
        threshold: 0.25,
      },
      schemaVersion: 'v1',
      metrics: {
        returnPct: Number.NaN,
        maxDrawdownPct: undefined as any,
        winRatePct: null as any,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
    } as any)

    expect(record.status).toBe('stopped')
    expect(record.exchange).toBe('binance')
    expect(record.symbol).toBe('--')
    expect(record.timeframe).toBe('--')
    expect(record.positionPct).toBe(0)
    expect(record.metrics).toEqual({
      returnPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    })
    expect(record.paramSchema).toEqual({
      type: 'object',
      properties: {
        threshold: { type: 'number' },
      },
    })
    expect(record.paramValues).toEqual({ threshold: 0.25 })
    expect(record.schemaVersion).toBe('v1')
    expect(record.supportsDynamicParams).toBe(true)
  })

  it('enforces dynamic param contract when schema is missing', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-2',
      name: 'detail strategy',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 12.5,
        maxDrawdownPct: 6.3,
        winRatePct: 50.1,
        tradeCount: 12,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: null,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        publishedSnapshotId: 'snapshot-2',
        snapshotHash: 'snapshot-hash-2',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: {
          leverage: 3,
        },
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10120,
        availableBalance: 9800,
        totalPnl: 120,
        todayPnl: 20,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 1,
        closedPositionsCount: 3,
        totalRealizedPnl: 100,
        totalUnrealizedPnl: 20,
      },
      latestOrders: [{
        executedAt: '2026-03-20T01:00:00.000Z',
        side: 'BUY',
        symbol: 'BTCUSDT',
        price: 68000,
        quantity: 0.01,
        fee: 0.2,
        feeCurrency: 'USDT',
        orderId: 'ord-1',
      }],
      timeline: [],
    } as any)

    expect(record.totalPnl).toBe(0)
    expect(record.todayPnl).toBeNull()
    expect(record.accountOverview).toEqual({
      initialBalance: 10000,
      totalEquity: 10120,
      availableBalance: 9800,
      totalPnl: 120,
      todayPnl: 20,
      baseCurrency: 'USDT',
    })
    expect(record.positionOverview).toEqual({
      openPositionsCount: 1,
      closedPositionsCount: 3,
      totalRealizedPnl: 100,
      totalUnrealizedPnl: 20,
    })
    expect(record.latestOrders).toHaveLength(1)
    expect(record.latestOrders[0]?.orderId).toBe('ord-1')
    expect(record.status).toBe('running')
    expect(record.exchange).toBe('okx')
    expect(record.publishedSnapshotId).toBe('snapshot-2')
    expect(record.snapshotHash).toBe('snapshot-hash-2')
    expect(record.paramSchema).toBeNull()
    expect(record.paramValues).toBeNull()
    expect(record.schemaVersion).toBeNull()
    expect(record.supportsDynamicParams).toBe(false)
  })

  it('keeps snapshot backtest state timeframes when present', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-state-timeframes',
      name: 'detail strategy',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '3m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 12.5,
        maxDrawdownPct: 6.3,
        winRatePct: 50.1,
        tradeCount: 12,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: null,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '3m',
        positionPct: 10,
        publishedSnapshotId: 'snapshot-2',
        snapshotHash: 'snapshot-hash-2',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: {
          leverage: 3,
        },
        schemaVersion: null,
        backtestConfigDefaults: {
          initialCash: 20000,
          leverage: 2,
          slippageBps: 8,
          feeBps: 3,
          priceSource: 'close',
          allowPartial: true,
          stateTimeframes: ['15m', ' 1h ', '', 42 as never],
        },
      },
      timeline: [],
    } as any)

    expect(record.snapshotBacktestConfigDefaults).toEqual({
      initialCash: 20000,
      leverage: 2,
      slippageBps: 8,
      feeBps: 3,
      priceSource: 'close',
      allowPartial: true,
      stateTimeframes: ['15m', '1h'],
    })
  })

  it('normalizes paramValues to empty object when schema exists but values are absent', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-3',
      name: 'detail strategy 2',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 20,
      isSubscribed: true,
      metrics: {
        returnPct: 1,
        maxDrawdownPct: 2,
        winRatePct: 3,
        tradeCount: 4,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 1,
      todayPnl: 1,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '5m',
        positionPct: 20,
        deployAccountName: null,
        deployAt: null,
        paramSchema: {
          type: 'object',
          properties: {
            leverage: { type: 'number' },
          },
        },
        paramValues: undefined as any,
        schemaVersion: 'v2',
      },
      timeline: [],
    } as any)

    expect(record.paramSchema).toEqual({
      type: 'object',
      properties: {
        leverage: { type: 'number' },
      },
    })
    expect(record.paramValues).toEqual({})
    expect(record.schemaVersion).toBe('v2')
    expect(record.supportsDynamicParams).toBe(true)
  })

  it('derives detail initialCapital from account overview initial balance when available', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-4',
      name: 'detail strategy 3',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 60000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 60000,
        totalEquity: 60000,
        availableBalance: 60000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      timeline: [],
      latestOrders: [],
    } as any)

    expect(record.initialCapital).toBe(60000)
  })

  it('prefers snapshot-truth display fields over drifted live fields', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-snapshot',
      name: 'snapshot detail',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 5,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 12,
        publishedSnapshotId: 'snapshot-9',
        snapshotHash: 'snapshot-hash-9',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10000,
        availableBalance: 10000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 0,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      },
      latestOrders: [],
      timeline: [],
    } as any)

    expect(record.exchange).toBe('binance')
    expect(record.symbol).toBe('BTCUSDT')
    expect(record.timeframe).toBe('15m')
    expect(record.positionPct).toBe(12)
  })

  it('maps truthful snapshot baseline, deployment current truth, and compatibility metadata', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-backtest-snapshot',
      name: 'snapshot backtest detail',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 5,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      paramSchema: {
        type: 'object',
        properties: {
          backtestInitialCash: { type: 'number' },
        },
      },
      paramValues: {
        backtestInitialCash: 99999,
        backtestLeverage: 8,
      },
      snapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 12,
        publishedSnapshotId: 'snapshot-10',
        snapshotHash: 'snapshot-hash-10',
        deployAccountName: null,
        deployAt: null,
        paramSchema: {
          type: 'object',
          properties: {
            backtestInitialCash: { type: 'number' },
            backtestLeverage: { type: 'number' },
          },
        },
        paramValues: {
          backtestInitialCash: 15000,
          backtestLeverage: 2,
          backtestSlippageBps: 9,
          backtestFeeBps: 4,
          backtestPriceSource: 'mid',
          backtestAllowPartial: false,
        },
        schemaVersion: 'v2',
        strategyConfig: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          baseTimeframe: '15m',
          positionPct: 12,
          strategyDeclaredLeverageRange: {
            min: 1,
            max: 5,
          },
        },
        backtestConfigDefaults: {
          initialCash: 15000,
          leverage: 2,
          slippageBps: 9,
          feeBps: 4,
          priceSource: 'mid',
          allowPartial: false,
        },
        deploymentExecutionBaseline: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        deploymentExecutionCurrent: {
          leverage: 4,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        executionConfigVersion: 3,
        compatibilityMetadata: {
          isLegacySnapshot: false,
          missingBacktestConfigDefaults: false,
          missingDeploymentExecutionDefaults: false,
          missingDeploymentExecutionConstraints: false,
          requiresRepublishForBacktest: false,
          requiresRepublishForDeploy: false,
        },
        consistencySummary: {
          isConsistent: false,
          driftReasons: ['leverage drift'],
        },
        deploymentExecutionConstraints: {
          effectiveAllowedLeverageRange: {
            min: 1,
            max: 5,
          },
          exchangeAccountCapabilityMaxLeverage: 10,
          platformRiskMaxLeverage: 5,
          strategyDeclaredLeverageRange: {
            min: 1,
            max: 5,
          },
          constraintExplanation: '交易所支持到 10x，但平台风控和策略限制最终只允许 1-5x。',
        },
      },
      timeline: [],
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10000,
        availableBalance: 10000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 0,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      },
      latestOrders: [],
    } as any)

    expect(record.snapshotBacktestConfigDefaults).toEqual({
      initialCash: 15000,
      leverage: 2,
      slippageBps: 9,
      feeBps: 4,
      priceSource: 'mid',
      allowPartial: false,
      stateTimeframes: [],
    })
    expect(record.deploymentExecutionBaseline).toEqual({
      leverage: 2,
      priceSource: 'mark',
      orderType: 'market',
      timeInForce: 'IOC',
    })
    expect(record.deploymentExecutionCurrent).toEqual({
      leverage: 4,
      priceSource: 'mark',
      orderType: 'market',
      timeInForce: 'IOC',
    })
    expect(record.executionConfigVersion).toBe(3)
    expect(record.compatibilityMetadata).toEqual({
      isLegacySnapshot: false,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    })
    expect(record.consistencySummary).toEqual({
      isConsistent: false,
      driftReasons: ['leverage drift'],
      consistencyScore: null,
    })
    expect(record.deploymentLeverageRange).toEqual({
      min: 1,
      max: 5,
    })
    expect(record.deploymentConstraintExplanation).toContain('1-5x')
    expect(record.publishedSnapshotParamValues).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      baseTimeframe: '15m',
      positionPct: 12,
    })
  })

  it('disables leverage editing for spot deployments even when execution config exists', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-spot-snapshot',
      name: 'spot snapshot detail',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      paramSchema: null,
      paramValues: null,
      snapshot: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '15m',
        positionPct: 10,
        publishedSnapshotId: 'snapshot-spot-1',
        snapshotHash: 'snapshot-hash-spot-1',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: 'v2',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          marketType: 'spot',
          baseTimeframe: '15m',
          positionPct: 10,
        },
        backtestConfigDefaults: null,
        deploymentExecutionBaseline: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionCurrent: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        executionConfigVersion: 1,
        compatibilityMetadata: {
          isLegacySnapshot: false,
          missingBacktestConfigDefaults: false,
          missingDeploymentExecutionDefaults: false,
          missingDeploymentExecutionConstraints: false,
          requiresRepublishForBacktest: false,
          requiresRepublishForDeploy: false,
        },
        consistencySummary: {
          isConsistent: true,
          driftReasons: [],
        },
        deploymentExecutionConstraints: {
          effectiveAllowedLeverageRange: {
            min: 1,
            max: 1,
          },
          constraintExplanation: '现货固定为 1x。',
        },
      },
      timeline: [],
      accountOverview: null,
      positionOverview: null,
      latestOrders: [],
    } as any)

    expect(record.deploymentLeverageRange).toBeNull()
    expect(record.canEditDeploymentLeverage).toBe(false)
    expect(record.deploymentExecutionBaseline).toEqual({
      leverage: null,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'GTC',
    })
    expect(record.deploymentExecutionCurrent).toEqual({
      leverage: null,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'GTC',
    })
  })

  it('maps runtime execution states into the detail record and preserves empty legacy lists', () => {
    const populated = mapAccountStrategyDetailToRecord({
      id: 'inst-runtime-map',
      name: 'runtime detail',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 1,
        maxDrawdownPct: 2,
        winRatePct: 3,
        tradeCount: 4,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 1,
      todayPnl: 0,
      equitySeries: [],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        publishedSnapshotId: 'snapshot-runtime-1',
        snapshotHash: 'snapshot-hash-runtime-1',
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      timeline: [],
      runtimeExecutionStates: [{
        executionSemanticKey: 'on_start.entry.primary',
        status: 'failed',
        failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
        failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
        lastAttemptAt: '2026-03-20T10:03:00.000Z',
        consumedAt: null,
        cooldownUntil: null,
        publishedSnapshotId: 'snapshot-runtime-1',
        snapshotHash: 'snapshot-hash-runtime-1',
      }],
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10000,
        availableBalance: 10000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 0,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      },
      latestOrders: [],
    } as any)

    expect(populated.runtimeExecutionStates).toEqual([{
      executionSemanticKey: 'on_start.entry.primary',
      status: 'failed',
      failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      lastAttemptAt: '2026-03-20T10:03:00.000Z',
      consumedAt: null,
      cooldownUntil: null,
      publishedSnapshotId: 'snapshot-runtime-1',
      snapshotHash: 'snapshot-hash-runtime-1',
    }])

    const legacy = mapAccountStrategyDetailToRecord({
      id: 'inst-runtime-empty',
      name: 'legacy detail',
      status: 'stopped',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        publishedSnapshotId: null,
        snapshotHash: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      timeline: [],
      runtimeExecutionStates: [],
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10000,
        availableBalance: 10000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 0,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      },
      latestOrders: [],
    } as any)

    expect(legacy.runtimeExecutionStates).toEqual([])
  })

})
