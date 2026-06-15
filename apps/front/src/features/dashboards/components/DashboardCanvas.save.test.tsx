/** @jest-environment jsdom */

import type { Root } from 'react-dom/client'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DashboardCanvas } from './DashboardCanvas'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('../widgets/WidgetRenderer', () => ({
  WidgetRenderer: ({ widget }: { widget: { id: string } }) => (
    <div data-testid="widget-renderer" data-widget-id={widget.id}>{widget.id}</div>
  ),
}))

jest.mock('next/dynamic', () => {
  return () => function MockDynamicAddWidgetModal() {
    return null
  }
})

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('react-grid-layout', () => ({
  __esModule: true,
  default: ({ children, onLayoutChange }: { children: React.ReactNode, onLayoutChange?: (layout: Array<{ i: string, x: number, y: number, w: number, h: number }>) => void }) => (
    <div data-testid="grid-layout">
      <button
        type="button"
        data-testid="move-first"
        onClick={() => onLayoutChange?.([{ i: 'a-widget', x: 3, y: 0, w: 6, h: 6 }])}
      >
        move first
      </button>
      <button
        type="button"
        data-testid="move-second"
        onClick={() => onLayoutChange?.([{ i: 'a-widget', x: 5, y: 0, w: 6, h: 6 }])}
      >
        move second
      </button>
      {children}
    </div>
  ),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE_KEY = 'coinflux_dashboards_v1'

function seedDashboards() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      a: {
        id: 'a',
        name: 'A',
        widgets: [{ id: 'a-widget', type: 'market.kline', config: {} }],
        layout: [{ i: 'a-widget', x: 0, y: 0, w: 6, h: 6 }],
        isPublished: false,
        createdAt: 1,
        updatedAt: 1,
      },
      b: {
        id: 'b',
        name: 'B',
        widgets: [{ id: 'b-widget', type: 'market.kline', config: {} }],
        layout: [{ i: 'b-widget', x: 0, y: 0, w: 6, h: 6 }],
        isPublished: false,
        createdAt: 1,
        updatedAt: 1,
      },
    }),
  )
}

function readDashboards() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, { layout: Array<{ i: string, x: number }> }>
}

describe('dashboardCanvas layout save', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    window.localStorage.clear()
    seedDashboards()
    jest.useFakeTimers()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    window.localStorage.clear()
    jest.useRealTimers()
  })

  it('saves pending layout to the dashboard that produced it', async () => {
    await act(async () => {
      root.render(<DashboardCanvas dashboardId="a" />)
    })
    await act(async () => {})

    act(() => {
      host.querySelector<HTMLButtonElement>('[data-testid="move-first"]')?.click()
    })
    await act(async () => {
      root.render(<DashboardCanvas dashboardId="b" />)
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const dashboards = readDashboards()
    expect(dashboards.a.layout).toEqual([expect.objectContaining({ i: 'a-widget', x: 3 })])
    expect(dashboards.b.layout).toEqual([expect.objectContaining({ i: 'b-widget', x: 0 })])
    expect(host.querySelector('[data-widget-id="b-widget"]')).not.toBeNull()
    expect(host.querySelector('[data-widget-id="a-widget"]')).toBeNull()
  })

  it('debounces layout saves until the latest layout change settles', async () => {
    await act(async () => {
      root.render(<DashboardCanvas dashboardId="a" />)
    })
    await act(async () => {})

    act(() => {
      host.querySelector<HTMLButtonElement>('[data-testid="move-first"]')?.click()
    })
    act(() => {
      jest.advanceTimersByTime(250)
    })
    act(() => {
      host.querySelector<HTMLButtonElement>('[data-testid="move-second"]')?.click()
    })
    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(readDashboards().a.layout).toEqual([expect.objectContaining({ i: 'a-widget', x: 0 })])

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(readDashboards().a.layout).toEqual([expect.objectContaining({ i: 'a-widget', x: 4 })])
  })
})
