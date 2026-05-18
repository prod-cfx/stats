/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const replaceMock = jest.fn()
const redirectParamMock = jest.fn(() => null)
const sendEmailCodeMock = jest.fn()
const loginWithEmailCodeMock = jest.fn()

function changeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  valueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: redirectParamMock }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    sendEmailCode: sendEmailCodeMock,
    loginWithEmailCode: loginWithEmailCodeMock,
  }),
}))

jest.mock('@/features/auth/api', () => ({
  getTelegramLoginConfigRequest: jest.fn(),
}))

jest.mock('@/features/auth/components/TelegramLoginButtons', () => ({
  TelegramLoginButtons: ({ redirect }: { redirect?: string }) => (
    <div data-testid="telegram-buttons" data-redirect={redirect}>
      telegram-buttons
    </div>
  ),
}))

describe('LoginPageClient fallback auth sheet', () => {
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
    sendEmailCodeMock.mockReset()
    loginWithEmailCodeMock.mockReset()
    sendEmailCodeMock.mockResolvedValue(undefined)
    loginWithEmailCodeMock.mockResolvedValue(undefined)
    redirectParamMock.mockReset()
    redirectParamMock.mockReturnValue(null)
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 })
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

  it('renders fallback auth sheet and preserves redirect query', async () => {
    redirectParamMock.mockReturnValue('/zh/ai-quant')
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

    const sheet = container.querySelector('[data-testid="auth-sheet-panel"]')
    expect(sheet).not.toBeNull()
    expect(sheet?.className).toContain('cf-mobile-login-sheet')
    expect(sheet?.className).toContain('bg-[color:var(--cf-surface)]')
    expect(container.querySelector('[data-testid="telegram-buttons"]')?.getAttribute('data-redirect')).toBe('/zh/ai-quant')
    expect(container.querySelector('[data-testid="mobile-login-sheet"]')).toBeNull()
  })

  it('allows localized root query redirects', async () => {
    redirectParamMock.mockReturnValue('/zh?from=nav')
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

    expect(container.querySelector('[data-testid="telegram-buttons"]')?.getAttribute('data-redirect')).toBe('/zh?from=nav')
  })

  it.each([
    ['https://evil.com'],
    ['//evil.com'],
    ['/en/account'],
    ['javascript:alert(1)'],
    [''],
  ])('falls back to account for unsafe redirect %s', async unsafeRedirect => {
    redirectParamMock.mockReturnValue(unsafeRedirect)
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

    expect(container.querySelector('[data-testid="telegram-buttons"]')?.getAttribute('data-redirect')).toBe('/zh/account')
  })

  it('closes fallback page by replacing locale root', async () => {
    getTelegramLoginConfigRequestMock.mockResolvedValueOnce({
      botName: 'cfx_login_bot',
      betaCodeGateEnabled: false,
    })
    const { LoginPageClient } = await import('./LoginPageClient')

    act(() => {
      root.render(<LoginPageClient lng="zh" />)
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="auth-sheet-close"]')?.click()
    })

    expect(replaceMock).toHaveBeenCalledWith('/zh')
  })

  it('normalizes success redirect before replacing', async () => {
    redirectParamMock.mockReturnValue('//evil.com')
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

    await act(async () => {
      const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
      changeInputValue(emailInput!, 'user@example.com')
    })
    await act(async () => {
      const sendCodeButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => (
        button.textContent === 'auth.sendCode'
      ))
      sendCodeButton?.click()
      await Promise.resolve()
    })
    await act(async () => {
      const codeInput = container.querySelector<HTMLInputElement>('input[type="text"]')
      changeInputValue(codeInput!, '123456')
    })
    await act(async () => {
      const form = container.querySelector<HTMLFormElement>('form')
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(replaceMock).toHaveBeenCalledWith('/zh/account')
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

    expect(getTelegramLoginConfigRequestMock).toHaveBeenCalled()
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
