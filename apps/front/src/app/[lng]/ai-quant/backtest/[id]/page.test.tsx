import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import { fetchBacktestJobServer } from '@/lib/server-api'
import AiQuantBacktestDetailPage from './page'

jest.mock('@/lib/server-api', () => ({
  fetchBacktestJobServer: jest.fn(async () => null),
}))

const mockBacktestReportClient = jest.fn(
  ({
    symbol,
    marketType,
    rangeDisplay,
    metrics,
    partialCoverageNotice,
    reportContext,
  }: {
    symbol: string
    marketType?: 'spot' | 'perp'
    rangeDisplay: string
    metrics: {
      maxDrawdownPct: number
      totalReturnPct: number
      winRatePct: number
      tradeCount: number
      openTradeCount?: number
      openPnl?: number
    } | null
    partialCoverageNotice?: {
      requestedRange: string
      appliedRange: string
    } | null
    reportContext?: unknown
  }) => (
    <section>
      <div>{symbol}</div>
      <div>{marketType ?? 'spot'}</div>
      <div>{rangeDisplay}</div>
      <div>{metrics ? `${metrics.winRatePct}%` : '--'}</div>
      <div>{partialCoverageNotice?.appliedRange ?? 'full-range'}</div>
      <div>{JSON.stringify(reportContext ?? null)}</div>
    </section>
  ),
)

jest.mock('./BacktestReportClient', () => ({
  BacktestReportClient: (props: unknown) => mockBacktestReportClient(props as never),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer>footer</footer>,
}))

jest.mock('@/components/layout/Navbar', () => ({
  Navbar: () => <nav>navbar</nav>,
}))

const mockFetchBacktestJobServer = fetchBacktestJobServer as jest.MockedFunction<
  typeof fetchBacktestJobServer
>

function createThenable<T>(value: T) {
  let resolve!: () => void
  const promise = new Promise<T>(innerResolve => {
    resolve = () => innerResolve(value)
  })

  const then = jest.fn<Promise<T>['then']>((onFulfilled, onRejected) =>
    promise.then(onFulfilled, onRejected),
  )

  return {
    resolve,
    then,
    value: { then },
  }
}

