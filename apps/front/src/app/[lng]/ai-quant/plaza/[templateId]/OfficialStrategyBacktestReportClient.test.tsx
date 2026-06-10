/** @jest-environment jsdom */

import type { StrategyPlazaTemplate } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { OfficialStrategyBacktestReportClient } from './OfficialStrategyBacktestReportClient'

const mockFetchStrategyPlazaTemplate = jest.fn<() => Promise<StrategyPlazaTemplate>>()

jest.mock('@/lib/api', () => ({
  fetchStrategyPlazaTemplate: () => mockFetchStrategyPlazaTemplate(),
}))

jest.mock('../../backtest/[id]/BacktestEquityChart', () => ({
  BacktestEquityChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="official-equity-chart">chart {data.length}</div>
  ),
}))

const template = {
  id: 'ma-cross',
  name: 'MA Cross Demo',
  description: 'Use moving averages.',
  logicDescription: 'Fast MA crosses slow MA.',
  tags: ['trend'],
  riskLevel: 'medium',
  scenario: 'trend_following',
  exchange: 'okx',
  environment: 'demo',
  marketType: 'perp',
  symbol: 'BTC-USDT-SWAP',
  timeframe: '15m',
  positionPct: 0.25,
  leverage: 3,
  status: 'live',
  displayOrder: 1,
  displayMetrics: { label: 'official_sample_backtest', returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
  officialBacktest: {
    generatedAt: '2026-06-10T04:45:41.674Z',
    backtestFrom: Date.parse('2026-03-12T04:00:00.000Z'),
    backtestTo: Date.parse('2026-06-10T04:00:00.000Z'),
    source: 'https://www.okx.com/api/v5/market/history-candles',
    dataSource: { exchange: 'okx', marketType: 'swap' },
    candleCount: 2400,
    metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
    equityCurve: [{ ts: Date.parse('2026-03-12T04:00:00.000Z'), equity: 10000 }, { ts: Date.parse('2026-06-10T04:00:00.000Z'), equity: 10178 }],
    confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
    disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
  },
} satisfies StrategyPlazaTemplate

describe('OfficialStrategyBacktestReportClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockFetchStrategyPlazaTemplate.mockReset()
    mockFetchStrategyPlazaTemplate.mockResolvedValue(template)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('loads and renders a public official backtest report', async () => {
    await act(async () => {
      root.render(<OfficialStrategyBacktestReportClient lng="zh" templateId="ma-cross" />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockFetchStrategyPlazaTemplate).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('MA Cross Demo')
    expect(container.textContent).toContain('+1.78%')
    expect(container.textContent).toContain('58.14%')
    expect(container.textContent).toContain('43')
    expect(container.textContent).toContain('回测区间')
    expect(container.textContent).toContain('历史回测不代表未来收益')
    expect(container.querySelector('[data-testid="official-equity-chart"]')?.textContent).toContain('chart 2')
  })
})
