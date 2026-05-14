import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DashboardCanvas } from './DashboardCanvas'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('../widgets/WidgetRenderer', () => ({
  WidgetRenderer: ({ widget, onRemove }: any) => (
    <div data-testid="widget-renderer" data-widget-id={widget.id}>
      <span>{widget.id}</span>
      {onRemove ? <button type="button" aria-label="remove-widget" onClick={onRemove}>remove</button> : null}
    </div>
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
          { id: 'late', type: 'market.kline', config: {} },
          { id: 'early', type: 'market.prediction', config: {} },
        ],
        layout: [
          { i: 'late', x: 6, y: 2, w: 6, h: 6 },
          { i: 'early', x: 0, y: 0, w: 6, h: 6 },
        ],
        isPublished: false,
        createdAt: 1,
        updatedAt: 1,
      },
    }),
  )
}

describe('DashboardCanvas mobile layout', () => {
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

  it('uses a non-draggable single-column list on phones', async () => {
    await act(async () => {
      root.render(<DashboardCanvas dashboardId="mobile" />)
    })

    expect(host.querySelector('[data-testid="mobile-dashboard-canvas"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="grid-layout"]')).toBeNull()
    expect(host.querySelector('.react-draggable-handle')).toBeNull()
    expect(Array.from(host.querySelectorAll('[data-widget-id]')).map(node => node.getAttribute('data-widget-id'))).toEqual([
      'early',
      'late',
    ])
  })
})
