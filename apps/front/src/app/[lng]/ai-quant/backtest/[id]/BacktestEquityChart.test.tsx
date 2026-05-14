/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestEquityChart } from './BacktestEquityChart'

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
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
})
