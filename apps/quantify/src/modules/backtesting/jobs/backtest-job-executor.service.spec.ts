import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { BacktestJobExecutorService } from './backtest-job-executor.service'

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
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '5m',
      },
      snapshotId: 'snapshot-1',
      fn: () => ({ type: 'NOOP' }),
    } as BacktestRunInput['strategy'],
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
    conversationId: 'conv-1',
  }
}

function createInputSummary() {
  return {
    symbols: ['BTCUSDT'],
    baseTimeframe: '5m' as const,
    stateTimeframes: ['1h'],
    initialCash: 10000,
    leverage: 2,
    marketType: 'spot' as const,
    dataRange: { fromTs: 1, toTs: 2 },
    requestedRange: { fromTs: 1, toTs: 2 },
    allowPartial: false,
    isPartial: false,
    strategyId: 's1',
    conversationId: 'conv-1',
    publishedSnapshotId: 'snapshot-1',
    snapshotId: 'snapshot-1',
  }
}

function createMarketDataMock() {
  return {
    prepareData: jest.fn().mockResolvedValue(undefined),
    resolveCoverage: jest.fn().mockResolvedValue({
      kind: 'full',
      availableRange: { fromTs: 1, toTs: 2 },
      appliedRange: { fromTs: 1, toTs: 2 },
    }),
    loadBars: jest.fn().mockResolvedValue([{ symbol: 'BTCUSDT', close: 100 }]),
  }
}

