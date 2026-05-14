import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DashboardEditorSidebar } from './DashboardEditorSidebar'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
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
      saved: {
        id: 'saved',
        name: 'Saved board',
        widgets: [],
        layout: [],
        isPublished: false,
        createdAt: 1,
        updatedAt: 1,
      },
    }),
  )
}

describe('DashboardEditorSidebar', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockPush.mockReset()
    mockReplace.mockReset()
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
      root.render(<DashboardEditorSidebar dashboardId="saved" />)
    })

    expect(host.textContent).toContain('dashboard.sidebar.savedDashboards')
    expect(host.textContent).toContain('Saved board')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
