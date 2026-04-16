/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StrategyDetailPageClient } from './StrategyDetailPageClient'

const mockPush = jest.fn()
const mockFetchDetail = jest.fn()
const mockMapDetailToRecord = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()
const mockBuildBacktestPayload = jest.fn()
const mockCheckBacktestSymbolSupport = jest.fn()
const mockCreateBacktestJob = jest.fn()
const mockGetBacktestJob = jest.fn()
const stableSession = { userId: 'user-1' }

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: stableSession,
    isLoading: false,
  }),
}))

jest.mock('@/components/account/AiQuantStrategyDetail', () => ({
  AiQuantStrategyDetail: ({
    onRunBacktest,
    backtestError,
  }: {
    onRunBacktest?: () => void
    backtestError?: string | null
  }) => (
    <div>
      <button data-testid="run-backtest" onClick={onRunBacktest}>
        run
      </button>
      <div data-testid="backtest-error">{backtestError ?? ''}</div>
    </div>
  ),
}))

jest.mock('@/lib/api', () => ({
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchDetail(...args),
}))

jest.mock('@/components/account/ai-quant-strategy-api-adapter', () => ({
  mapAccountStrategyDetailToRecord: (...args: unknown[]) => mockMapDetailToRecord(...args),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: (...args: unknown[]) => mockFetchBacktestCapabilities(...args),
}))

jest.mock('@/components/ai-quant/backtest-payload-builder', () => ({
  BacktestPayloadBuilderError: class BacktestPayloadBuilderError extends Error {
    constructor(public readonly code: string) {
      super(code)
      this.name = 'BacktestPayloadBuilderError'
    }
  },
  buildBacktestPayload: (...args: unknown[]) => mockBuildBacktestPayload(...args),
  isBacktestPayloadBuilderError: (value: unknown) =>
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { name?: string }).name === 'BacktestPayloadBuilderError',
}))

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: (...args: unknown[]) => mockCheckBacktestSymbolSupport(...args),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: (...args: unknown[]) => mockCreateBacktestJob(...args),
  getBacktestJob: (...args: unknown[]) => mockGetBacktestJob(...args),
}))

