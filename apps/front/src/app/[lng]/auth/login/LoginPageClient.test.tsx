/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const replaceMock = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

jest.mock('@/features/auth/api', () => ({
  getTelegramLoginConfigRequest: jest.fn(),
}))

jest.mock('@/features/auth/components/TelegramLoginButtons', () => ({
  TelegramLoginButtons: () => <div>telegram-buttons</div>,
}))

describe('LoginPageClient beta gate visibility', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let getTelegramLoginConfigRequestMock: jest.Mock

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    getTelegramLoginConfigRequestMock = (
      jest.requireMock('@/features/auth/api') as { getTelegramLoginConfigRequest: jest.Mock }
    ).getTelegramLoginConfigRequest
    getTelegramLoginConfigRequestMock.mockReset()
    replaceMock.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('hides beta code input when the beta gate is disabled', async () => {
    getTelegramLoginConfigRequestMock.mockResolvedValueOnce({
      botName: 'cfx_login_bot',
      betaCodeGateEnabled: false,
    })
    const { LoginPageClient } = await import('./LoginPageClient')

    act(() => {
      root.render(<LoginPageClient lng="zh" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(getTelegramLoginConfigRequestMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#beta-code-input')).toBeNull()
    expect(container.textContent).not.toContain('auth.betaCode')
  })

  it('shows beta code input when the beta gate is enabled', async () => {
    getTelegramLoginConfigRequestMock.mockResolvedValueOnce({
      botName: 'cfx_login_bot',
      betaCodeGateEnabled: true,
    })
    const { LoginPageClient } = await import('./LoginPageClient')

    act(() => {
      root.render(<LoginPageClient lng="zh" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('#beta-code-input')).not.toBeNull()
    expect(container.textContent).toContain('auth.betaCode')
  })
})
