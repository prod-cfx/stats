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
})