describe('AiQuantBacktestDetailPage', () => {
  beforeEach(() => {
    mockFetchBacktestJobServer.mockResolvedValue(null)
    mockBacktestReportClient.mockClear()
  })

  it('renders symbol and historical range from searchParams', async () => {
    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1234' },
      searchParams: {
        symbol: 'ETHUSDT',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-02-01T00:00:00.000Z',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('ETHUSDT')
    expect(html).toContain('2026-01-01 ~ 2026-02-01')
  })

  it('falls back to dash when dates are invalid', async () => {
    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1234' },
      searchParams: {
        symbol: 'BTCUSDT',
        startAt: 'not-a-date',
        endAt: 'still-not-a-date',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('BTCUSDT')
    expect(html).toContain('<div>-</div>')
  })

  it('normalizes ratio winRate to percent display', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      resultSummary: {
        netProfit: 10,
        netProfitPct: 2,
        maxDrawdownPct: 3,
        winRate: 0.63,
        profitFactor: 1.1,
        totalTrades: 2,
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1001' },
      searchParams: {
        symbol: 'BTCUSDT',
        startAt: '2026-03-01T00:00:00.000Z',
        endAt: '2026-03-30T00:00:00.000Z',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('63%')
  })

  it('passes only summary metrics to BacktestReportClient without serializing report arrays', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      id: 'backtest-2002',
      status: 'succeeded',
      createdAt: '2026-03-25T00:00:00.000Z',
      resultSummary: {
        netProfit: 50,
        netProfitPct: 8.8,
        maxDrawdownPct: 5.2,
        winRate: 0.5,
        profitFactor: 1.4,
        totalTrades: 4,
        totalOpenTrades: 1,
        openPnl: 2.4851821235144986,
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-2002' },
      searchParams: {
        symbol: 'BTCUSDT',
      },
    })

    renderToStaticMarkup(element)

    const props = mockBacktestReportClient.mock.calls[0]?.[0] as Record<string, unknown>

    expect(props).toMatchObject({
      id: 'backtest-2002',
      marketType: 'spot',
      metrics: {
        maxDrawdownPct: 5.2,
        totalReturnPct: 8.8,
        winRatePct: 50,
        tradeCount: 4,
        openTradeCount: 1,
        openPnl: 2.49,
      },
    })
    expect(props).not.toHaveProperty('report')
  })

  it('passes job marketType through to BacktestReportClient', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      inputSummary: {
        marketType: 'perp',
      },
      resultSummary: {
        netProfit: 12,
        netProfitPct: 0.12,
        maxDrawdownPct: 0.45,
        winRate: 1,
        profitFactor: 1.4,
        totalTrades: 3,
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-4004' },
      searchParams: { symbol: 'BTCUSDT' },
    })

    renderToStaticMarkup(element)
    const props = mockBacktestReportClient.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(props).toMatchObject({ marketType: 'perp' })
  })

  it('normalizes derivative market aliases before rendering the report', async () => {
    for (const marketType of ['perpetual', 'futures', 'swap', 'delivery']) {
      mockBacktestReportClient.mockClear()
      mockFetchBacktestJobServer.mockResolvedValue({
        inputSummary: {
          marketType,
          symbols: ['ETHUSDT'],
        },
        resultSummary: {
          netProfit: 12,
          netProfitPct: 0.12,
          maxDrawdownPct: 0.45,
          winRate: 1,
          profitFactor: 1.4,
          totalTrades: 3,
        },
      })

      const element = await AiQuantBacktestDetailPage({
        params: { lng: 'zh', id: `backtest-${marketType}` },
        searchParams: {},
      })

      renderToStaticMarkup(element)
      const props = mockBacktestReportClient.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect(props).toMatchObject({
        marketType: 'perp',
        reportContext: {
          marketType: 'perp',
          symbol: 'ETHUSDT',
        },
      })
    }
  })

  it('passes normalized report context from inputSummary without tying it to OKX', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      id: 'backtest-context',
        inputSummary: {
          exchange: 'binance',
          marketType: 'perp',
          symbols: ['BTCUSDT'],
          baseTimeframe: '3m',
          strategyInstanceId: 'strategy-1',
          snapshotId: 'snapshot-1',
          conversationId: 'conversation-1',
          sessionId: 'session-1',
          initialCash: 10000,
          leverage: 5,
        allowPartial: false,
        requestedRange: {
          fromTs: Date.parse('2026-04-01T00:00:00.000Z'),
          toTs: Date.parse('2026-04-08T00:00:00.000Z'),
        },
        appliedRange: {
          fromTs: Date.parse('2026-04-01T00:00:00.000Z'),
          toTs: Date.parse('2026-04-08T00:00:00.000Z'),
        },
        isPartial: false,
        expectedBars: 3361,
        actualBars: 3361,
      },
      resultSummary: {
        netProfit: 12,
        netProfitPct: 0.12,
        maxDrawdownPct: 0.45,
        winRate: 1,
        profitFactor: 1.4,
        totalTrades: 3,
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'en', id: 'backtest-context' },
      searchParams: {},
    })

    renderToStaticMarkup(element)
    const props = mockBacktestReportClient.mock.calls.at(-1)?.[0] as Record<string, unknown>

    expect(props).toMatchObject({
      symbol: 'BTCUSDT',
      marketType: 'perp',
      reportContext: {
        exchange: 'binance',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        strategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        timeframe: '3m',
        requestedRange: '2026-04-01 00:00 UTC ~ 2026-04-08 00:00 UTC',
        appliedRange: '2026-04-01 00:00 UTC ~ 2026-04-08 00:00 UTC',
        dataCoverage: {
          isPartial: false,
          barCount: 3361,
          expectedBarCount: 3361,
        },
        execution: {
          initialCash: 10000,
          leverage: 5,
          allowPartial: false,
        },
      },
    })
  })

  it('passes partial coverage notice when the server marks the backtest as partial', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      id: 'backtest-3003',
      status: 'succeeded',
      createdAt: '2026-04-02T00:00:00.000Z',
      inputSummary: {
        isPartial: true,
        requestedRange: {
          fromTs: Date.parse('2026-03-03T10:30:00.000Z'),
          toTs: Date.parse('2026-04-02T10:30:00.000Z'),
        },
        appliedRange: {
          fromTs: Date.parse('2026-03-03T10:45:00.000Z'),
          toTs: Date.parse('2026-04-02T10:15:00.000Z'),
        },
      },
      resultSummary: {
        netProfit: 12,
        netProfitPct: 0.12,
        maxDrawdownPct: 0.45,
        winRate: 1,
        profitFactor: 1.4,
        totalTrades: 3,
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-3003' },
      searchParams: {
        symbol: 'BTCUSDT',
      },
    })

    renderToStaticMarkup(element)

    const props = mockBacktestReportClient.mock.calls[0]?.[0] as Record<string, unknown>

    expect(props).toMatchObject({
      partialCoverageNotice: {
        requestedRange: '2026-03-03 10:30 UTC ~ 2026-04-02 10:30 UTC',
        appliedRange: '2026-03-03 10:45 UTC ~ 2026-04-02 10:15 UTC',
      },
    })
  })

  it('starts resolving params and searchParams together', async () => {
    const params = createThenable({ lng: 'zh', id: 'backtest-2001' })
    const searchParams = createThenable({
      symbol: 'SOLUSDT',
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-15T00:00:00.000Z',
    })

    const pagePromise = AiQuantBacktestDetailPage({
      params: params.value as Promise<{ lng: string; id: string }>,
      searchParams: searchParams.value as Promise<{
        symbol?: string | string[]
        startAt?: string | string[]
        endAt?: string | string[]
      }>,
    })

    await Promise.resolve()

    expect(params.then).toHaveBeenCalledTimes(1)
    expect(searchParams.then).toHaveBeenCalledTimes(1)

    params.resolve()
    searchParams.resolve()

    const element = await pagePromise
    const html = renderToStaticMarkup(element)
    expect(html).toContain('SOLUSDT')
  })

  it('falls back to job input summary for symbol and range when query params are missing', async () => {
    mockFetchBacktestJobServer.mockResolvedValue({
      inputSummary: {
        symbols: ['SOLUSDT'],
        requestedRange: {
          fromTs: Date.parse('2026-04-01T00:00:00.000Z'),
          toTs: Date.parse('2026-04-15T00:00:00.000Z'),
        },
      },
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'en', id: 'backtest-5005' },
      searchParams: {},
    })

    renderToStaticMarkup(element)

    const props = mockBacktestReportClient.mock.calls.at(-1)?.[0] as Record<string, unknown>

    expect(props).toMatchObject({
      symbol: 'SOLUSDT',
      rangeDisplay: '2026-04-01 ~ 2026-04-15',
    })
  })
})
