import type {Root} from 'react-dom/client';
import React, { act } from 'react'
import { createRoot  } from 'react-dom/client'
import { DashboardSidebar } from './DashboardSidebar'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock('@/lib/toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

function seedDashboards() {
  window.localStorage.setItem(
    'coinflux_dashboards_v1',
    JSON.stringify({
      published: {
        id: 'published',
        name: 'Published board',
        widgets: [],
        layout: [],
        isPublished: true,
        createdAt: 1,
        updatedAt: 2,
      },
    }),
  )
}

describe('dashboardSidebar', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockPush.mockReset()
    window.localStorage.clear()
    seedDashboards()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    window.localStorage.clear()
  })

  it('renders dashboard lists without triggering an external-store render loop', async () => {
    await act(async () => {
      root.render(<DashboardSidebar activeTab="my" />)
    })

    expect(host.textContent).toContain('dashboard.sidebar.myDashboards')
    expect(host.textContent).toContain('Published board')
  })

  it('closes an open dashboard menu when pointer moves outside the menu', async () => {
    await act(async () => {
      root.render(<DashboardSidebar activeTab="my" />)
    })

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="dashboard-actions"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(host.textContent).toContain('重命名')

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })

    expect(host.textContent).not.toContain('重命名')
  })
})