describe('BacktestJobExecutorService', () => {
  it('runs persisted job and marks it succeeded', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: 'conv-1', status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue({ id: 'job-1', status: 'succeeded' }),
      markFailed: jest.fn(),
    }
    const marketData = createMarketDataMock()
    const runner = { run: jest.fn().mockResolvedValue({
      summary: {
        netProfitPct: 12,
        maxDrawdownPct: 8,
        winRate: 0.6,
        totalTrades: 1,
      },
    }) }
    const conversations = { updateLastBacktestRef: jest.fn().mockResolvedValue(undefined) }
    const executor = new BacktestJobExecutorService(
      runner as never,
      marketData as never,
      conversations as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(repository.markRunning).toHaveBeenCalledWith('job-1', expect.any(Date))
    expect(marketData.prepareData).toHaveBeenCalledWith(expect.objectContaining({ symbols: ['BTCUSDT'] }))
    expect(repository.markSucceeded).toHaveBeenCalledWith('job-1', expect.objectContaining({
      result: expect.objectContaining({ summary: expect.objectContaining({ totalTrades: 1 }) }),
      finishedAt: expect.any(Date),
    }))
    expect(conversations.updateLastBacktestRef).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      userId: 'user-1',
    }))
  })

  it('skips execution when job was already consumed', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue(null),
      markSucceeded: jest.fn(),
      markFailed: jest.fn(),
    }
    const runner = { run: jest.fn() }
    const executor = new BacktestJobExecutorService(
      runner as never,
      createMarketDataMock() as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(runner.run).not.toHaveBeenCalled()
    expect(repository.markSucceeded).not.toHaveBeenCalled()
  })

  it('marks job failed with domain error details', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: 'conv-1', status: 'running' }),
      markSucceeded: jest.fn(),
      markFailed: jest.fn().mockResolvedValue(undefined),
    }
    const marketData = createMarketDataMock()
    marketData.resolveCoverage.mockResolvedValue({ kind: 'empty', appliedRange: null })
    const executor = new BacktestJobExecutorService(
      { run: jest.fn() } as never,
      marketData as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(repository.markFailed).toHaveBeenCalledWith('job-1', expect.objectContaining({
      code: 'backtest.market_data_empty',
      message: 'backtest.market_data_empty',
      finishedAt: expect.any(Date),
    }))
  })

  it('adds diagnostic reason to zero-trade results', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: null, status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const executor = new BacktestJobExecutorService(
      { run: jest.fn().mockResolvedValue({ summary: { totalTrades: 0 }, diagnostics: { compiledRulesCount: 0, signalTriggerCount: 0, fillCount: 0 }, equityCurve: [], trades: [], markers: [], bySymbol: [] }) } as never,
      createMarketDataMock() as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(repository.markSucceeded).toHaveBeenCalledWith('job-1', expect.objectContaining({
      result: expect.objectContaining({
        summary: expect.objectContaining({
          diagnosticReason: ErrorCode.BACKTEST_NO_RULES_COMPILED,
        }),
      }),
    }))
  })

  it('does not add diagnostic reason when result has an open trade', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: null, status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const executor = new BacktestJobExecutorService(
      { run: jest.fn().mockResolvedValue({ summary: { totalTrades: 0, totalOpenTrades: 1 }, diagnostics: { compiledRulesCount: 1, signalTriggerCount: 1, fillCount: 0 }, equityCurve: [], trades: [], markers: [], bySymbol: [], openPositions: [{ symbol: 'BTCUSDT:PERP', qty: 1, avgEntryPrice: 100, unrealizedPnl: 0 }] }) } as never,
      createMarketDataMock() as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(repository.markSucceeded).toHaveBeenCalledWith('job-1', expect.objectContaining({
      result: expect.objectContaining({
        summary: expect.not.objectContaining({ diagnosticReason: expect.any(String) }),
      }),
    }))
  })

  it('persists diagnosticReason in lastBacktestRef for snapshot-bound live-only webhook runs', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: 'conv-1', status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const conversations = { updateLastBacktestRef: jest.fn().mockResolvedValue(undefined) }
    const executor = new BacktestJobExecutorService(
      { run: jest.fn().mockResolvedValue({
        summary: {
          netProfit: 0,
          netProfitPct: 0,
          maxDrawdownPct: 0,
          winRate: 0,
          profitFactor: null,
          totalTrades: 0,
          diagnosticReason: ErrorCode.BACKTEST_EVENT_STREAM_UNAVAILABLE,
        },
        diagnostics: {
          compiledRulesCount: 2,
          signalTriggerCount: 1,
          fillCount: 0,
          dataRequirementMissingCount: 0,
          eventStreamMissingCount: 1,
        },
        equityCurve: [],
        trades: [],
        markers: [],
        bySymbol: [],
      }) } as never,
      createMarketDataMock() as never,
      conversations as never,
      repository as never,
    )

    await executor.execute('job-1', createInput(), createInputSummary())

    expect(conversations.updateLastBacktestRef).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      userId: 'user-1',
      lastBacktestRef: expect.objectContaining({
        publishedSnapshotId: 'snapshot-1',
        summary: expect.objectContaining({
          tradeCount: 0,
          diagnosticReason: ErrorCode.BACKTEST_EVENT_STREAM_UNAVAILABLE,
        }),
      }),
    }))
  })

  it('hydrates orderbook and open interest event streams for upgraded atom backtests', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: null, status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const input = createInput()
    input.dataRange = { fromTs: 1_000, toTs: 2_000 }
    input.strategy = {
      ...input.strategy,
      astSnapshot: {
        exprPool: [
          { id: 'expr_orderbook', nodeType: 'predicate', payload: { kind: 'orderbookImbalance', params: { sourceFeedId: 'orderbook.imbalance' } } },
          { id: 'expr_oi', nodeType: 'predicate', payload: { kind: 'openInterestCondition', params: { sourceFeedId: 'open_interest' } } },
        ],
      },
    } as BacktestRunInput['strategy']
    const marketData = createMarketDataMock()
    marketData.resolveCoverage.mockResolvedValue({ kind: 'full', availableRange: { fromTs: 1_000, toTs: 2_000 }, appliedRange: { fromTs: 1_000, toTs: 2_000 } })
    const runner = { run: jest.fn().mockResolvedValue({ summary: { totalTrades: 0 }, equityCurve: [], trades: [], markers: [], bySymbol: [] }) }
    const okxMarketDataProvider = {
      fetchOrderbookImbalanceEvents: jest.fn().mockResolvedValue([{ id: 'book-1', ts: 1_900, payload: { bidDepth: 3, askDepth: 2 } }]),
      fetchOpenInterestEvents: jest.fn().mockResolvedValue([{ id: 'oi-1', ts: 1_900, payload: { openInterest: 123 } }]),
    }
    const executor = new BacktestJobExecutorService(
      runner as never,
      marketData as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
      okxMarketDataProvider as never,
    )

    await executor.execute('job-1', input, createInputSummary())

    expect(okxMarketDataProvider.fetchOrderbookImbalanceEvents).toHaveBeenCalledWith({ symbol: 'BTCUSDT', startMs: 1_000, endMs: 2_000 })
    expect(okxMarketDataProvider.fetchOpenInterestEvents).toHaveBeenCalledWith({ symbol: 'BTCUSDT', startMs: 1_000, endMs: 2_000 })
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      eventStreams: {
        'orderbook.imbalance': [{ id: 'book-1', ts: 1_900, payload: { bidDepth: 3, askDepth: 2 } }],
        open_interest: [{ id: 'oi-1', ts: 1_900, payload: { openInterest: 123 } }],
      },
    }))
  })

  it('hydrates webhook event streams from accepted historical signal events', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: null, status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const input = createInput()
    input.dataRange = { fromTs: 1_000, toTs: 2_000 }
    input.strategy = {
      ...input.strategy,
      strategyInstanceId: 'instance-1',
      astSnapshot: {
        exprPool: [
          {
            id: 'expr_webhook_buy',
            nodeType: 'predicate',
            payload: {
              kind: 'externalSignal',
              params: { provider: 'webhook', signalId: 'TradingView webhook buy', sourceFeedId: 'webhook.TradingView webhook buy', ttlMs: 60_000 },
            },
          },
        ],
      },
    } as BacktestRunInput['strategy']
    const marketData = createMarketDataMock()
    marketData.resolveCoverage.mockResolvedValue({ kind: 'full', availableRange: { fromTs: 1_000, toTs: 2_000 }, appliedRange: { fromTs: 1_000, toTs: 2_000 } })
    const runner = { run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 }, equityCurve: [], trades: [], markers: [], bySymbol: [] }) }
    const signalGeneratorRepository = {
      findActiveWebhookSignalSubscriptions: jest.fn().mockResolvedValue([{ signalId: 'TradingView webhook buy' }]),
      findAcceptedWebhookRuntimeEvents: jest.fn().mockResolvedValue([
        {
          id: 'evt-1',
          signalId: 'TradingView webhook buy',
          payload: { side: 'buy' },
          receivedAt: new Date(1_800),
          sourceTimestamp: new Date(1_700),
        },
      ]),
    }
    const executor = new BacktestJobExecutorService(
      runner as never,
      marketData as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
      undefined,
      signalGeneratorRepository as never,
    )

    await executor.execute('job-1', input, createInputSummary())

    expect(signalGeneratorRepository.findActiveWebhookSignalSubscriptions).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      signalIds: ['TradingView webhook buy'],
    })
    expect(signalGeneratorRepository.findAcceptedWebhookRuntimeEvents).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      signalIds: ['TradingView webhook buy'],
      since: new Date(1_000),
      until: new Date(2_000),
    })
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      eventStreams: {
        'webhook.TradingView webhook buy': [
          { id: 'evt-1', ts: 1_700, payload: { side: 'buy', signalId: 'TradingView webhook buy' } },
        ],
      },
    }))
  })

  it('injects synthetic webhook history when no accepted webhook events exist for backtest', async () => {
    const repository = {
      markRunning: jest.fn().mockResolvedValue({ id: 'job-1', ownerUserId: 'user-1', conversationId: null, status: 'running' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    }
    const input = createInput()
    input.dataRange = { fromTs: 1_000, toTs: 4_000 }
    input.strategy = {
      ...input.strategy,
      strategyInstanceId: 'instance-1',
      astSnapshot: {
        exprPool: [
          {
            id: 'expr_webhook_buy',
            nodeType: 'predicate',
            payload: {
              kind: 'externalSignal',
              params: { provider: 'webhook', signalId: 'TradingView webhook buy', sourceFeedId: 'webhook.TradingView webhook buy', ttlMs: 60_000 },
            },
          },
        ],
      },
    } as BacktestRunInput['strategy']
    const marketData = createMarketDataMock()
    marketData.resolveCoverage.mockResolvedValue({ kind: 'full', availableRange: { fromTs: 1_000, toTs: 4_000 }, appliedRange: { fromTs: 1_000, toTs: 4_000 } })
    const runner = { run: jest.fn().mockResolvedValue({ summary: { totalTrades: 1 }, equityCurve: [], trades: [], markers: [], bySymbol: [] }) }
    const signalGeneratorRepository = {
      findActiveWebhookSignalSubscriptions: jest.fn().mockResolvedValue([]),
      findAcceptedWebhookRuntimeEvents: jest.fn().mockResolvedValue([]),
    }
    const executor = new BacktestJobExecutorService(
      runner as never,
      marketData as never,
      { updateLastBacktestRef: jest.fn() } as never,
      repository as never,
      undefined,
      signalGeneratorRepository as never,
    )

    await executor.execute('job-1', input, createInputSummary())

    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      eventStreams: {
        'webhook.TradingView webhook buy': expect.arrayContaining([
          expect.objectContaining({ payload: expect.objectContaining({ signalId: 'TradingView webhook buy', side: 'buy' }) }),
        ]),
      },
    }))
  })
})
