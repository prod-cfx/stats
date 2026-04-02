/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestReportClient } from './BacktestReportClient'

const mockGetBacktestJobResult = jest.fn()

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: jest.fn(() => function MockDynamicEquityChart() {
    return <div data-testid="dynamic-equity-chart">dynamic-equity-chart</div>
  }),
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: () => <div />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Area: () => null,
  Line: () => null,
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  getBacktestJobResult: (...args: unknown[]) => mockGetBacktestJobResult(...args),
}))

describe('BacktestReportClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let mockDynamic: jest.Mock

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockGetBacktestJobResult.mockReset()
    mockDynamic = jest.requireMock('next/dynamic').default as jest.Mock
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('loads detailed report data on mount when only summary metrics are preloaded', async () => {
    mockGetBacktestJobResult.mockResolvedValue({
      summary: {
        netProfit: 320,
        netProfitPct: 3.2,
        maxDrawdownPct: 2.4,
        winRate: 0.5,
        profitFactor: 1.2,
        totalTrades: 1,
      },
      equityCurve: [
        { ts: Date.parse('2026-03-01T00:00:00.000Z'), equity: 10000 },
        { ts: Date.parse('2026-03-02T00:00:00.000Z'), equity: 10320 },
      ],
      trades: [
        {
          id: 'trade-1',
          side: 'LONG',
          entryTs: Date.parse('2026-03-01T08:00:00.000Z'),
          entryPrice: 100.5,
          exitTs: Date.parse('2026-03-02T12:00:00.000Z'),
          exitPrice: 103.2,
          returnPct: 3.2,
          reasonOpen: '价格 <= 入场价',
          reasonClose: '价格 >= 止盈价',
        },
      ],
    })

    await act(async () => {
      root.render(
        <BacktestReportClient
          lng="zh"
          id="btjob-1"
          symbol="BTCUSDT"
          rangeDisplay="2026-03-01 ~ 2026-03-02"
          partialCoverageNotice={{
            requestedRange: '2026-03-01 00:00 UTC ~ 2026-03-02 00:00 UTC',
            appliedRange: '2026-03-01 00:15 UTC ~ 2026-03-01 23:45 UTC',
          }}
          metrics={{
            maxDrawdownPct: 2.4,
            totalReturnPct: 3.2,
            winRatePct: 50,
            tradeCount: 1,
          }}
        />,
      )
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockGetBacktestJobResult).toHaveBeenCalledWith('btjob-1')
    expect(container.textContent).toContain('交易明细')
    expect(container.textContent).toContain('开仓时间')
    expect(container.textContent).toContain('平仓时间')
    expect(container.textContent).toContain('2026-03-01 08:00')
    expect(container.textContent).toContain('2026-03-02 12:00')
    expect(container.textContent).toContain('2026-03-01 ~ 2026-03-02')
    expect(container.textContent).toContain('本次回测使用了部分覆盖的市场数据。')
    expect(container.textContent).toContain('请求区间：2026-03-01 00:00 UTC ~ 2026-03-02 00:00 UTC')
    expect(container.textContent).toContain('实际执行区间：2026-03-01 00:15 UTC ~ 2026-03-01 23:45 UTC')
    expect(container.textContent).not.toContain('买入/做多')
    expect(container.textContent).not.toContain('2025-12')
    expect(container.textContent).not.toContain('回测结果暂不可用')
  })

  it('loads the equity chart through a dynamic boundary when report data is available', async () => {
    await act(async () => {
      root.render(
        <BacktestReportClient
          lng="zh"
          id="btjob-2"
          symbol="BTCUSDT"
          rangeDisplay="2026-03-01 ~ 2026-03-02"
          metrics={{
            maxDrawdownPct: 2.4,
            totalReturnPct: 3.2,
            winRatePct: 50,
            tradeCount: 1,
          }}
          report={{
            equityCurve: [
              { ts: Date.parse('2026-03-01T00:00:00.000Z'), equity: 10000 },
              { ts: Date.parse('2026-03-02T00:00:00.000Z'), equity: 10320 },
            ],
            trades: [
              {
                id: 'trade-1',
                side: 'LONG',
                exitTs: Date.parse('2026-03-02T12:00:00.000Z'),
                exitPrice: 103.2,
                returnPct: 3.2,
              },
            ],
          }}
        />,
      )
    })

    expect(mockDynamic).toHaveBeenCalled()
    expect(container.querySelector('[data-testid="dynamic-equity-chart"]')).not.toBeNull()
  })
})
