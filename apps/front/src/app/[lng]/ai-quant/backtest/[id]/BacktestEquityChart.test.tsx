/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestEquityChart } from './BacktestEquityChart'

const mockComposedChart = jest.fn(({ children }: { children: React.ReactNode }) => <svg>{children}</svg>)

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: (props: { children: React.ReactNode }) => mockComposedChart(props),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Area: () => null,
  Line: () => null,
}))

describe('BacktestEquityChart mobile layout', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    mockComposedChart.mockClear()
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    ;(globalThis as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof MutationObserver
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

  it('uses shorter responsive heights on mobile for data and empty states', async () => {
    await act(async () => {
      root.render(
        <BacktestEquityChart
          lng="zh"
          data={[
            { time: '03-01', equity: 10000, drawdown: 0 },
            { time: '03-02', equity: 10200, drawdown: -2 },
          ]}
        />,
      )
    })

    expect(container.querySelector('[data-testid="backtest-equity-chart-frame"]')?.className).toContain('p-4')
    expect(container.querySelector('[data-testid="backtest-equity-chart-body"]')?.className).toContain('h-[300px]')
    expect(container.querySelector('[data-testid="backtest-equity-chart-body"]')?.className).toContain('sm:h-[360px]')

    await act(async () => {
      root.render(<BacktestEquityChart lng="zh" data={[]} />)
    })

    expect(container.querySelector('[data-testid="backtest-equity-empty"]')?.className).toContain('h-[280px]')
    expect(container.querySelector('[data-testid="backtest-equity-empty"]')?.className).toContain('sm:h-[360px]')
  })

  it('downsamples large one-minute equity series before passing data to recharts', async () => {
    const data = Array.from({ length: 150_000 }, (_, index) => ({
      time: `t-${index}`,
      equity: 10_000 + Math.sin(index / 10) * 20,
      drawdown: -Math.abs(Math.sin(index / 20)),
    }))

    await act(async () => {
      root.render(<BacktestEquityChart lng="zh" data={data} />)
    })

    const chartProps = mockComposedChart.mock.calls.at(-1)?.[0] as { data?: unknown[] } | undefined
    expect(chartProps?.data?.length).toBeLessThanOrEqual(1_500)
  })
})