describe('StrategyDetailPageClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockPush.mockReset()
    mockFetchDetail.mockReset()
    mockMapDetailToRecord.mockReset()
    mockFetchBacktestCapabilities.mockReset()
    mockBuildBacktestPayload.mockReset()
    mockCheckBacktestSymbolSupport.mockReset()
    mockCreateBacktestJob.mockReset()
    mockGetBacktestJob.mockReset()

    mockFetchDetail.mockResolvedValue({ id: 'detail-1' })
    mockMapDetailToRecord.mockReturnValue({
      id: 'inst-1',
      name: 'Snapshot strategy',
      status: 'running',
      exchange: 'binance',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 12,
      initialCapital: 10000,
      metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
      equitySeries: [],
      timeline: [],
      paramSchema: null,
      paramValues: {
        backtestRangePreset: '7D',
        backtestInitialCash: 32000,
        backtestLeverage: 4,
        backtestSlippageBps: 13,
        backtestFeeBps: 7,
        backtestPriceSource: 'mid',
        backtestAllowPartial: false,
      },
      schemaVersion: null,
      supportsDynamicParams: false,
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '3m',
        positionPct: 12,
      },
      snapshotBacktestConfigDefaults: {
        initialCash: 20000,
        leverage: 2,
        slippageBps: 8,
        feeBps: 3,
        priceSource: 'close',
        allowPartial: true,
        stateTimeframes: ['15m'],
      },
      compatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
      snapshotHash: 'snapshot-hash-1',
      updatedAt: '2026-04-10T00:00:00.000Z',
    })
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['3m'],
    })
    mockBuildBacktestPayload.mockReturnValue({
      symbols: ['BTCUSDT'],
      baseTimeframe: '3m',
      stateTimeframes: ['15m'],
      initialCash: 20000,
      leverage: 2,
      execution: {
        slippageBps: 8,
        feeBps: 3,
        priceSource: 'close',
      },
      strategy: {
        id: 'inst-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
      },
      dataRange: {
        fromTs: Date.parse('2026-04-03T00:00:00.000Z'),
        toTs: Date.parse('2026-04-10T00:00:00.000Z'),
      },
      allowPartial: true,
    })
    mockCheckBacktestSymbolSupport.mockResolvedValue({ status: 'supported' })
    mockCreateBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'succeeded',
      createdAt: '2026-04-10T00:00:00.000Z',
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('runs snapshot-driven backtest from strategy detail without conversation defaults or mock ids', async () => {
    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        baseTimeframe: '3m',
        stateTimeframes: ['15m'],
        initialCash: 32000,
        leverage: 4,
        execution: {
          slippageBps: 13,
          feeBps: 7,
          priceSource: 'mid',
        },
        strategy: {
          id: 'inst-1',
          publishedSnapshotId: 'snapshot-1',
        },
      }),
    )
    expect(mockCreateBacktestJob).toHaveBeenCalledWith(
      mockBuildBacktestPayload.mock.results[0]?.value,
    )
    expect(mockPush).toHaveBeenCalledWith(
      '/zh/ai-quant/backtest/job-1?symbol=BTCUSDT&startAt=2026-04-03T00%3A00%3A00.000Z&endAt=2026-04-10T00%3A00%3A00.000Z',
    )
    expect(mockGetBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toBe('')
  })

  it('runs spot backtests from strategy detail without sending leverage', async () => {
    mockMapDetailToRecord.mockReturnValue({
      id: 'inst-spot',
      name: 'Spot strategy',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '3m',
      positionPct: 12,
      initialCapital: 10000,
      metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
      equitySeries: [],
      timeline: [],
      paramSchema: null,
      publishedSnapshotId: 'snapshot-spot',
      paramValues: {
        backtestRangePreset: '7D',
        backtestInitialCash: 18000,
        backtestSlippageBps: 9,
        backtestFeeBps: 2,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      schemaVersion: null,
      supportsDynamicParams: false,
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '3m',
        positionPct: 12,
      },
      snapshotBacktestConfigDefaults: {
        initialCash: 18000,
        leverage: null,
        slippageBps: 9,
        feeBps: 2,
        priceSource: 'close',
        allowPartial: true,
        stateTimeframes: ['15m'],
      },
      compatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
      updatedAt: '2026-04-10T00:00:00.000Z',
    })

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-spot" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        marketType: 'spot',
        initialCash: 18000,
        leverage: null,
      }),
    )
  })

  it('allows partial market-data coverage from strategy detail even when snapshot allowPartial is false', async () => {
    mockMapDetailToRecord.mockReturnValue({
      id: 'inst-1',
      name: 'Strategy 1',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '3m',
      positionPct: 12,
      metrics: {
        returnPct: 10,
        maxDrawdownPct: 5,
        winRatePct: 55,
        tradeCount: 12,
      },
      equitySeries: [],
      timeline: [],
      paramSchema: null,
      paramValues: {
        backtestRangePreset: '7D',
        backtestInitialCash: 20000,
        backtestLeverage: 2,
        backtestSlippageBps: 8,
        backtestFeeBps: 3,
        backtestPriceSource: 'close',
        backtestAllowPartial: false,
      },
      schemaVersion: null,
      supportsDynamicParams: false,
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '3m',
        positionPct: 12,
      },
      snapshotBacktestConfigDefaults: {
        initialCash: 20000,
        leverage: 2,
        slippageBps: 8,
        feeBps: 3,
        priceSource: 'close',
        allowPartial: false,
        stateTimeframes: ['15m'],
      },
      compatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
      snapshotHash: 'snapshot-hash-1',
      updatedAt: '2026-04-10T00:00:00.000Z',
    })

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        allowPartial: true,
      }),
    )
  })

  it('waits up to 180 seconds before timing out strategy-detail backtests', async () => {
    mockCreateBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'running',
      createdAt: '2026-04-10T00:00:00.000Z',
    })
    mockGetBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'running',
      createdAt: '2026-04-10T00:00:00.000Z',
    })

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(179000)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toBe('')

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toContain(
      '前端等待超时',
    )
    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toContain(
      'job-1',
    )
  })

  it('blocks legacy snapshot backtest and prompts republish when formal backtest truth is missing', async () => {
    mockMapDetailToRecord.mockReturnValue({
      id: 'inst-legacy',
      name: 'Legacy strategy',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 12,
      initialCapital: 10000,
      metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
      equitySeries: [],
      timeline: [],
      paramSchema: null,
      paramValues: {
        backtestRangePreset: '7D',
      },
      schemaVersion: null,
      supportsDynamicParams: false,
      publishedSnapshotId: 'snapshot-legacy',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 12,
      },
      snapshotBacktestConfigDefaults: null,
      compatibilityMetadata: {
        isLegacySnapshot: true,
        missingBacktestConfigDefaults: true,
        missingDeploymentExecutionDefaults: true,
        missingDeploymentExecutionConstraints: true,
        requiresRepublishForBacktest: true,
        requiresRepublishForDeploy: true,
      },
      snapshotHash: 'snapshot-hash-legacy',
      updatedAt: '2026-04-10T00:00:00.000Z',
    })

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-legacy" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockBuildBacktestPayload).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toContain(
      '重新发布',
    )
  })
})
