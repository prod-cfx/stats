import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DashboardHeader } from './DashboardHeader'

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/lib/toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

describe('DashboardHeader mobile layout', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('lets title and actions wrap instead of squeezing action labels vertically', async () => {
    await act(async () => {
      root.render(
        <DashboardHeader
          dashboard={{
            id: 'draft',
            name: 'UNTITLED',
            widgets: [],
            layout: [],
            isPublished: false,
            createdAt: 1,
            updatedAt: 1,
          }}
          onRefresh={jest.fn()}
        />,
      )
    })

    const header = host.firstElementChild
    expect(header?.className).toContain('flex-col')

    const actions = host.querySelector('[data-testid="dashboard-header-actions"]')
    expect(actions?.className).toContain('flex-wrap')

    const uploadButton = host.querySelector('button[title="dashboard.editor.actions.selectThumbnail"]')
    expect(uploadButton?.className).toContain('whitespace-nowrap')
  })
})
