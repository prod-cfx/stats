/** @jest-environment jsdom */

import { App } from 'antd'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const fetchBetaCodes = jest.fn()
const createBetaCodeBatch = jest.fn()
const updateBetaCodeStatus = jest.fn()

jest.mock('@/lib/api', () => ({
  fetchBetaCodes,
  createBetaCodeBatch,
  updateBetaCodeStatus,
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

describe('BetaCodesPage', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    fetchBetaCodes.mockReset()
    createBetaCodeBatch.mockReset()
    updateBetaCodeStatus.mockReset()

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    })

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders beta code list with usage count', async () => {
    fetchBetaCodes.mockResolvedValueOnce([
      {
        id: 'code-1',
        code: 'BETA123',
        maxUses: 2,
        usedCount: 1,
        isActive: true,
        createdAt: '2026-04-24T08:00:00.000Z',
      },
    ])

    const { default: BetaCodesPage } = await import('./page')

    await act(async () => {
      root.render(
        <App>
          <BetaCodesPage />
        </App>,
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('BETA123')
    expect(container.textContent).toContain('1/2')
  })
})
