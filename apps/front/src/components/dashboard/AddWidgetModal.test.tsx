import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AddWidgetModal } from './AddWidgetModal'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ loading }: { loading: boolean }) => <div data-testid="modal" data-loading={String(loading)} />,
}))

jest.mock('@/features/dashboards/components/WidgetConfigurator', () => ({
  WidgetConfigurator: () => <div />,
}))

jest.mock('@/features/dashboards/components/WidgetGroupPreview', () => ({
  WidgetGroupPreview: () => <div />,
}))

jest.mock('@/features/dashboards/store/dashboard-actions', () => ({
  addWidgetToDashboard: jest.fn(),
}))

jest.mock('@/features/dashboards/widgets/widgets-catalog', () => ({
  WIDGET_CATALOG: [],
}))

describe('addWidgetModal', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    jest.useRealTimers()
    document.body.removeChild(container)
  })

  it('starts in loading state when first mounted open', () => {
    const root = createRoot(container)

    act(() => {
      root.render(<AddWidgetModal isOpen={true} onClose={jest.fn()} dashboardId="dashboard-1" />)
    })

    expect(container.querySelector('[data-testid="modal"]')?.getAttribute('data-loading')).toBe('true')

    act(() => {
      root.unmount()
    })
  })
})
