import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DashboardReadOnlyCanvas } from './DashboardReadOnlyCanvas'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('../widgets/WidgetRenderer', () => ({
  WidgetRenderer: ({ widget }: any) => (
    <div data-testid="widget-renderer" data-widget-id={widget.id}>
      {widget.id}
    </div>
  ),
}))

jest.mock('react-grid-layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
}))

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

function seedDashboard() {
  window.localStorage.setItem(
    'coinflux_dashboards_v1',
    JSON.stringify({
      mobile: {
        id: 'mobile',
        name: 'Mobile dashboard',
        widgets: [
          { id: 'bottom', type: 'market.kline', config: {} },
          { id: 'top-right', type: 'market.prediction', config: {} },
          { id: 'top-left', type: 'market.crypto_stocks', config: {} },
        ],
        layout: [
          { i: 'bottom', x: 0, y: 2, w: 6, h: 6 },
          { i: 'top-right', x: 6, y: 0, w: 6, h: 6 },
          { i: 'top-left', x: 0, y: 0, w: 6, h: 6 },
        ],
        isPublished: true,
        createdAt: 1,
        updatedAt: 1,
      },
    }),
  )
}

describe('DashboardReadOnlyCanvas mobile layout', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    window.localStorage.clear()
    seedDashboard()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    window.localStorage.clear()
  })

  it('renders phone view as ordered non-grid cards', async () => {
    await act(async () => {
      root.render(<DashboardReadOnlyCanvas dashboardId="mobile" />)
    })

    expect(host.querySelector('[data-testid="mobile-readonly-canvas"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="grid-layout"]')).toBeNull()
    expect(Array.from(host.querySelectorAll('[data-widget-id]')).map(node => node.getAttribute('data-widget-id'))).toEqual([
      'top-left',
      'top-right',
      'bottom',
    ])
    expect(host.querySelector('[data-testid="mobile-readonly-canvas"]')?.className).toContain('overflow-hidden')
  })
})
