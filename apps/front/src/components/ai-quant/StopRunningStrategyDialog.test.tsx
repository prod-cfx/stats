/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StopRunningStrategyDialog } from './StopRunningStrategyDialog'

describe('StopRunningStrategyDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('shows a simple stop confirmation when no open position exists', async () => {
    const onStopOnly = jest.fn()
    const onLiquidateAndStop = jest.fn()

    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          strategy={{
            name: 'DOGE strategy',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            positionOverview: {
              openPositionsCount: 0,
              totalUnrealizedPnl: 0,
            },
            latestOrders: [],
          }}
          onStopOnly={onStopOnly}
          onLiquidateAndStop={onLiquidateAndStop}
          onCancel={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('确认停止策略？')
    expect(container.textContent).toContain('确认停止')
    expect(container.textContent).not.toContain('平仓并停止')

    await act(async () => {
      container.querySelector('[data-testid="confirm-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onStopOnly).toHaveBeenCalledTimes(1)
    expect(onLiquidateAndStop).not.toHaveBeenCalled()
  })

  it('offers stop-only and liquidate-and-stop choices when positions exist', async () => {
    const onStopOnly = jest.fn()
    const onLiquidateAndStop = jest.fn()

    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          strategy={{
            name: 'DOGE strategy',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            positionOverview: {
              openPositionsCount: 2,
              totalUnrealizedPnl: 12.5,
            },
            latestOrders: [{ id: 'order-1' }],
          }}
          onStopOnly={onStopOnly}
          onLiquidateAndStop={onLiquidateAndStop}
          onCancel={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('当前策略仍有持仓或挂单')
    expect(container.textContent).toContain('仅停止，保留持仓/挂单')
    expect(container.textContent).toContain('平仓并停止')
    expect(container.textContent).toContain('最近订单记录')

    await act(async () => {
      container.querySelector('[data-testid="liquidate-and-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onLiquidateAndStop).toHaveBeenCalledTimes(1)
    expect(onStopOnly).not.toHaveBeenCalled()
  })

  it('disables dangerous actions while pending', async () => {
    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          pending
          strategy={{
            name: 'DOGE strategy',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            positionOverview: {
              openPositionsCount: 1,
              totalUnrealizedPnl: null,
            },
            latestOrders: [],
          }}
          onStopOnly={() => undefined}
          onLiquidateAndStop={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect((container.querySelector('[data-testid="stop-only-strategy"]') as HTMLButtonElement | null)?.disabled).toBe(true)
    expect((container.querySelector('[data-testid="liquidate-and-stop-strategy"]') as HTMLButtonElement | null)?.disabled).toBe(true)
    expect((container.querySelector('[data-testid="cancel-stop-strategy"]') as HTMLButtonElement | null)?.disabled).toBe(true)
  })
})
