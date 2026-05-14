import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
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

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

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

describe('DashboardSidebar', () => {
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
})
