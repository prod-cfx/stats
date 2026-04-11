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

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: { userId: 'user-1' },
    isLoading: false,
  }),
}))

jest.mock('@/components/account/AiQuantStrategyDetail', () => ({
  AiQuantStrategyDetail: ({ onRunBacktest, backtestError }: { onRunBacktest?: () => void; backtestError?: string | null }) => (
    <div>
      <button data-testid="run-backtest" onClick={onRunBacktest}>run</button>
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
  isBacktestPayloadBuilderError: () => false,
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
        backtestInitialCash: 20000,
        backtestLeverage: 2,
        backtestSlippageBps: 8,
        backtestFeeBps: 3,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      schemaVersion: null,
      supportsDynamicParams: false,
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      updatedAt: '2026-04-10T00:00:00.000Z',
    })
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
    mockBuildBacktestPayload.mockReturnValue({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
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

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
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
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        stateTimeframes: ['15m'],
        strategy: {
          id: 'inst-1',
          publishedSnapshotId: 'snapshot-1',
        },
      }),
    )
    expect(mockCreateBacktestJob).toHaveBeenCalledWith(mockBuildBacktestPayload.mock.results[0]?.value)
    expect(mockPush).toHaveBeenCalledWith(
      '/zh/ai-quant/backtest/job-1?symbol=BTCUSDT&startAt=2026-04-03T00%3A00%3A00.000Z&endAt=2026-04-10T00%3A00%3A00.000Z',
    )
    expect(mockGetBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-error"]')?.textContent).toBe('')
  })
})
