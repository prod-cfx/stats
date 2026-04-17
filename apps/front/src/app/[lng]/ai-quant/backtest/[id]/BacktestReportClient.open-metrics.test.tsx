/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestReportClient } from './BacktestReportClient'

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

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  getBacktestJobResult: jest.fn(async () => null),
}))

describe('BacktestReportClient open metrics', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('shows open trade metrics in the core metrics grid', async () => {
    await act(async () => {
      root.render(
        <BacktestReportClient
          lng="en"
          id="btjob-open-metrics"
          symbol="BTCUSDT"
          marketType="perp"
          rangeDisplay="2026-04-01 ~ 2026-04-15"
          metrics={{
            maxDrawdownPct: 0.32,
            totalReturnPct: 0,
            winRatePct: 0,
            tradeCount: 0,
            openTradeCount: 1,
            openPnl: 2.49,
          }}
        />,
      )
    })

    expect(container.textContent).toContain('Open Trades')
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('Open P&L')
    expect(container.textContent).toContain('+2.49')
  })

  it('shows holding-oriented open metrics for spot', async () => {
    await act(async () => {
      root.render(
        <BacktestReportClient
          lng="zh"
          id="btjob-open-metrics-spot"
          symbol="BTCUSDT"
          marketType="spot"
          rangeDisplay="2026-04-01 ~ 2026-04-15"
          metrics={{
            maxDrawdownPct: 0.32,
            totalReturnPct: 0,
            winRatePct: 0,
            tradeCount: 0,
            openTradeCount: 1,
            openPnl: 2.49,
          }}
        />,
      )
    })

    expect(container.textContent).toContain('当前持仓')
    expect(container.textContent).toContain('持仓浮盈浮亏')
    expect(container.textContent).not.toContain('未平仓笔数')
  })
})
