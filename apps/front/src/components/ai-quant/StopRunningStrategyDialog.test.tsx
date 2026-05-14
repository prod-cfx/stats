/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import mockEnCommon from '../../../public/locales/en/common.json'
import mockZhCommon from '../../../public/locales/zh/common.json'
import { StopRunningStrategyDialog } from './StopRunningStrategyDialog'

let mockCommon = mockZhCommon

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = key.split('.').reduce<unknown>((curr, segment) => (
        curr && typeof curr === 'object' ? (curr as Record<string, unknown>)[segment] : undefined
      ), mockCommon)
      const template = typeof value === 'string' ? value : key
      return Object.entries(options ?? {}).reduce(
        (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, String(replacement)),
        template,
      )
    },
  }),
}))

describe('StopRunningStrategyDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mockCommon = mockZhCommon
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
            openOrdersCount: 0,
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

  it('offers risk choices when open order count is unknown even if no open position is reported', async () => {
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
            openOrdersCount: null,
          }}
          onStopOnly={() => undefined}
          onLiquidateAndStop={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('当前策略仍有持仓或挂单')
    expect(container.textContent).toContain('当前未成交挂单待确认')
    expect(container.textContent).toContain('平仓并停止')
  })

  it('renders stop choices in English when the page locale is English', async () => {
    mockCommon = mockEnCommon

    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          strategy={{
            name: 'DOGE strategy',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            marketType: 'perp',
            positionOverview: {
              openPositionsCount: 2,
              totalUnrealizedPnl: 12.5,
            },
            openOrdersCount: null,
          }}
          onStopOnly={() => undefined}
          onLiquidateAndStop={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('This strategy still has positions or open orders')
    expect(container.textContent).toContain('Stop only, keep positions/orders')
    expect(container.textContent).toContain('Liquidate and Stop')
    expect(container.textContent).not.toContain('平仓并停止')
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
            openOrdersCount: 1,
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
    expect(container.textContent).toContain('当前未成交挂单')

    await act(async () => {
      container.querySelector('[data-testid="liquidate-and-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(onLiquidateAndStop).toHaveBeenCalledTimes(1)
    expect(onStopOnly).not.toHaveBeenCalled()
  })

  it('uses spot holding wording for spot strategies', async () => {
    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          strategy={{
            name: 'BTC spot strategy',
            exchange: 'okx',
            symbol: 'BTC-USDT',
            marketType: 'spot',
            spotHoldingSummary: {
              baseAsset: 'BTC',
              quantity: 0.02161279,
              openPositionsCount: 1,
            },
            positionOverview: {
              openPositionsCount: 1,
              totalUnrealizedPnl: 8.21,
            },
            openOrdersCount: 0,
          }}
          onStopOnly={() => undefined}
          onLiquidateAndStop={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('当前策略仍有现货持币或挂单')
    expect(container.textContent).toContain('当前现货持币')
    expect(container.textContent).toContain('0.02161279 BTC')
    expect(container.textContent).toContain('当前未成交挂单0')
    expect(container.textContent).toContain('再处理现货持币')
    expect(container.textContent).toContain('仅停止，保留现货持币/挂单')
    expect(container.textContent).not.toContain('再处理持仓')
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
            openOrdersCount: 0,
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

  it('keeps the stop dialog scrollable with full-width mobile actions', async () => {
    await act(async () => {
      root.render(
        <StopRunningStrategyDialog
          open
          strategy={{
            name: 'Very long strategy name that should wrap inside mobile dialog',
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            positionOverview: {
              openPositionsCount: 1,
              totalUnrealizedPnl: 12.5,
            },
            openOrdersCount: 1,
          }}
          onStopOnly={() => undefined}
          onLiquidateAndStop={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    const overlay = container.firstElementChild
    const panel = overlay?.firstElementChild
    const actions = container.querySelector('[data-testid="stop-dialog-actions"]')
    const detailRows = container.querySelectorAll('[data-testid="stop-dialog-detail-row"]')

    expect(overlay?.className).toContain('py-4')
    expect(panel?.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(panel?.className).toContain('overflow-y-auto')
    expect(actions?.className).toContain('grid')
    expect(actions?.className).toContain('sm:flex')
    expect(detailRows[0]?.className).toContain('flex-col')
  })
})
