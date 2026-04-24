/** @jest-environment jsdom */

import { App } from 'antd'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const fetchBetaCodes = jest.fn()
const createBetaCodeBatch = jest.fn()
const updateBetaCodeStatus = jest.fn()
const fetchBetaCodeGateSetting = jest.fn()
const updateBetaCodeGateSetting = jest.fn()

jest.mock('@/lib/api', () => ({
  fetchBetaCodes,
  createBetaCodeBatch,
  updateBetaCodeStatus,
  fetchBetaCodeGateSetting,
  updateBetaCodeGateSetting,
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
    fetchBetaCodeGateSetting.mockReset()
    updateBetaCodeGateSetting.mockReset()
    fetchBetaCodeGateSetting.mockResolvedValue(false)

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
    fetchBetaCodes.mockResolvedValueOnce({
      total: 101,
      page: 1,
      limit: 20,
      items: [
        {
          id: 'code-1',
          code: 'BETA123',
          maxUses: 2,
          usedCount: 1,
          isActive: true,
          createdAt: '2026-04-24T08:00:00.000Z',
        },
      ],
    })

    const { default: BetaCodesPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <BetaCodesPage />
        </App>,
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchBetaCodes).toHaveBeenCalledWith({ page: 1, limit: 20 })
    expect(container.textContent).toContain('BETA123')
    expect(container.textContent).toContain('1/2')
    expect(container.textContent).toContain('共 101 个内测码')
  })

  it('loads and updates beta gate switch', async () => {
    fetchBetaCodeGateSetting.mockResolvedValueOnce(false)
    updateBetaCodeGateSetting.mockResolvedValueOnce(true)
    fetchBetaCodes.mockResolvedValueOnce({
      total: 0,
      page: 1,
      limit: 20,
      items: [],
    })

    const { default: BetaCodesPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <BetaCodesPage />
        </App>,
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchBetaCodeGateSetting).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('内测码准入')

    const gateSwitch = container.querySelector('[role="switch"]') as HTMLButtonElement | null
    expect(gateSwitch?.getAttribute('aria-checked')).toBe('false')

    act(() => {
      gateSwitch?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(updateBetaCodeGateSetting).toHaveBeenCalledWith(true)
  })
})
