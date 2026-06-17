/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestEquityChart } from './BacktestEquityChart'

const mockBacktestEquityChartRecharts = jest.fn((props: { chartData: unknown[] }) => (
  <div data-testid="backtest-equity-chart-body" className="h-[300px] w-full sm:h-[360px] lg:h-[400px]">
    {props.chartData.length}
  </div>
))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: jest.fn((_loader: unknown, _options?: unknown) => function MockDynamicBacktestEquityChartRecharts(props: { chartData: unknown[] }) {
    return mockBacktestEquityChartRecharts(props)
  }),
}))

describe('BacktestEquityChart mobile layout', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    mockBacktestEquityChartRecharts.mockClear()
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

  it('reserves chart height while the recharts chunk is loading', () => {
    const dynamicMock = jest.requireMock('next/dynamic').default as jest.Mock
    const dynamicOptions = dynamicMock.mock.calls[0]?.[1] as { loading?: () => React.ReactNode }

    expect(dynamicOptions.loading).toBeDefined()

    const loadingRoot = document.createElement('div')
    const loadingRenderer = createRoot(loadingRoot)

    act(() => {
      loadingRenderer.render(dynamicOptions.loading?.())
    })

    const loadingPlaceholder = loadingRoot.querySelector('[data-testid="backtest-equity-chart-body-loading"]')
    expect(loadingPlaceholder?.className).toContain('h-[300px]')
    expect(loadingPlaceholder?.className).toContain('sm:h-[360px]')
    expect(loadingPlaceholder?.className).toContain('lg:h-[400px]')

    act(() => {
      loadingRenderer.unmount()
    })
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

    const chartProps = mockBacktestEquityChartRecharts.mock.calls.at(-1)?.[0]
    expect(chartProps?.chartData.length).toBeLessThanOrEqual(1_500)
  })
})
