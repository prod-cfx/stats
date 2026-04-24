/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EmailOtpForm } from './components/EmailOtpForm'
import { TelegramLoginButtons } from './components/TelegramLoginButtons'

const sendEmailCodeMock = jest.fn()
const loginWithEmailCodeMock = jest.fn()
const createTelegramDesktopIntentMock = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('lucide-react', () => ({
  Send: () => null,
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    sendEmailCode: sendEmailCodeMock,
    loginWithEmailCode: loginWithEmailCodeMock,
    createTelegramDesktopIntent: createTelegramDesktopIntentMock,
  }),
}))

jest.mock('./telegram-env', () => ({
  canShowTelegramDesktopEntry: () => true,
  isTelegramWebAppEnv: () => false,
}))

jest.mock('./api', () => ({
  getTelegramWebAuthorizeUrlRequest: jest.fn(),
  getTelegramLoginConfigRequest: jest.fn(async () => ({
    botName: 'cfx_login_staging_bot',
  })),
}))

describe('beta code login flow', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sendEmailCodeMock.mockResolvedValue(undefined)
    loginWithEmailCodeMock.mockResolvedValue(undefined)
    createTelegramDesktopIntentMock.mockResolvedValue({
      intentId: 'intent-1',
      deepLink: 'tg://resolve?domain=cfx_login_staging_bot&start=cfx_login_abc123',
      webLink: 'https://t.me/cfx_login_staging_bot?start=cfx_login_abc123',
      callbackUrl: 'https://front.example.test/zh/auth/telegram/callback?source=desktop&intent=login&desktop_intent=intent-1',
      expiresInSeconds: 300,
    })
    const apiMock = jest.requireMock('./api') as {
      getTelegramWebAuthorizeUrlRequest: jest.Mock
    }
    apiMock.getTelegramWebAuthorizeUrlRequest.mockResolvedValue({
      authorizeUrl: 'https://oauth.telegram.org/auth?bot_id=1',
    })
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    jest.restoreAllMocks()
    jest.clearAllMocks()
    window.sessionStorage.clear()
    document.body.innerHTML = ''
  })

  it('renders beta code field in the email form', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode="" onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    expect(container.textContent).toContain('auth.betaCode')
    expect(container.textContent).toContain('auth.betaCodeHint')
    expect(container.querySelector('input[placeholder="auth.betaCodePlaceholder"]')).toBeTruthy()
  })

  it('passes beta code when submitting an email code login', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode=" beta-42 " onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    const inputs = Array.from(container.querySelectorAll('input'))
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(inputs[0], 'User@Example.COM ')
      inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }))
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(inputs[1], '123456')
      inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }))
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(loginWithEmailCodeMock).toHaveBeenCalledWith('user@example.com', '123456', ' beta-42 ')
  })

  it('blocks Telegram login intent when beta code is missing', async () => {
    await act(async () => {
      root?.render(<TelegramLoginButtons lng="zh" intent="login" betaCode="   " />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    const webButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('auth.telegramWeb'))
    const desktopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('auth.telegramDesktop'))

    await act(async () => {
      webButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      desktopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const apiMock = jest.requireMock('./api') as {
      getTelegramWebAuthorizeUrlRequest: jest.Mock
    }
    expect(apiMock.getTelegramWebAuthorizeUrlRequest).not.toHaveBeenCalled()
    expect(createTelegramDesktopIntentMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('auth.betaCodeRequired')
  })
})
